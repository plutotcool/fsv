import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock process.exit to prevent test failures
vi.mock('node:process', () => ({
  default: {
    ...process,
    exit: vi.fn()
  },
  exit: vi.fn()
}))

// Mock modules
vi.mock('../src/core/Converter', () => ({
  Converter: { convert: vi.fn().mockResolvedValue(Buffer.from('mock')) }
}))

vi.mock('../src/core/Logger', async () => {
  const actual = await vi.importActual('../src/core/Logger')

  return {
    ...actual,
    Logger: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(actual.Logger as any),
      create: vi.fn().mockReturnValue({
        start: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withTag: vi.fn().mockReturnThis()
      })
    }
  }
})

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('convert command', () => {
    it('calls Converter.convert with correct args', async () => {
      const main = await import('../src/cli/main')
      await main.default.parse({
        argv: ['convert', 'input.mp4', 'output.fsv']
      })

      const { DEFAULT_CODEC } = await import('../src/core/Codec')
      const { Converter } = await import('../src/core/Converter')

      expect(Converter.convert).toHaveBeenCalledWith(
        'input.mp4',
        'output.fsv',
        expect.objectContaining({
          alpha: false,
          outputCodec: DEFAULT_CODEC
        })
      )
    })

    it('handles --alpha flag', async () => {
      const main = await import('../src/cli/main')
      await main.default.parse({
        argv: ['convert', 'input.mp4', 'output.fsv', '--alpha']
      })

      const { Converter } = await import('../src/core/Converter')
      expect(Converter.convert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ alpha: true })
      )
    })

    it('handles --crf flag', async () => {
      const main = await import('../src/cli/main')
      await main.default.parse({
        argv: ['convert', 'input.mp4', 'output.fsv', '--crf', '25']
      })

      const { Converter } = await import('../src/core/Converter')
      expect(Converter.convert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          encoder: { gopSize: 5, options: { crf: 25 } }
        })
      )
    })

    it('handles --output-codec flag', async () => {
      const main = await import('../src/cli/main')
      await main.default.parse({
        argv: ['convert', 'input.mp4', 'output.fsv', '--output-codec', 'libx265']
      })

      const { Converter } = await import('../src/core/Converter')
      expect(Converter.convert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ outputCodec: 'libx265' })
      )
    })

    it('handles --gop flag', async () => {
      const main = await import('../src/cli/main')
      await main.default.parse({
        argv: ['convert', 'input.mp4', 'output.fsv', '--gop', '10']
      })

      const { Converter } = await import('../src/core/Converter')
      expect(Converter.convert).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          encoder: { gopSize: 10, options: { crf: 20 } }
        })
      )
    })

    it('handles --debug flag', async () => {
      const main = await import('../src/cli/main')
      await main.default.parse({
        argv: ['convert', 'input.mp4', 'output.fsv', '--debug']
      })

      const { Logger } = await import('../src/core/Logger')
      expect(Logger.create).toHaveBeenCalledWith({
        level: Logger.levels.debug
      })
    })
  })
})
