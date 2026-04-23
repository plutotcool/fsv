import { defineCommand } from 'citty'
import { Converter, FF_ENCODER_LIBX264, type ConvertOptions } from '~/core/Converter'
import { Logger } from '~/core/Logger'

export default defineCommand({
  meta: {
    name: 'convert',
    description: 'Convert videos to optimized fsv format.'
  },
  args: {
    input: {
      type: 'positional',
      required: true,
      description: 'Path to the input video file.'
    },
    output: {
      type: 'positional',
      required: true,
      description: 'Path to the output fsv file.'
    },
    'input-codec': {
      type: 'string',
      default: 'auto',
      valueHint: 'codec',
      description: 'Codec to use for decoding the input video.',
    },
    'output-codec': {
      type: 'string',
      default: FF_ENCODER_LIBX264,
      valueHint: 'codec',
      description: 'Codec to use for encoding the video tracks.'
    },
    crf: {
      type: 'string',
      default: '20',
      valueHint: 'number',
      description: 'Constant Rate Factor, lower is better quality.'
    },
    gop: {
      type: 'string',
      default: '5',
      valueHint: 'number',
      description: 'Group of Pictures size, determining keyframe intervals.'
    },
    alpha: {
      type: 'boolean',
      default: false,
      description: 'Whether to include an alpha track.'
    },
    debug: {
      type: 'boolean',
      default: false,
      description: 'Enable debug logging for the conversion process.'
    }
  },
  async run({ args }) {
    await Converter.convert(args.input, args.output, {
      logger: Logger.create({
        level: args.debug ? Logger.levels.debug : Logger.levels.info
      }),

      alpha: args.alpha,
      outputCodec: args['output-codec'],
      inputCodec: args['input-codec'] === 'auto'
        ? undefined
        : args['input-codec'] as ConvertOptions['inputCodec'],

      encoder: {
        gopSize: parseInt(args.gop, 10),
        options: {
          crf: args.crf,
        }
      }
    })
  }
})
