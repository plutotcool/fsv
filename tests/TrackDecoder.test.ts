import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { TrackDecoder } from '../src/core/TrackDecoder'
import type { FSVTrack } from '../src/core/FSV'

const originalVideoDecoder = globalThis.VideoDecoder

describe('TrackDecoder', () => {
  beforeEach(() => {
    MockVideoDecoder.instances = []
    globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder
  })

  afterAll(() => {
    if (originalVideoDecoder) {
      globalThis.VideoDecoder = originalVideoDecoder
    } else {
      Reflect.deleteProperty(globalThis, 'VideoDecoder')
    }
  })

  it('creates a new VideoDecoder when the current decoder was closed', async () => {
    const decoder = new TrackDecoder(() => {})
    await decoder.load(makeTrack())

    const initialDecoder = MockVideoDecoder.instances[0]
    initialDecoder.state = 'closed'

    decoder.set(0)

    expect(MockVideoDecoder.instances).toHaveLength(2)
    expect(initialDecoder.decodedTimestamps).toEqual([])
    expect(MockVideoDecoder.instances[1].decodedTimestamps).toEqual([0])
  })

  it('replays from the key frame after recreating a closed decoder', async () => {
    const decoder = new TrackDecoder(() => {})
    await decoder.load(makeTrack())

    decoder.currentFrame = 1
    MockVideoDecoder.instances[0].state = 'closed'

    decoder.set(2)

    expect(MockVideoDecoder.instances[1].decodedTimestamps).toEqual([0, 1, 2])
  })
})

const config: VideoDecoderConfig = {
  codec: 'avc1.42001f',
  codedWidth: 320,
  codedHeight: 240,
  optimizeForLatency: true
}

class MockVideoDecoder {
  static instances: MockVideoDecoder[] = []

  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured'
  decodeQueueSize = 0
  decodedTimestamps: number[] = []

  constructor(_init: VideoDecoderInit) {
    MockVideoDecoder.instances.push(this)
  }

  configure(_config: VideoDecoderConfig): void {
    if (this.state === 'closed') {
      throw new Error('Cannot configure a closed decoder')
    }

    this.state = 'configured'
  }

  reset(): void {
    if (this.state === 'closed') {
      throw new Error('Cannot reset a closed decoder')
    }

    this.decodeQueueSize = 0
  }

  decode(chunk: EncodedVideoChunk): void {
    if (this.state !== 'configured') {
      throw new Error('Cannot decode with an unconfigured decoder')
    }

    this.decodedTimestamps.push(chunk.timestamp)
  }

  close(): void {
    this.state = 'closed'
  }

  static async isConfigSupported(
    config: VideoDecoderConfig
  ): Promise<VideoDecoderSupport> {
    return { config, supported: true }
  }
}

function makeTrack(length = 3): FSVTrack {
  const indices = new Map<number, number>()
  const frames = Array.from({ length }, (_, index) => {
    indices.set(index, index)

    return {
      keyIndex: 0,
      chunk: new EncodedVideoChunk({
        type: index === 0 ? 'key' : 'delta',
        timestamp: index,
        data: new Uint8Array([index])
      })
    }
  })

  return {
    config,
    width: 320,
    height: 240,
    duration: length,
    length,
    indices,
    frames
  }
}
