import { describe, it, expect } from 'vitest'

import { Muxer } from '../src/core/Muxer'
import { Demuxer } from '../src/core/Demuxer'
import type { Packet } from '../src/core/Packet'

describe('Demuxer', () => {
  describe('demux (non-alpha)', () => {
    const buf = makeNonAlphaFSV(5)
    const fsv = Demuxer.demux(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)

    it('has correct width and height', () => {
      expect(fsv.width).toBe(320)
      expect(fsv.height).toBe(240)
    })

    it('has correct frame count', () => {
      expect(fsv.length).toBe(5)
      expect(fsv.frames).toHaveLength(5)
    })

    it('has correct duration', () => {
      expect(fsv.duration).toBe(500000)
    })

    it('frame[0] is a key frame', () => {
      expect(fsv.frames[0].chunk.type).toBe('key')
    })

    it('frames[1-4] are delta frames', () => {
      for (let i = 1; i < 5; i++) {
        expect(fsv.frames[i].chunk.type).toBe('delta')
      }
    })

    it('indices map contains all 5 timestamps', () => {
      expect(fsv.indices.size).toBe(5)
      for (let i = 0; i < 5; i++) {
        expect(fsv.indices.has(i * 100000)).toBe(true)
        expect(fsv.indices.get(i * 100000)).toBe(i)
      }
    })

    it('frame[0] keyIndex is 0', () => {
      expect(fsv.frames[0].keyIndex).toBe(0)
    })

    it('all frames keyIndex is 0 (single key frame at start)', () => {
      for (const frame of fsv.frames) {
        expect(frame.keyIndex).toBe(0)
      }
    })

    it('does not have an alpha track', () => {
      expect(fsv.alpha).toBeUndefined()
    })
  })

  describe('demux (alpha)', () => {
    const buf = makeAlphaFSV(5)
    const fsv = Demuxer.demux(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)

    it('has an alpha track', () => {
      expect(fsv.alpha).toBeDefined()
    })

    it('color track has 5 frames', () => {
      expect(fsv.frames).toHaveLength(5)
    })

    it('alpha track has 5 frames', () => {
      expect(fsv.alpha!.frames).toHaveLength(5)
    })

    it('alpha track has correct dimensions', () => {
      expect(fsv.alpha!.width).toBe(320)
      expect(fsv.alpha!.height).toBe(240)
    })
  })

  describe('demuxStream (non-alpha)', () => {
    it('resolves the FSV object with manifest populated', async () => {
      const buf = makeNonAlphaFSV(5)
      const reader = bufferToStream(buf)
      const { fsv, loaded } = await Demuxer.demuxStream(reader)

      await loaded()

      expect(fsv.width).toBe(320)
      expect(fsv.height).toBe(240)
      expect(fsv.length).toBe(5)
    })

    it('frames load progressively and loaded() resolves', async () => {
      const buf = makeNonAlphaFSV(5)
      const reader = bufferToStream(buf)
      const { fsv, loaded } = await Demuxer.demuxStream(reader)

      await loaded(1)
      expect(fsv.frames.length).toBeGreaterThanOrEqual(1)

      await loaded()
      expect(fsv.frames).toHaveLength(5)
    })

    it('indices map is pre-populated with all timestamps', async () => {
      const buf = makeNonAlphaFSV(5)
      const reader = bufferToStream(buf)
      const { fsv } = await Demuxer.demuxStream(reader)

      // Indices are set from manifest immediately (before frames arrive)
      expect(fsv.indices.size).toBe(5)
    })
  })

  describe('demuxStream (alpha)', () => {
    it('throws for alpha-channel FSV files', async () => {
      const buf = makeAlphaFSV(5)
      const reader = bufferToStream(buf)

      await expect(Demuxer.demuxStream(reader)).rejects.toThrow(
        'Streaming videos with alpha channel is not supported'
      )
    })
  })

  describe('error cases', () => {
    it('demuxStream throws on an unexpectedly short stream (< 8 bytes)', async () => {
      const tiny = Buffer.from([0x00, 0x01, 0x02])
      const reader = bufferToStream(tiny)

      await expect(Demuxer.demuxStream(reader)).rejects.toThrow(
        'Unexpected end of stream'
      )
    })

    it('demuxStream throws when stream ends before manifest is fully read', async () => {
      // Write a valid header claiming a large manifest, but send no manifest data
      const buf = Buffer.alloc(8)
      buf.writeUInt32LE(0, 0)           // non-alpha
      buf.writeUInt32LE(99999, 4)       // manifest length = 99999 bytes (we won't send them)
      const reader = bufferToStream(buf)

      await expect(Demuxer.demuxStream(reader)).rejects.toThrow(
        'Unexpected end of stream'
      )
    })
  })
})

const config: VideoDecoderConfig = {
  codec: 'avc1.42001f',
  codedWidth: 320,
  codedHeight: 240,
  optimizeForLatency: true
}

function makePackets(count: number, payloadSize = 32): Packet[] {
  return Array.from({ length: count }, (_, i) => ({
    data: Buffer.alloc(payloadSize, i + 1),
    timestamp: i * 100000,
    isKeyFrame: i === 0
  }))
}

function makeNonAlphaFSV(packetCount = 5): Buffer {
  return Muxer.mux(makePackets(packetCount), undefined, {
    config,
    duration: packetCount * 100000
  })
}

function makeAlphaFSV(packetCount = 5): Buffer {
  return Muxer.mux(makePackets(packetCount), makePackets(packetCount, 16), {
    config,
    duration: packetCount * 100000
  })
}

/** Wraps a Buffer into a ReadableStream for streaming tests.
 *
 * Copies into a fresh ArrayBuffer so there is no pool offset sharing with the
 * Node.js Buffer allocator — the Demuxer stream buffer relies on byteOffset=0
 * when computing DataView positions.
 */
function bufferToStream(buf: Buffer): ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> {
  const standalone = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new Uint8Array(standalone) as Uint8Array<ArrayBuffer>)
      controller.close()
    }
  })
  return stream.getReader()
}
