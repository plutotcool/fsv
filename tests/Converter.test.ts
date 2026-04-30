import path from 'node:path'
import { describe, it, expect } from 'vitest'

import { Converter } from '../src/core/Converter'
import { Demuxer } from '../src/core/Demuxer'

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

    it('converts with libx265 output codec', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE, {
        outputCodec: 'libx265',
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
    })

    it('converts with libvpx-vp9 output codec', async () => {
      const fsv = demux(await Converter.convert(H264_MP4_FIXTURE, {
        outputCodec: 'libvpx-vp9',
        encoder: {
          options: {
            // VP9 does not support tune:fastdecode or H.264 profile values;
            // override them so the encoder initialises successfully.
            profile: undefined,
            tune: undefined
          }
        }
      }))

      expect(fsv.width).toBe(320)
      expect(fsv.frames.length).toBeGreaterThan(0)
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
      ).rejects.toThrow(/[Uu]nsupported/)
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
