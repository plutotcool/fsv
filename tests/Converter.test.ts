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

      const nalUnitType = getH264NalUnitType(fsv.frames[0].chunk)
      expect(nalUnitType).toBe(5) // IDR slice
    })

    it('converts with libx265 output codec', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE, {
        outputCodec: H265,
        encoder: {
          options: {
            // @todo: Adjust default encoder options depending on the chosen output codec
            // See issue #22
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

      const nalUnitType = getH265NalUnitType(fsv.frames[0].chunk)
      expect([19, 20]).toContain(nalUnitType) // IDR_W_RADL (19) or IDR_N_LP (20)
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
  // AVCC format: each NAL unit is preceded by a 4-byte big-endian length.
  // H.264 NAL unit header is 1 byte: forbidden_zero_bit(1) | nal_ref_idc(2) | nal_unit_type(5)
  // Iterate all NAL units; prefer returning an IDR slice (type 5) over other types.
  let firstType = -1
  let offset = 0
  while (offset + 4 < data.length) {
    const nalLen = ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
    if (nalLen === 0 || offset + 4 + nalLen > data.length) break
    const nalType = data[offset + 4] & 0x1F
    if (firstType === -1) firstType = nalType
    if (nalType === 5) return 5 // IDR slice — return immediately
    offset += 4 + nalLen
  }
  return firstType
}

function getH265NalUnitType(chunk: EncodedVideoChunk): number {
  const data = new Uint8Array(chunk.byteLength)
  chunk.copyTo(data)
  // AVCC format: each NAL unit is preceded by a 4-byte big-endian length.
  // H.265 NAL unit header is 2 bytes (big-endian 16-bit value):
  //   bit 15       : forbidden_zero_bit
  //   bits 14–9    : nal_unit_type (6 bits)  →  (header >> 9) & 0x3F
  //   bits 8–3     : nuh_layer_id
  //   bits 2–0     : nuh_temporal_id_plus1
  // IDR_W_RADL = 19, IDR_N_LP = 20
  // Iterate all NAL units; prefer returning an IDR type over other types.
  let firstType = -1
  let offset = 0
  while (offset + 5 < data.length) {
    const nalLen = ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
    if (nalLen === 0 || offset + 4 + nalLen > data.length) break
    const header = (data[offset + 4] << 8) | data[offset + 5]
    const nalType = (header >> 9) & 0x3F
    if (firstType === -1) firstType = nalType
    if (nalType === 19 || nalType === 20) return nalType // IDR_W_RADL or IDR_N_LP
    offset += 4 + nalLen
  }
  return firstType
}
