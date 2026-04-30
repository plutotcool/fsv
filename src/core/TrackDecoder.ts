import type { Video } from './Video'
import type { FSVTrack } from './FSV'

/**
 * A callback function that will be called with each decoded video frame and its
 * index.
 *
 * @param frame The decoded video frame.
 * @param index The index of the decoded video frame.
 */
export type TrackDecoderCallback = (
  frame: VideoFrame,
  index: number
) => void

/**
 * Decodes a demuxed fsv track.
 */
export class TrackDecoder implements Video {
  /**
   * A callback function that will be called with each decoded video frame and
   * its index.
   */
  public callback: TrackDecoderCallback
  public currentFrame?: number
  public pendingFrame?: number
  public readonly alpha = false

  private track?: FSVTrack
  private config?: VideoDecoderConfig
  private decoder: VideoDecoder

  public get width() {
    return this.track?.width || 0
  }

  public get height() {
    return this.track?.height || 0
  }

  public get duration() {
    return this.track?.duration || 0
  }

  public get length() {
    return this.track?.length || 0
  }

  /**
   * Creates a new TrackDecoder instance.
   *
   * @param callback A callback function that will be called with each decoded video frame and its index.
   */
  public constructor(callback: TrackDecoderCallback) {
    this.callback = callback

    this.decoder = new VideoDecoder({
      output: this.output,
      error: this.error
    })
  }

  /**
   * Loads a fsv video track from the given demuxed data.
   *
   * @param track The demuxed fsv track to load.
   * @param config An optional VideoDecoderConfig to override config specified in the fsv track data.
   *
   * @returns A promise that resolves when the track is loaded and the decoder is configured.
   */
  public async load(
    track: FSVTrack,
    config?: Partial<VideoDecoderConfig>,
  ): Promise<void> {
    this.config = await TrackDecoder.config(track, config)
    this.track = track
    this.currentFrame = undefined
    this.pendingFrame = undefined

    this.decoder.reset()
    this.decoder.configure(this.config)
  }

  public seek(time: number): void {
    this.progress(time / (this.duration /  1_000_000))
  }

  public progress(progress: number): void {
    this.set(Math.round(progress * (this.length - 1)))
  }

  public set(index: number): void {
    index = Math.max(0, Math.min(this.length, index))

    if (index === this.currentFrame) {
      return
    }

    this.pendingFrame = index

    const frame = this.track?.frames[index]

    if (!frame) {
      return
    }

    if (this.decoder.state === 'closed') {
      this.decoder.configure(this.config!)
    }

    if (
      frame.chunk.type !== 'key' &&
      this.currentFrame !== undefined &&
      this.currentFrame + 1 === index
    ) {
      this.decoder.decode(frame.chunk)
      return
    }

    if (this.decoder.decodeQueueSize > 0) {
      this.decoder.reset()
      this.decoder.configure(this.config!)
    }

    for (let i = frame.keyIndex; i <= index; i++) {
      this.decoder.decode(this.track!.frames[i].chunk)
    }
  }

  /**
   * Closes the decoder and releases all associated resources.
   */
  public close(): void {
    this.currentFrame = undefined
    this.pendingFrame = undefined
    this.track = undefined
    this.decoder.close()
  }

  private output = (frame: VideoFrame): void => {
    const index = this.track!.indices.get(frame.timestamp)!

    if (this.pendingFrame === index) {
      this.currentFrame = index
      this.callback(frame, index)
    } else {
      frame.close()
    }
  }

  private error = (error: unknown): void => {
    console.error('FSV', error)
  }

  private static async config(
    track: FSVTrack,
    config?: Partial<VideoDecoderConfig>
  ): Promise<VideoDecoderConfig> {
    const resolvedConfig = { ...track.config, ...config }

    const { supported } = await VideoDecoder.isConfigSupported(resolvedConfig)

    if (!supported) {
      console.error('FSV', resolvedConfig)
      throw new Error('Unsupported decoder config')
    }

    return resolvedConfig
  }
}
