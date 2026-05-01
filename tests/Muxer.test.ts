import { describe, it, expect } from 'vitest'

import { Muxer } from '../src/core/Muxer'
import { parseManifest } from '../src/core/Manifest'
import type { Packet } from '../src/core/Packet'

describe('Muxer', () => {
  describe('non-alpha mux (H.264)', () => {
    const packets = makePackets(5, () => makeAnnexBPacket(0x65, 20))
    const buffer = Muxer.mux(packets, undefined, {
      config,
      duration: 500000
    })

    it('returns a Buffer', () => {
      expect(Buffer.isBuffer(buffer)).toBe(true)
    })

    it('first 4 bytes of track header are 0 (non-alpha discriminator)', () => {
      // Non-alpha: the raw track buffer is returned directly.
      // The track layout is: [4 bytes = 0][4 bytes = manifestLength][manifest][data]
      const discriminator = buffer.readUInt32LE(0)
      expect(discriminator).toBe(0)
    })

    it('manifest parses to correct width/height/frame count', () => {
      const manifestLength = buffer.readUInt32LE(4)
      const manifestJson = buffer.subarray(8, 8 + manifestLength).toString('utf8')
      const manifest = parseManifest(manifestJson)

      expect(manifest.width).toBe(320)
      expect(manifest.height).toBe(240)
      expect(manifest.duration).toBe(500000)
      expect(manifest.frames).toHaveLength(5)
    })

    it('first frame is key, remaining are delta', () => {
      const manifestLength = buffer.readUInt32LE(4)
      const manifestJson = buffer.subarray(8, 8 + manifestLength).toString('utf8')
      const manifest = parseManifest(manifestJson)

      expect(manifest.frames[0].type).toBe('key')
      for (let i = 1; i < manifest.frames.length; i++) {
        expect(manifest.frames[i].type).toBe('delta')
      }
    })

    it('packet data is AVCC-formatted (no Annex B 4-byte start codes)', () => {
      const manifestLength = buffer.readUInt32LE(4)
      const dataStart = 8 + manifestLength
      const manifest = parseManifest(buffer.subarray(8, dataStart).toString('utf8'))
      const frame0 = manifest.frames[0]

      const nalBytes = buffer.subarray(
        dataStart + frame0.offset,
        dataStart + frame0.offset + frame0.byteLength
      )

      // AVCC: first 4 bytes are a big-endian NAL length, not a start code
      const nalLen = nalBytes.readUInt32BE(0)
      expect(nalLen).toBeGreaterThan(0)
      // Original Annex B start code pattern must NOT appear at offset 0
      expect(
        nalBytes[0] === 0x00 && nalBytes[1] === 0x00 &&
        nalBytes[2] === 0x00 && nalBytes[3] === 0x01
      ).toBe(false)
    })
  })

  describe('alpha mux (H.264)', () => {
    const colorPackets = makePackets(5, () => makeAnnexBPacket(0x65, 20))
    const alphaPackets = makePackets(5, () => makeAnnexBPacket(0x65, 15))
    const buffer = Muxer.mux(colorPackets, alphaPackets, {
      config,
      duration: 500000
    })

    it('first 4 bytes = color track buffer offset (non-zero)', () => {
      const alphaOffset = buffer.readUInt32LE(0)
      expect(alphaOffset).toBeGreaterThan(0)
    })

    it('color track starts at byte offset 4', () => {
      // Color track header is at offset 4; first 4 bytes of that track should be 0
      const colorTrackDiscriminator = buffer.readUInt32LE(4)
      expect(colorTrackDiscriminator).toBe(0)
    })

    it('alpha track manifest parses correctly', () => {
      const alphaOffset = buffer.readUInt32LE(0)
      const alphaManifestLength = buffer.readUInt32LE(alphaOffset + 4)
      const alphaManifestJson = buffer
        .subarray(alphaOffset + 8, alphaOffset + 8 + alphaManifestLength)
        .toString('utf8')
      const alphaManifest = parseManifest(alphaManifestJson)

      expect(alphaManifest.frames).toHaveLength(5)
      expect(alphaManifest.width).toBe(320)
    })
  })
})

const config: VideoDecoderConfig = {
  codec: 'avc1.42001f',
  codedWidth: 320,
  codedHeight: 240,
  optimizeForLatency: true
}

function makePackets(count: number, factory: (i: number) => Buffer): Packet[] {
  return Array.from({ length: count }, (_, i) => ({
    data: factory(i),
    timestamp: i * 100000,
    isKeyFrame: i === 0
  }))
}

/**
 * Builds a minimal Annex B H.264 NAL unit buffer.
 *
 * Structure: [0x00 0x00 0x00 0x01] [nal_type_byte] [payload…]
 */
function makeAnnexBPacket(nalType: number, payloadSize: number): Buffer {
  const buf = Buffer.alloc(4 + 1 + payloadSize)
  buf[2] = 0x00
  buf[3] = 0x01
  buf[4] = nalType
  buf.fill(0xab, 5)
  return buf
}

