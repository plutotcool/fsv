import { describe, it, expect } from 'vitest'

import {
  serializeManifest,
  deserializeManifest,
  stringifyManifest,
  parseManifest,
  type Manifest
} from '../src/core/Manifest'

describe('Manifest', () => {
  describe('serializeManifest / deserializeManifest', () => {
    it('roundtrips a manifest without description', () => {
      const serialized = serializeManifest(baseManifest)
      const deserialized = deserializeManifest(serialized)

      expect(deserialized.width).toBe(baseManifest.width)
      expect(deserialized.height).toBe(baseManifest.height)
      expect(deserialized.duration).toBe(baseManifest.duration)
      expect(deserialized.config.codec).toBe(baseManifest.config.codec)
      expect(deserialized.config.codedWidth).toBe(baseManifest.config.codedWidth)
      expect(deserialized.config.codedHeight).toBe(baseManifest.config.codedHeight)
      expect(deserialized.config.description).toBeUndefined()
      expect(deserialized.frames).toHaveLength(5)
      expect(deserialized.frames[0]).toEqual(baseManifest.frames[0])
      expect(deserialized.frames[4]).toEqual(baseManifest.frames[4])
    })

    it('roundtrips a manifest with a binary description', () => {
      const description = new Uint8Array([0x01, 0x42, 0x00, 0x1f, 0x03])
      const manifest: Manifest = {
        ...baseManifest,
        config: { ...baseConfig, description }
      }

      const serialized = serializeManifest(manifest)

      expect(Array.isArray(serialized.config.description)).toBe(true)
      expect(serialized.config.description).toEqual([0x01, 0x42, 0x00, 0x1f, 0x03])

      const deserialized = deserializeManifest(serialized)

      expect(deserialized.config.description).toBeInstanceOf(Uint8Array)
      expect(deserialized.config.description).toEqual(description)
    })

    it('roundtrips a manifest with no frames (empty)', () => {
      const manifest: Manifest = { ...baseManifest, frames: [] }
      const deserialized = deserializeManifest(serializeManifest(manifest))

      expect(deserialized.frames).toHaveLength(0)
    })

    it('roundtrips a manifest with all key frames', () => {
      const manifest: Manifest = {
        ...baseManifest,
        frames: baseManifest.frames.map(f => ({ ...f, type: 'key' as const }))
      }
      const deserialized = deserializeManifest(serializeManifest(manifest))

      expect(deserialized.frames.every(f => f.type === 'key')).toBe(true)
    })

    it('roundtrips a manifest with all delta frames', () => {
      const manifest: Manifest = {
        ...baseManifest,
        frames: baseManifest.frames.map(f => ({ ...f, type: 'delta' as const }))
      }
      const deserialized = deserializeManifest(serializeManifest(manifest))

      expect(deserialized.frames.every(f => f.type === 'delta')).toBe(true)
    })
  })

  describe('stringifyManifest / parseManifest', () => {
    it('roundtrips a manifest through JSON string', () => {
      const json = stringifyManifest(baseManifest)

      expect(typeof json).toBe('string')

      const parsed = parseManifest(json)

      expect(parsed.width).toBe(320)
      expect(parsed.height).toBe(240)
      expect(parsed.duration).toBe(500000)
      expect(parsed.frames).toHaveLength(5)
      expect(parsed.frames[0].type).toBe('key')
      expect(parsed.frames[0].timestamp).toBe(0)
      expect(parsed.frames[1].type).toBe('delta')
      expect(parsed.frames[1].timestamp).toBe(100000)
    })

    it('produces valid JSON', () => {
      const json = stringifyManifest(baseManifest)

      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('encodes frames as a flat number array', () => {
      const json = stringifyManifest(baseManifest)
      const raw = JSON.parse(json)

      expect(Array.isArray(raw.frames)).toBe(true)
      // Each frame contributes 4 numbers: offset, byteLength, timestamp, type
      expect(raw.frames).toHaveLength(5 * 4)
      // First frame: key → type=1
      expect(raw.frames[3]).toBe(1)
      // Second frame: delta → type=0
      expect(raw.frames[7]).toBe(0)
    })
  })
})

const baseConfig: VideoDecoderConfig = {
  codec: 'vp09.00.10.08',
  codedWidth: 320,
  codedHeight: 240,
  optimizeForLatency: true
}

const baseManifest: Manifest = {
  config: baseConfig,
  width: 320,
  height: 240,
  duration: 500000,
  frames: [
    { offset: 0,   byteLength: 100, timestamp: 0,      type: 'key' },
    { offset: 100, byteLength: 50,  timestamp: 100000, type: 'delta' },
    { offset: 150, byteLength: 60,  timestamp: 200000, type: 'delta' },
    { offset: 210, byteLength: 45,  timestamp: 300000, type: 'delta' },
    { offset: 255, byteLength: 55,  timestamp: 400000, type: 'delta' }
  ]
}
