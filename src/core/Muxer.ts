import {
  WebMDemuxer,
  Mp4Demuxer,
  type EncodedVideoChunk
} from '@napi-rs/webcodecs'

import { stringifyManifest, type ManifestFrame } from './Manifest'

const DEMUXERS = {
  mp4: Mp4Demuxer,
  webm: WebMDemuxer
}

/**
 * The supported video file types that can be muxed into fsv format.
 */
export type MuxerType = keyof typeof DEMUXERS

/**
 * Muxes to fsv format.
 */
export const Muxer = {
  mux
}

/**
 * Muxes video into fsv from mp4 or webm data.
 *
 * @param type The type of the input video data.
 * @param data The video data to mux.
 * @param alpha Optional alpha video data to mux.
 * @param framesCount Optional number of frames in the video. Used to mitigate
 *                    the issue of some demuxers resolving before having
 *                    outputted all frames.
 *
 * @return A promise that resolves to a Buffer containing the muxed fsv data.
 */
async function mux(
  type: MuxerType,
  data: Buffer,
  alpha?: Buffer,
  framesCount?: number
) {
  const colorBuffer = await muxTrack(type, data, framesCount)

  if (!alpha) {
    return colorBuffer
  }

  const alphaBuffer = await muxTrack(type, alpha, framesCount)
  const headerBuffer = Buffer.alloc(4)

  headerBuffer.writeUInt32LE(colorBuffer.byteLength + 4, 0)

  return Buffer.concat([
    headerBuffer,
    colorBuffer,
    alphaBuffer
  ])
}

async function muxTrack(
  type: MuxerType,
  data: Buffer,
  framesCount?: number
): Promise<Buffer> {
  const chunks: Buffer[] = []
  const frames: ManifestFrame[] = []
  const demuxerInit = {
    error: (error: Error) => console.error(error),
    videoOutput: (chunk: EncodedVideoChunk) => {
      const buffer = Buffer.alloc(chunk.byteLength)
      const previous = frames[frames.length - 1]

      chunk.copyTo(buffer)
      chunks.push(buffer)
      frames.push({
        offset: previous ? previous.offset + previous.byteLength : 0,
        byteLength: chunk.byteLength,
        timestamp: chunk.timestamp,
        type: chunk.type
      })
    }
  }

  let demuxer: Mp4Demuxer | WebMDemuxer

  switch (type) {
    case 'mp4':
      demuxer = new Mp4Demuxer(demuxerInit)
      break

    case 'webm':
      demuxer = new WebMDemuxer(demuxerInit)
      break

    default:
      throw new Error(`Unsupported mux type "${type}"`)
  }

  await demuxer.loadBuffer(data)

  const track = demuxer.tracks.find(track => track.trackType === 'video')

  if (!track) {
    throw new Error('No video track found')
  }

  demuxer.selectVideoTrack(track.index)
  await demuxer.demuxAsync()

  await new Promise<void>((resolve) => {
    if (!framesCount) {
      setTimeout(resolve, 500)
      return
    }

    if (frames.length >= framesCount) {
      resolve()
    }

    const start = Date.now()

    const interval = setInterval(() => {
      if (frames.length >= framesCount || Date.now() - start > 10000) {
        clearInterval(interval)
        resolve()
      }
    }, 10)
  })

  const chunksBuffer = Buffer.concat(chunks)
  const headerBuffer = Buffer.alloc(8)
  const manifestBuffer = Buffer.from(stringifyManifest({
    config: demuxer.videoDecoderConfig!,
    width: track.codedWidth!,
    height: track.codedHeight!,
    duration: demuxer.duration!,
    frames
  }))

  headerBuffer.writeUInt32LE(manifestBuffer.byteLength, 4)

  demuxer.close()

  return Buffer.concat([
    headerBuffer,
    manifestBuffer,
    chunksBuffer
  ])
}
