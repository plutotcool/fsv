import fs from 'node:fs/promises'
import type { ConsolaInstance } from 'consola'

import type {
  FFDecoderCodec,
  FFEncoderCodec,
  AVCodecID,
  Stream
} from 'node-av'

import { CodecParameters } from 'node-av'

import {
  Demuxer,
  Decoder,
  Encoder,
  FilterComplexAPI,
  type EncoderOptions
} from 'node-av/api'

import {
  AV_PIX_FMT_YUV420P,
  AV_CODEC_FLAG_GLOBAL_HEADER,
  FF_THREAD_FRAME,
  AVCOL_PRI_BT709,
  AVCOL_PRI_BT470BG,
  AVCOL_PRI_BT2020,
  AVCOL_PRI_SMPTE170M,
  AVCOL_PRI_SMPTE432,
  AVCOL_TRC_BT709,
  AVCOL_TRC_SMPTE170M,
  AVCOL_TRC_LINEAR,
  AVCOL_TRC_SMPTE2084,
  AVCOL_TRC_ARIB_STD_B67,
  AVCOL_TRC_IEC61966_2_1,
  AVCOL_SPC_BT709,
  AVCOL_SPC_BT470BG,
  AVCOL_SPC_BT2020_NCL,
  AVCOL_SPC_SMPTE170M,
  AVCOL_SPC_RGB,
  AVCOL_RANGE_JPEG,
  AVCOL_RANGE_MPEG
} from 'node-av/constants'

import type { Packet } from './Packet'
import { Muxer as FSVMuxer } from './Muxer'
import { assertCodec, DEFAULT_CODEC, H264, H265, type Codec } from './Codec'

const DEFAULT_ENCODER_OPTIONS: Record<Codec, Partial<EncoderOptions>> = {
  [H264]: {
    threadCount: 0,
    threadType: FF_THREAD_FRAME,
    gopSize: 5,
    maxBFrames: 0,
    options: {
      crf: '20',
      preset: 'slower',
      tune: 'fastdecode',
      profile: 'baseline',
      level: '5.1',
      sc_threshold: '0',
      refs: '1',
      pixel_format: AV_PIX_FMT_YUV420P
    }
  },
  [H265]: {
    threadCount: 0,
    threadType: FF_THREAD_FRAME,
    gopSize: 5,
    maxBFrames: 0,
    options: {
      crf: '20',
      preset: 'slower',
      tune: 'fastdecode',
      sc_threshold: '0',
      refs: '1',
      pixel_format: AV_PIX_FMT_YUV420P
    }
  }
}

const ALPHA_SPLIT_FILTER = (
  '[0:v]split[v1][v2];[v1]format=yuv420p[color];[v2]alphaextract,format=yuv420p[alpha]'
)

export interface ConvertOptions {
  /**
   * Whether to include an alpha track in the output.
   */
  alpha?: boolean

  /**
   * The input video format. If not specified, it will be auto-detected.
   */
  inputFormat?: string

  /**
   * The input video codec. If not specified, it will be auto-detected.
   */
  inputCodec?:
    | FFDecoderCodec
    | AVCodecID
    | Codec
    | 'libvpx-vp9'
    | 'libvpx-vp8'

  /**
   * The output video codec.
   */
  outputCodec?: Codec

  /**
   * Optional encoder settings to override the defaults.
   */
  encoder?: Partial<EncoderOptions>

  /**
   * An optional logger instance to log the conversion process.
   */
  logger?: ConsolaInstance
}

/**
 * Converts a video fsv format.
 */
export const Converter = {
  convert
}

/**
 * Converts a video to fsv format.
 *
 * @param input The input video file path or buffer.
 * @param options Conversion options.
 *
 * @returns fsv data buffer
 */
async function convert(
  input: string | Buffer,
  options?: ConvertOptions
): Promise<Buffer>

/**
 * Converts a video to fsv format.
 *
 * @param input The input video file path or buffer.
 * @param output The output fsv file path.
 * @param options Conversion options.
 */
async function convert(
  input: string | Buffer,
  output: string,
  options?: ConvertOptions
): Promise<void>

async function convert(
  input: string | Buffer,
  outputOrOptions?: string | ConvertOptions,
  options?: ConvertOptions
) {
  const output = typeof outputOrOptions === 'string'
    ? outputOrOptions
    : undefined

  options = options || (typeof outputOrOptions === 'object'
    ? outputOrOptions
    : undefined
  )

  const {
    logger
  } = options || {}

  logger?.start('Starting conversion')

  try {
    const encoded = await transcode(input, options)
    const muxed = FSVMuxer.mux(encoded.color, encoded.alpha, {
      config: encoded.config,
      duration: encoded.duration
    })

    if (output) {
      await fs.writeFile(output, muxed)
      logger?.info(`Output written to ${output}`)
    }

    logger?.success('Conversion completed')

    return output
      ? undefined as unknown as Promise<void>
      : muxed as unknown as Promise<Buffer>
  } catch (error) {
    logger?.error('Conversion failed')
    throw error
  }
}

interface TranscodeOutput {
  color: Packet[]
  alpha?: Packet[]
  config: VideoDecoderConfig
  duration: number
}

async function transcode(source: string | Buffer, {
  alpha = false,
  ...options
}: ConvertOptions = {}): Promise<TranscodeOutput> {
  if (alpha) {
    return transcodeAlpha(source, options)
  }

  const {
    inputFormat,
    inputCodec,
    outputCodec = DEFAULT_CODEC,
    encoder: encoderOptions,
    logger
  } = options

  logger?.start(`Starting encoding`)

  try {
    assertCodec(outputCodec)

    logger?.info(`Opening input with format ${inputFormat || '[auto]'}`)
    await using input = await Demuxer.open(source, {
      format: inputFormat,
      copyTs: true
    })

    const videoStream = input.video()

    if (!videoStream) {
      throw new Error('No video stream found in input')
    }

    logger?.info(`Initializing decoder with codec ${inputCodec || '[auto]'}`)
    using decoder = await Decoder.create(
      videoStream,
      inputCodec as FFDecoderCodec
    )

    logger?.info(`Initializing encoder with codec ${outputCodec}`)
    using encoder = await Encoder.create(
      outputCodec as FFEncoderCodec,
      resolveEncoderOptions(videoStream, outputCodec, encoderOptions)
    )

    // Setting AV_CODEC_FLAG_GLOBAL_HEADER causes the encoder to place SPS/PPS
    // (for H.264/H.265) in the codec context extradata rather than inlining
    // them in every keyframe.  This is required so that CodecParameters can
    // later produce the avcC / hvcC description blob used by WebCodecs.
    encoder.setCodecFlags(AV_CODEC_FLAG_GLOBAL_HEADER)

    logger?.info('Initializing filter')
    using filter = FilterComplexAPI.create('[in]format=yuv420p[out]', {
      inputs: [{ label: 'in' }],
      outputs: [{ label: 'out' }]
    })

    logger?.info('Encoding frames...')

    const packets: Packet[] = []

    const processStream = async () => {
      while (true) {
        const frame = await filter.receive('out')

        if (!frame) {
          break
        }

        await encoder.encode(frame)
        frame.free()
      }

      while (true) {
        const packet = await encoder.receive()

        if (!packet) {
          break
        }

        if (packet.data) {
          packets.push({
            data: Buffer.from(packet.data),
            timestamp: ptsToMicroseconds(packet.pts, videoStream.timeBase),
            isKeyFrame: packet.isKeyframe
          })
        }

        packet.free()
      }
    }

    let framesCount: number = 0

    for await (const frame of decoder.frames(input.packets())) {
      if (!frame) {
        continue
      }

      await filter.process('in', frame)
      await processStream()

      logger?.debug(`Encoded frame ${framesCount}`)
      frame.free()
      framesCount++
    }

    logger?.debug('Flushing filter')
    await filter.flush()
    await processStream()

    logger?.debug('Flushing encoder')
    await encoder.encode(null)
    await processStream()

    const config = extractVideoDecoderConfig(encoder)

    logger?.success(`Encoding completed`)

  return {
    color: packets,
    alpha: undefined,
    config,
    duration: streamDurationToMicroseconds(videoStream)
  }
  } catch (error) {
    logger?.error('Encoding failed')
    throw error
  }
}

async function transcodeAlpha(source: string | Buffer, {
  inputFormat,
  inputCodec,
  outputCodec = DEFAULT_CODEC,
  encoder: encoderOptions,
  logger
}: Exclude<ConvertOptions, 'alpha'> = {}): Promise<TranscodeOutput> {
  logger?.start(`Starting encoding`)

  try {
    assertCodec(outputCodec)

    logger?.info(`Opening input with format ${inputFormat || '[auto]'}`)
    await using input = await Demuxer.open(source, {
      format: inputFormat,
      copyTs: true
    })

    const videoStream = input.video()

    if (!videoStream) {
      throw new Error('No video stream found in input')
    }

    const resolvedEncoderOptions = resolveEncoderOptions(videoStream, outputCodec, encoderOptions)

    logger?.info(`Initializing decoder with codec ${inputCodec || '[auto]'}`)
    using decoder = await Decoder.create(
      videoStream,
      inputCodec as FFDecoderCodec
    )

    logger?.info(`Initializing color encoder with codec ${outputCodec}`)
    using colorEncoder = await Encoder.create(
      outputCodec as FFEncoderCodec,
      resolvedEncoderOptions
    )

    logger?.info(`Initializing alpha encoder with codec ${outputCodec}`)
    using alphaEncoder = await Encoder.create(
      outputCodec as FFEncoderCodec,
      resolvedEncoderOptions
    )

    colorEncoder.setCodecFlags(AV_CODEC_FLAG_GLOBAL_HEADER)
    alphaEncoder.setCodecFlags(AV_CODEC_FLAG_GLOBAL_HEADER)

    logger?.info('Initializing filter')
    using filter = FilterComplexAPI.create(ALPHA_SPLIT_FILTER, {
      inputs: [
        { label: '0:v'}
      ],
      outputs: [
        { label: 'color' },
        { label: 'alpha' }
      ]
    })

    logger?.info('Encoding frames')

    const colorPackets: Packet[] = []
    const alphaPackets: Packet[] = []

    const processStream = async () => {
      while (true) {
        const colorFrame = await filter.receive('color')

        if (!colorFrame) {
          break
        }

        await colorEncoder.encode(colorFrame)
        colorFrame.free()
      }

      while (true) {
        const alphaFrame = await filter.receive('alpha')

        if (!alphaFrame) {
          break
        }

        await alphaEncoder.encode(alphaFrame)
        alphaFrame.free()
      }

      while (true) {
        const packet = await colorEncoder.receive()

        if (!packet) {
          break
        }

        if (packet.data) {
          colorPackets.push({
            data: Buffer.from(packet.data),
            timestamp: ptsToMicroseconds(packet.pts, videoStream.timeBase),
            isKeyFrame: packet.isKeyframe
          })
        }

        packet.free()
      }

      while (true) {
        const packet = await alphaEncoder.receive()

        if (!packet) {
          break
        }

        if (packet.data) {
          alphaPackets.push({
            data: Buffer.from(packet.data),
            timestamp: ptsToMicroseconds(packet.pts, videoStream.timeBase),
            isKeyFrame: packet.isKeyframe
          })
        }

        packet.free()
      }
    }

    let framesCount: number = 0

    for await (const frame of decoder.frames(input.packets())) {
      if (!frame) {
        continue
      }

      await filter.process('0:v', frame)
      await processStream()

      logger?.debug(`Encoded frame ${framesCount}`)
      frame.free()
      framesCount++
    }

    logger?.debug('Flushing filter')
    await filter.flush()
    await processStream()

    logger?.debug('Flushing encoders')
    await colorEncoder.encode(null)
    await alphaEncoder.encode(null)
    await processStream()

    const config = extractVideoDecoderConfig(colorEncoder)

    logger?.success(`Encoding completed`)

  return {
    color: colorPackets,
    alpha: alphaPackets,
    config,
    duration: streamDurationToMicroseconds(videoStream)
  }
  } catch (error) {
    logger?.error('Encoding failed')
    throw error
  }
}

/**
 * Extracts a VideoDecoderConfig from an encoder whose codec context has been
 * populated with extradata (requires AV_CODEC_FLAG_GLOBAL_HEADER to be set
 * before encoding begins).
 *
 * Reads codedWidth, codedHeight and full color space information from the
 * encoder's CodecParameters so that the browser-side decoder has complete
 * metadata regardless of what options the user passed to the converter.
 */
function extractVideoDecoderConfig(encoder: Encoder): VideoDecoderConfig {
  const ctx = encoder.getCodecContext()

  if (!ctx) {
    throw new Error('Failed to get codec context from encoder')
  }

  const codecpar = new CodecParameters()
  codecpar.alloc()
  codecpar.fromContext(ctx)

  const codec = codecpar.getCodecString()
  const descriptionBuffer = codecpar.getDecoderConfigurationRecord()

  const colorSpace = extractColorSpace(codecpar)

  const config = {
    codec: codec!,
    optimizeForLatency: true,
    codedWidth: codecpar.width || undefined,
    codedHeight: codecpar.height || undefined,
    ...(descriptionBuffer
      ? { description: new Uint8Array(descriptionBuffer.buffer, descriptionBuffer.byteOffset, descriptionBuffer.byteLength) }
      : {}
    ),
    ...(colorSpace && { colorSpace })
  } as VideoDecoderConfig

  codecpar.free()

  if (!codec) {
    throw new Error('Failed to extract codec string from encoder')
  }

  return config
}

/**
 * Maps ffmpeg color parameters to a WebCodecs VideoColorSpaceInit object.
 *
 * Only sets properties that are recognized and not unspecified, so that
 * defaults are left to the browser decoder.
 */
function extractColorSpace(
  codecpar: CodecParameters
): Record<string, unknown> | undefined {
  const primaries = mapColorPrimaries(codecpar.colorPrimaries)
  const transfer = mapTransferCharacteristic(codecpar.colorTrc)
  const matrix = mapColorMatrix(codecpar.colorSpace)
  const fullRange = mapColorRange(codecpar.colorRange)

  const colorSpace: Record<string, unknown> = {
    ...(primaries !== undefined && { primaries }),
    ...(transfer !== undefined && { transfer }),
    ...(matrix !== undefined && { matrix }),
    ...(fullRange !== undefined && { fullRange })
  }

  return Object.keys(colorSpace).length > 0 ? colorSpace : undefined
}

/**
 * Maps an ffmpeg color primaries value to a WebCodecs primaries string.
 */
function mapColorPrimaries(value: number): string | undefined {
  switch (value) {
    case AVCOL_PRI_BT709:
      return 'bt709'

    case AVCOL_PRI_BT470BG:
      return 'bt470bg'

    case AVCOL_PRI_BT2020:
      return 'bt2020'

    case AVCOL_PRI_SMPTE170M:
      return 'smpte170m'

    case AVCOL_PRI_SMPTE432:
      return 'smpte432'

    default:
      return undefined
  }
}

/**
 * Maps an ffmpeg transfer characteristic value to a WebCodecs transfer string.
 */
function mapTransferCharacteristic(value: number): string | undefined {
  switch (value) {
    case AVCOL_TRC_BT709:
      return 'bt709'

    case AVCOL_TRC_IEC61966_2_1:
      return 'iec61966-2-1'

    case AVCOL_TRC_SMPTE170M:
      return 'smpte170m'

    case AVCOL_TRC_LINEAR:
      return 'linear'

    case AVCOL_TRC_SMPTE2084:
      return 'pq'

    case AVCOL_TRC_ARIB_STD_B67:
      return 'hlg'

    default:
      return undefined
  }
}

/**
 * Maps an ffmpeg color space (matrix coefficients) value to a WebCodecs matrix
 * string.
 */
function mapColorMatrix(value: number): string | undefined {
  switch (value) {
    case AVCOL_SPC_BT709:
      return 'bt709'

    case AVCOL_SPC_BT470BG:
      return 'bt470bg'

    case AVCOL_SPC_BT2020_NCL:
      return 'bt2020-ncl'

    case AVCOL_SPC_SMPTE170M:
      return 'smpte170m'

    case AVCOL_SPC_RGB:
      return 'rgb'

    default:
      return undefined
  }
}

/**
 * Maps an ffmpeg color range value to a WebCodecs fullRange boolean.
 */
function mapColorRange(value: number): boolean | undefined {
  switch (value) {
    case AVCOL_RANGE_JPEG:
      return true

    case AVCOL_RANGE_MPEG:
      return false

    default:
      return undefined
  }
}

/**
 * Converts a packet PTS (in stream time-base units) to microseconds.
 */
function ptsToMicroseconds(
  pts: bigint,
  timeBase: { num: number, den: number }
): number {
  return Number(pts * BigInt(timeBase.num) * 1_000_000n / BigInt(timeBase.den))
}

/**
 * Converts a stream duration (in stream time-base units) to microseconds.
 * Falls back to 0 if the duration is not available (AV_NOPTS_VALUE).
 */
function streamDurationToMicroseconds(stream: Stream): number {
  // AV_NOPTS_VALUE is the minimum int64 value used by ffmpeg when the
  // duration is unknown.
  const AV_NOPTS_VALUE = BigInt('-9223372036854775808')
  const { duration, timeBase } = stream

  if (duration === AV_NOPTS_VALUE) {
    return 0
  }

  return Number(
    duration * BigInt(timeBase.num) * 1_000_000n / BigInt(timeBase.den)
  )
}

function resolveEncoderOptions(
  stream: Stream,
  codec: Codec,
  encoderOptions?: Partial<EncoderOptions>
): EncoderOptions {
  const defaultEncoderOptions = DEFAULT_ENCODER_OPTIONS[codec]

  return {
    ...defaultEncoderOptions,
    timeBase: stream.timeBase,
    frameRate: stream.avgFrameRate,
    ...encoderOptions,
    options: {
      ...defaultEncoderOptions?.options,
      ...encoderOptions?.options
    }
  } as EncoderOptions
}
