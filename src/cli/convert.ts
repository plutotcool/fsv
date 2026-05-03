import { defineCommand, Types } from 'clerc'
import { Converter, type ConvertOptions } from '~/core/Converter'
import { CODECS, DEFAULT_CODEC } from '~/core/Codec'
import { Logger } from '~/core/Logger'

export const convert = defineCommand({
  name: 'convert',
  description: 'Convert videos to optimized fsv format',
  parameters: [
    {
      key: '<input>',
      description: 'Path to the input video file',
      type: String,
      required: true
    },
    {
      key: '<output>',
      description: 'Path to the output fsv file',
      type: String,
      required: true
    }
  ],
  flags: {
    inputCodec: {
      type: String,
      default: 'auto',
      description: 'Codec to use for decoding the input video',
    },
    outputCodec: {
      type: Types.Enum(...CODECS),
      default: DEFAULT_CODEC,
      description: 'Codec to use for encoding the video tracks'
    },
    crf: {
      type: Number,
      default: 20,
      valueHint: 'number',
      description: 'Constant Rate Factor, lower is better quality'
    },
    gop: {
      type: Number,
      default: 5,
      valueHint: 'number',
      description: 'Group of Pictures size, determining keyframe intervals'
    },
    alpha: {
      type: Boolean,
      default: false,
      description: 'Whether to include an alpha track'
    },
    debug: {
      type: Boolean,
      default: false,
      description: 'Enable debug logging for the conversion process'
    }
  }
}, async ({ parameters, flags }) => {
  await Converter.convert(parameters.input, parameters.output, {
    logger: Logger.create({
      level: flags.debug ? Logger.levels.debug : Logger.levels.info
    }),

    alpha: flags.alpha,
    outputCodec: flags.outputCodec,
    inputCodec: flags.inputCodec === 'auto'
      ? undefined
      : flags.inputCodec as ConvertOptions['inputCodec'],

    encoder: {
      gopSize: flags.gop,
      options: {
        crf: flags.crf,
      }
    }
  })
})
