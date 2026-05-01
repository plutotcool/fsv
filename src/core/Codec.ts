import {
  FF_ENCODER_LIBX264 as H264,
  FF_ENCODER_LIBX265 as H265
} from 'node-av/constants'

export const CODECS = [
  H264,
  H265
]

export const DEFAULT_CODEC = H264

export {
  H264,
  H265
}

export type Codec = typeof CODECS[number]

export function isCodec(codec: unknown): codec is Codec {
  return CODECS.includes(codec as Codec)
}

export function assertCodec(codec: unknown): asserts codec is Codec {
  if (!isCodec(codec)) {
    throw new Error(`Unsupported codec: ${codec}. Supported codecs: ${CODECS}`)
  }
}

export function resolveCodec(codec: unknown): Codec {
  if (!codec) {
    return DEFAULT_CODEC
  }

  assertCodec(codec)

  return codec
}
