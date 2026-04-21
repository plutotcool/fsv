import { parseManifest, type Manifest, type ManifestFrame } from './Manifest'
import type { FSV, FSVTrack } from './FSV'

/**
 * Demuxes from fsv format.
 */
export const Demuxer = {
  demux,
  demuxStream
}

/**
 * Demuxes fsv data into an FSV object ready to decode.
 *
 * @param data The fsv data to demux.
 *
 * @return An object containing the demuxed FSV data ready to decode.
 */
function demux(data: ArrayBuffer): FSV {
  const header = new DataView(data, 0, 4)
  const alphaOffset = header.getUint32(0, true)

  const color = demuxTrack(data, alphaOffset ? 4 : 0)

  if (!alphaOffset) {
    return color
  }

  const alpha = demuxTrack(data, alphaOffset)

  return {
    ...color,
    alpha
  }
}

function demuxTrack(
  data: ArrayBuffer,
  offset: number
): FSVTrack {
  const {
    manifest,
    byteLength: manifestOffset
  } = extractManifest(data, offset)

  offset += 8 + manifestOffset

  const fsv: FSVTrack = {
    config: manifest.config,
    width: manifest.width,
    height: manifest.height,
    duration: manifest.duration,
    length: manifest.frames.length,
    indices: new Map(),
    frames: []
  }

  let keyIndex: number = 0

  for (let index = 0; index < manifest.frames.length; index++) {
    const frame = manifest.frames[index]

    if (frame.type === 'key') {
      keyIndex = index
    }

    fsv.indices.set(frame.timestamp, index)

    fsv.frames.push({
      keyIndex,
      chunk: new EncodedVideoChunk({
        type: frame.type,
        timestamp: frame.timestamp,
        data: new Uint8Array(data, frame.offset + offset, frame.byteLength)
      })
    })
  }

  return fsv
}

/**
 * Demuxes fsv data from a stream into an FSV object ready to decode.
 *
 * @param reader The reader of the stream to read the fsv data from.
 * @param byteLength The total byte length of the fsv data in the stream.
 * @param onLoadFrames Optional callback that is called whenever new frames are
 *        made available.
 *
 * @return A promise that resolves when the video data has started being read
 *         from the stream.
 */
async function demuxStream(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
  byteLength: number,
  onLoadFrames?: () => void
): Promise<{
  /**
   * The FSV object with the frames progressively made available as they are
   * loaded from the stream.
   */
  fsv: FSV

  /**
   * A function that returns a promise resolving when the specified number of
   * frames have been loaded.
   *
   * @param length The number of frames to wait for. If not specified, waits
   *        for all frames to be loaded.
   *
   * @returns A promise that resolves when the specified number of frames have
   *          been loaded.
   */
  loaded(length?: number): Promise<void>
}> {
  const buffer = createStreamBuffer()

  while (buffer.byteLength < 8) {
    const { done, value } = await reader.read()

    if (done) {
      throw new Error('Unexpected end of stream reading header')
    }

    buffer.write(value)
  }

  const headerData = buffer.view(0, 8)
  const alphaOffset = headerData.getUint32(0, true)

  if (alphaOffset) {
    throw new Error('Streaming videos with alpha channel is not supported')
  }

  const manifestLength = headerData.getUint32(4, true)
  const manifestEndOffset = manifestLength + 8

  while (buffer.byteLength < manifestEndOffset) {
    const { done, value } = await reader.read()

    if (done) {
      throw new Error('Unexpected end of stream reading manifest')
    }

    buffer.write(value)
  }

  const { manifest } = extractManifest(buffer.data.buffer, 0)

  buffer.splice(manifestEndOffset)

  const fsv: FSV = {
    config: manifest.config,
    width: manifest.width,
    height: manifest.height,
    duration: manifest.duration,
    length: manifest.frames.length,
    indices: new Map(),
    frames: []
  }

  for (let index = 0; index < manifest.frames.length; index++) {
    fsv.indices.set(manifest.frames[index].timestamp, index)
  }

  const queue = createStreamQueue(fsv)

  let keyIndex: number = 0
  let loadingFrameIndex: number = 0
  let loadingFrame: ManifestFrame | undefined = manifest.frames[0]

  const writeFrames = () => {
    let loadedFrame = false

    while (
      loadingFrame &&
      buffer.byteLength > loadingFrame.offset + loadingFrame.byteLength
    ) {
      const frame = manifest.frames[loadingFrameIndex]
      loadedFrame = true

      if (frame.type === 'key') {
        keyIndex = loadingFrameIndex
      }

      fsv.frames.push({
        keyIndex,
        chunk: new EncodedVideoChunk({
          type: frame.type,
          timestamp: frame.timestamp,
          data: buffer.chunk(frame.offset, frame.byteLength)
        })
      })

      loadingFrame = manifest.frames[++loadingFrameIndex]
    }

    if (loadingFrame) {
      buffer.dispose(loadingFrame.offset)
    } else {
      buffer.flush()
    }

    if (loadedFrame) {
      onLoadFrames?.()
      queue.update()
    }
  }

  (async () => {
    writeFrames()

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer.write(value)
      writeFrames()
    }
  })()

  return {
    fsv,
    loaded: queue.loaded
  }
}

function extractManifest(
  data: ArrayBufferLike,
  offset: number
): {
  byteLength: number
  manifest: Manifest
} {
  const header = new DataView(data, offset)
  const byteLength = header.getUint32(4, true)
  const manifest = parseManifest(
    new TextDecoder().decode(new Uint8Array(data, offset + 8, byteLength))
  )

  return {
    byteLength,
    manifest
  }
}

function createStreamBuffer() {
  const buffer = {
    chunks: [] as Uint8Array[],
    byteOffset: 0,
    byteLength: 0,

    get data() {
      buffer.reduce()
      return buffer.chunks[0]
    },

    write(chunk: Uint8Array) {
      buffer.chunks.push(chunk)
      buffer.byteLength += chunk.byteLength
    },

    dispose(offset: number) {
      buffer.chunks = [buffer.data.slice(offset - buffer.byteOffset)]
      buffer.byteOffset = Math.max(buffer.byteOffset, offset)
    },

    splice(offset: number) {
      buffer.chunks = [buffer.data.slice(offset - buffer.byteOffset)]
      buffer.byteOffset = 0
      buffer.byteLength -= offset
    },

    flush() {
      buffer.chunks = []
    },

    chunk(byteOffset: number, byteLength: number) {
      return new Uint8Array(
        buffer.data.buffer,
        byteOffset - buffer.byteOffset,
        byteLength
      )
    },

    view(byteOffset: number, byteLength: number) {
      return new DataView(
        buffer.data.buffer,
        byteOffset - buffer.byteOffset,
        byteLength
      )
    },

    reduce() {
      if (buffer.chunks.length < 2) {
        return
      }

      const reduced = new Uint8Array(buffer.byteLength - buffer.byteOffset)
      let byteOffset = 0

      for (const chunk of buffer.chunks) {
        reduced.set(chunk, byteOffset)
        byteOffset += chunk.byteLength
      }

      buffer.chunks = [reduced]
    }
  }

  return buffer
}

function createStreamQueue(fsv: FSV) {
  const queue = new Map<() => void, number>()

  return {
    loaded(length: number = fsv.length) {
      return length <= fsv.frames.length
        ? Promise.resolve()
        : new Promise<void>(resolve => queue.set(resolve, length))
    },

    update() {
      const trash: (() => void)[] = []

      for (const [resolve, length] of queue) {
        if (length <= fsv.frames.length) {
          resolve()
          trash.push(resolve)
        }
      }

      for (const resolve of trash) {
        queue.delete(resolve)
      }
    }
  }
}
