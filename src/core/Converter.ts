import fs from 'node:fs/promises'
import os from 'node:os'
import crypto from 'node:crypto'
import type { ConsolaInstance } from 'consola'

import type {
  FFDecoderCodec,
  FFEncoderCodec,
  AVCodecID,
  Codec,
  Stream
} from 'node-av'

import {
  Demuxer,
  Decoder,
  Encoder,
  Muxer,
  FilterComplexAPI,
  type EncoderOptions
} from 'node-av/api'

import {
  AV_PIX_FMT_YUV420P,
  FF_ENCODER_LIBX264,
  FF_ENCODER_LIBX265,
  FF_ENCODER_LIBVPX_VP8,
  FF_ENCODER_LIBVPX_VP9,
  FF_THREAD_FRAME
} from 'node-av/constants'

import { Muxer as FSVMuxer } from './Muxer'

const DEFAULT_OUTPUT_CODEC = FF_ENCODER_LIBX264
const ALPHA_SPLIT_FILTER = (
  '[0:v]split[v1][v2];[v1]format=yuv420p[color];[v2]alphaextract,format=yuv420p[alpha]'
)

export const OUTPUT_CODECS = [
  FF_ENCODER_LIBX264,
  FF_ENCODER_LIBX265,
  FF_ENCODER_LIBVPX_VP8,
  FF_ENCODER_LIBVPX_VP9,
  'libvpx-vp9',
  'libvpx-vp8'
]

export {
  FF_ENCODER_LIBX264,
  FF_ENCODER_LIBX265,
  FF_ENCODER_LIBVPX_VP8,
  FF_ENCODER_LIBVPX_VP9
}

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
  outputCodec?: typeof OUTPUT_CODECS[number]

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
    outputCodec,
    logger
  } = options || {}

  logger?.start('Starting conversion')

  try {
    const type = resolveOutputFormat(outputCodec)
    const encoded = await transcode(input, options)
    const muxed = await FSVMuxer.mux(
      type,
      encoded.color,
      encoded.alpha,
      encoded.framesCount
    )

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

async function transcode(source: string | Buffer, {
  alpha = false,
  ...options
}: ConvertOptions = {}) {
  if (alpha) {
    return transcodeAlpha(source, options)
  }

  const {
    inputFormat,
    inputCodec,
    outputCodec = DEFAULT_OUTPUT_CODEC,
    encoder: encoderOptions,
    logger
  } = options

  logger?.start(`Starting encoding`)

  try {
    if (!OUTPUT_CODECS.includes(outputCodec)) {
      logger?.error(`Supported output codecs: ${OUTPUT_CODECS}`)
      throw new Error(`Unsupported output codec "${outputCodec}"`)
    }

    logger?.info(`Opening input with format ${inputFormat || '[auto]'}`)
    await using input = await Demuxer.open(source, {
      format: inputFormat,
      copyTs: true
    })

    const videoStream = input.video()

    if (!videoStream) {
      throw new Error('No video stream found in input')
    }

    const outputFormat = resolveOutputFormat(outputCodec)

    logger?.info(`Opening output with format ${outputFormat}`)
    const output = await createOutput(outputFormat)

    logger?.info(`Initializing decoder with codec ${inputCodec || '[auto]'}`)
    using decoder = await Decoder.create(
      videoStream,
      inputCodec as FFDecoderCodec
    )

    logger?.info(`Initializing encoder with codec ${outputCodec}`)
    using encoder = await Encoder.create(
      outputCodec as FFEncoderCodec,
      resolveEncoderOptions(outputFormat, videoStream, encoderOptions)
    )

    output.muxer.addStream(encoder)

    logger?.info('Initializing filter')
    using filter = FilterComplexAPI.create('[in]format=yuv420p[out]', {
      inputs: [{ label: 'in' }],
      outputs: [{ label: 'out' }]
    })

    logger?.info('Encoding frames...')

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

        await output.muxer.writePacket(packet, 0)
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

    logger?.debug('Closing output')
    await output.muxer.close()

    logger?.success(`Encoding completed`)

    return {
      color: await output.receive(),
      alpha: undefined,
      framesCount
    }
  } catch (error) {
    logger?.error('Encoding failed')
    throw error
  }
}

async function transcodeAlpha(source: string | Buffer, {
  inputFormat,
  inputCodec,
  outputCodec = DEFAULT_OUTPUT_CODEC,
  encoder: encoderOptions,
  logger
}: Exclude<ConvertOptions, 'alpha'> = {}) {
  logger?.start(`Starting encoding`)

  try {
    if (!OUTPUT_CODECS.includes(outputCodec)) {
      logger?.error(`Supported output codecs: ${OUTPUT_CODECS}`)
      throw new Error(`Unsupported output codec "${outputCodec}"`)
    }

    logger?.info(`Opening input with format ${inputFormat || '[auto]'}`)
    await using input = await Demuxer.open(source, {
      format: inputFormat,
      copyTs: true
    })

    const videoStream = input.video()

    if (!videoStream) {
      throw new Error('No video stream found in input')
    }

    const outputFormat = resolveOutputFormat(outputCodec)

    logger?.info(`Opening color output with format ${outputFormat}`)
    const colorOutput = await createOutput(outputFormat)

    logger?.info(`Opening alpha output with format ${outputFormat}`)
    const alphaOutput = await createOutput(outputFormat)

    encoderOptions = resolveEncoderOptions(outputFormat, videoStream, encoderOptions)

    logger?.info(`Initializing decoder with codec ${inputCodec || '[auto]'}`)
    using decoder = await Decoder.create(
      videoStream,
      inputCodec as FFDecoderCodec
    )

    logger?.info(`Initializing color encoder with codec ${outputCodec}`)
    using colorEncoder = await Encoder.create(
      outputCodec as FFEncoderCodec,
      encoderOptions
    )

    logger?.info(`Initializing alpha encoder with codec ${outputCodec}`)
    using alphaEncoder = await Encoder.create(
      outputCodec as FFEncoderCodec,
      encoderOptions
    )

    colorOutput.muxer.addStream(colorEncoder)
    alphaOutput.muxer.addStream(alphaEncoder)

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

        await colorOutput.muxer.writePacket(packet, 0)
        packet.free()
      }

      while (true) {
        const packet = await alphaEncoder.receive()

        if (!packet) {
          break
        }

        await alphaOutput.muxer.writePacket(packet, 0)
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

    logger?.debug('Closing outputs')
    await colorOutput.muxer.close()
    await alphaOutput.muxer.close()

    logger?.success(`Encoding completed`)

    return {
      color: await colorOutput.receive(),
      alpha: await alphaOutput.receive(),
      framesCount
    }
  } catch (error) {
    logger?.error('Encoding failed')
    throw error
  }
}

function resolveEncoderOptions(
  format: 'mp4' | 'webm',
  stream: Stream,
  encoderOptions?: Partial<EncoderOptions>
): EncoderOptions {
  return {
    threadCount: 0,
    threadType: FF_THREAD_FRAME,
    gopSize: 5,
    maxBFrames: 0,
    timeBase: stream.timeBase,
    frameRate: stream.avgFrameRate,
    ...encoderOptions,
    options: {
      ...(
        format === 'mp4' ? {
          crf: 20,
          preset: 'slower',
          tune: 'fastdecode',
          profile: 'baseline',
          level: '5.1',
          sc_threshold: '0',
          movflags: '+faststart',
          refs: '1',
          pixel_format: AV_PIX_FMT_YUV420P
        } :

        format === 'webm' ? {
          crf: 20,
          b: '0',
          deadline: 'good',
          'cpu-used': '2',
          'row-mt': '1',
          'tile-columns': '2',
          'tile-rows': '1',
          'frame-parallel': '1',
          pixel_format: AV_PIX_FMT_YUV420P
        } :

        null
      ),

      ...encoderOptions?.options
    }
  } as EncoderOptions
}

function resolveOutputFormat(
  codec: ConvertOptions['outputCodec'] = DEFAULT_OUTPUT_CODEC
) {
  switch (codec) {
    case FF_ENCODER_LIBX264:
    case FF_ENCODER_LIBX265:
      return 'mp4'

    case FF_ENCODER_LIBVPX_VP8:
    case FF_ENCODER_LIBVPX_VP9:
    case 'libvpx-vp8':
    case 'libvpx-vp9':
      return 'webm'

    default:
      throw new Error(`Unsupported output codec "${codec}"`)
  }
}

async function createOutput(format: string) {
  const tmp = `${os.tmpdir()}/${crypto.randomUUID()}.${format}`
  const muxer = await Muxer.open(tmp, { format })

  return {
    muxer,
    async receive() {
      let data: Buffer | undefined

      try {
        data = await fs.readFile(tmp)
      } catch (_) {

      }

      try {
        await fs.unlink(tmp)
      } catch (_) {

      }

      if (!data) {
        throw new Error('Failed to read output data')
      }

      return data
    }
  }
}
