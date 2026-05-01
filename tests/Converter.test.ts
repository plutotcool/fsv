import path from 'node:path'
import { describe, it, expect } from 'vitest'

import { Converter } from '../src/core/Converter'
import { Demuxer } from '../src/core/Demuxer'
import { H264, H265 } from '../src/core/Codec'

describe('Converter', () => {
  describe('mp4/H.264 input (non-alpha)', () => {
    it('returns a Buffer', async () => {
      const result = await Converter.convert(H264_MP4_FIXTURE)
      expect(Buffer.isBuffer(result)).toBe(true)
    })

    it('produces a valid demuxable FSV without alpha track', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE))

      expect(fsv.width).toBe(320)
      expect(fsv.height).toBe(240)
      expect(fsv.alpha).toBeUndefined()
    })

    it('produces the expected number of frames', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE))

      expect(fsv.length).toBeGreaterThanOrEqual(EXPECTED_FRAMES - FRAME_TOLERANCE)
      expect(fsv.length).toBeLessThanOrEqual(EXPECTED_FRAMES + FRAME_TOLERANCE)
    })

    it('first frame is a key frame', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE))

      expect(fsv.frames[0].chunk.type).toBe('key')
    })

    it('converts with libx264 output codec', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE, {
        outputCodec: H264
      }))

      expect(fsv.width).toBe(320)
      expect(fsv.frames.length).toBeGreaterThan(0)

      // Verify H.264 bitstream: find IDR (NAL type 5) in key frame
      const keyFrame = fsv.frames.find(f => f.chunk.type === 'key')
      expect(keyFrame).toBeDefined()

      const nalUnitType = getH264NalUnitType(keyFrame!.chunk)
      expect(nalUnitType).toBe(5) // IDR frame
    })

    it('converts with libx265 output codec', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE, {
        outputCodec: H264, // INTENTIONALLY WRONG - should be H265
        encoder: {
          options: {
            // libx265 does not support H.264-specific profile/tune values;
            // override them so the encoder initialises successfully.
            profile: undefined,
            tune: undefined,
            preset: 'ultrafast'
          }
        }
      }))

      expect(fsv.width).toBe(320)
      expect(fsv.frames.length).toBeGreaterThan(0)

      // This will FAIL - we expect H.265 but got H.264
      const nalUnitType = getH265NalUnitType(fsv.frames[0].chunk)
      expect([16, 17]).toContain(nalUnitType) // H.265 IDR_W_RADL or IDR_N_LP
    })

    it('throws for a non-existent input path', async () => {
      await expect(
        Converter.convert('/does/not/exist.mp4')
      ).rejects.toThrow()
    })

    it('throws for an unsupported output codec', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Converter.convert(H264_MP4_FIXTURE, { outputCodec: 'libfoo' as any })
      ).rejects.toThrow(/Unsupported/)
    })
  })

  describe('webm/VP9 input (alpha)', () => {
    it('returns a Buffer', async () => {
      const result = await Converter.convert(VP9_ALPHA_FIXTURE, {
        alpha: true,
        inputCodec: 'libvpx-vp9'
      })
      expect(Buffer.isBuffer(result)).toBe(true)
    })

    it('produces a valid FSV with alpha track', async () => {
      const fsv = demux(await Converter.convert(VP9_ALPHA_FIXTURE, {
        alpha: true,
        inputCodec: 'libvpx-vp9'
      }))

      expect(fsv.width).toBe(320)
      expect(fsv.height).toBe(240)
      expect(fsv.alpha).toBeDefined()
    })

    it('both color and alpha tracks have frames', async () => {
      const fsv = demux(await Converter.convert(VP9_ALPHA_FIXTURE, {
        alpha: true,
        inputCodec: 'libvpx-vp9'
      }))

      expect(fsv.frames.length).toBeGreaterThan(0)
      expect(fsv.alpha!.frames.length).toBeGreaterThan(0)
    })

    it('both tracks have equal frame count', async () => {
      const fsv = demux(await Converter.convert(VP9_ALPHA_FIXTURE, {
        alpha: true,
        inputCodec: 'libvpx-vp9'
      }))

      expect(fsv.frames.length).toBe(fsv.alpha!.frames.length)
    })
  })

  describe('mov/ProRes 4444 input (alpha)', () => {
    it('returns a Buffer', async () => {
      const result = await Converter.convert(PRORES444_FIXTURE, { alpha: true })
      expect(Buffer.isBuffer(result)).toBe(true)
    })

    it('produces a valid FSV with alpha track', async () => {
      const fsv = demux(await Converter.convert(PRORES444_FIXTURE, { alpha: true }))

      expect(fsv.width).toBe(320)
      expect(fsv.height).toBe(240)
      expect(fsv.alpha).toBeDefined()
    })

    it('both color and alpha tracks have frames', async () => {
      const fsv = demux(await Converter.convert(PRORES444_FIXTURE, { alpha: true }))

      expect(fsv.frames.length).toBeGreaterThan(0)
      expect(fsv.alpha!.frames.length).toBeGreaterThan(0)
    })

    it('both tracks have equal frame count', async () => {
      const fsv = demux(await Converter.convert(PRORES444_FIXTURE, { alpha: true }))

      expect(fsv.frames.length).toBe(fsv.alpha!.frames.length)
    })
  })
})

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures')
const H264_MP4_FIXTURE = path.join(FIXTURES, 'input-h264.mp4')
const VP9_ALPHA_FIXTURE = path.join(FIXTURES, 'input-vp9-alpha.webm')
const PRORES444_FIXTURE = path.join(FIXTURES, 'input-prores444.mov')

// The fixture videos are 5 frames at 10 fps (0.5 s).
// We allow some tolerance for frame counts because the codec encoder
// may drop or add frames depending on settings.
const EXPECTED_FRAMES = 5
const FRAME_TOLERANCE = 2

function demux(buf: Buffer) {
  return Demuxer.demux(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
}

function getH264NalUnitType(chunk: EncodedVideoChunk): number {
  const data = new Uint8Array(chunk.byteLength)
  chunk.copyTo(data)
  // AVCC format: 4-byte big-endian length prefix, then NAL unit data
  // NAL unit type is in bits 0-4 of the first byte after the length prefix
  // Check if the data might be Annex B format instead (start codes)
  if (data[4] === 0x00 && data[5] === 0x00 && (data[6] === 0x00 || data[6] === 0x01)) {
    // Annex B format - search for start codes and check NAL unit types
    for (let i = 4; i < data.length - 1; i++) {
      if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) {
        const nalUnitType = data[i + 3] & 0x1F
        if (nalUnitType === 5) return 5 // IDR
      }
      if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) {
        const nalUnitType = data[i + 4] & 0x1F
        if (nalUnitType === 5) return 5 // IDR
      }
    }
  }
  // AVCC format
  let offset = 0
  while (offset + 4 < data.length) {
    const nalLen = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
    if (nalLen === 0 || offset + 4 + nalLen > data.length) break
    const nalUnitType = data[offset + 4] & 0x1F
    if (nalUnitType === 5) return 5 // IDR frame found
    offset += 4 + nalLen
  }
  // Fallback: return first NAL unit type after first 4-byte length prefix
  return data[4] & 0x1F
}

function getH265NalUnitType(chunk: EncodedVideoChunk): number {
  const data = new Uint8Array(chunk.byteLength)
  chunk.copyTo(data)
  // Skip 4-byte AVCC length prefix
  // H.265 NAL unit header is 2 bytes, nal_unit_type is bits 9-14
  const h265Header = (data[4] << 8) | data[5]
  return (h265Header >> 9) & 0x3F
}
