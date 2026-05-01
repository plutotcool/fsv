import type { Packet } from './Packet'
import { stringifyManifest, type ManifestFrame } from './Manifest'

/**
 * Options for muxing raw packets into fsv format.
 */
export interface MuxOptions {
  /**
   * The VideoDecoderConfig used by the browser-side decoder.
   *
   * The `codec` string and optional `description` (avcC / hvcC box) are
   * obtained from the encoder's CodecParameters after encoding is complete.
   * The `codedWidth`, `codedHeight` and `colorSpace` are also populated
   * from the encoder so that the browser-side decoder has complete metadata.
   */
  config: VideoDecoderConfig

  /**
   * Total duration of the video in microseconds.
   */
  duration: number
}

/**
 * Muxes to fsv format.
 */
export const Muxer = {
  mux
}

/**
 * Muxes raw encoded video packets into fsv format.
 *
 * Each packet's Annex B bitstream is converted to AVCC format
 * (4-byte big-endian length prefixes) before being packed.
 *
 * @param packets The encoded color (or only) track packets.
 * @param alphaPackets Optional encoded alpha track packets.
 * @param options Mux options including VideoDecoderConfig and duration.
 *
 * @returns A Buffer containing the muxed fsv data.
 */
function mux(
  packets: Packet[],
  alphaPackets: Packet[] | undefined,
  options: MuxOptions
): Buffer {
  const colorBuffer = muxTrack(packets, options)

  if (!alphaPackets) {
    return colorBuffer
  }

  const alphaBuffer = muxTrack(alphaPackets, options)
  const headerBuffer = Buffer.alloc(4)

  headerBuffer.writeUInt32LE(colorBuffer.byteLength + 4)

  return Buffer.concat([
    headerBuffer,
    colorBuffer,
    alphaBuffer
  ])
}

function muxTrack(packets: Packet[], {
  config,
  duration
}: MuxOptions): Buffer {
  const chunks: Buffer[] = []
  const frames: ManifestFrame[] = []

  for (const packet of packets) {
    const data = Buffer.from(annexBToAVCC(packet.data))

    const previous = frames[frames.length - 1]

    chunks.push(data)
    frames.push({
      offset: previous ? previous.offset + previous.byteLength : 0,
      byteLength: data.byteLength,
      timestamp: packet.timestamp,
      type: packet.isKeyFrame ? 'key' : 'delta'
    })
  }

  const chunksBuffer = Buffer.concat(chunks)
  const headerBuffer = Buffer.alloc(8)
  const manifestBuffer = Buffer.from(stringifyManifest({
    config,
    width: config.codedWidth!,
    height: config.codedHeight!,
    duration,
    frames
  }))

  headerBuffer.writeUInt32LE(manifestBuffer.byteLength, 4)

  return Buffer.concat([
    headerBuffer,
    manifestBuffer,
    chunksBuffer
  ])
}

/**
 * Converts an Annex B bitstream to AVCC format.
 *
 * Annex B uses start codes (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01) as NAL
 * unit delimiters. AVCC replaces each start code with a 4-byte big-endian NAL
 * unit length prefix, which is the format expected by WebCodecs.
 *
 * @param data The Annex B bitstream buffer.
 * @returns A new buffer containing the equivalent AVCC-formatted data.
 */
function annexBToAVCC(data: Uint8Array): Uint8Array {
  const nalDataOffset: number[] = []
  const nalCodeLen: number[] = []

  let i = 0

  while (i < data.length - 2) {
    if (data[i] === 0x00 && data[i + 1] === 0x00) {
      if (i + 3 < data.length && data[i + 2] === 0x00 && data[i + 3] === 0x01) {
        nalDataOffset.push(i + 4)
        nalCodeLen.push(4)
        i += 4
        continue
      }

      if (data[i + 2] === 0x01) {
        nalDataOffset.push(i + 3)
        nalCodeLen.push(3)
        i += 3
        continue
      }
    }

    i++
  }

  if (nalDataOffset.length === 0) {
    return data
  }

  let totalSize = 0

  for (let n = 0; n < nalDataOffset.length; n++) {
    const end = n + 1 < nalDataOffset.length
      ? nalDataOffset[n + 1] - nalCodeLen[n + 1]
      : data.length

    totalSize += 4 + (end - nalDataOffset[n])
  }

  const output = new Uint8Array(totalSize)
  const view = new DataView(output.buffer)
  let offset = 0

  for (let n = 0; n < nalDataOffset.length; n++) {
    const end = n + 1 < nalDataOffset.length
      ? nalDataOffset[n + 1] - nalCodeLen[n + 1]
      : data.length

    const nalLen = end - nalDataOffset[n]

    view.setUint32(offset, nalLen, false)
    output.set(data.subarray(nalDataOffset[n], end), offset + 4)
    offset += 4 + nalLen
  }

  return output
}
