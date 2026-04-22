import type { Video } from './Video'
import { TrackDecoder } from './TrackDecoder'
import { Demuxer } from './Demuxer'

/**
 * A callback function that will be called with each decoded video frame and its
 * index.
 *
 * @param frame The decoded video frame.
 * @param alpha The decoded alpha frame, if available.
 * @param index The index of the decoded video frame.
 */
export type DecoderCallback = (
  frame: VideoFrame,
  alpha: VideoFrame | undefined,
  index: number
) => void

/**
 * Decodes a fsv video.
 */
export class Decoder implements Video {
  /**
   * A callback function that will be called with each decoded video frame tuple
   * and its index.
   */
  public callback: DecoderCallback

  /**
   * The index of the current frame tuple.
   */
  public currentFrame?: number

  /**
   * The index of the frame tuple that is currently being decoded or is pending
   * to be decoded.
   */
  public pendingFrame?: number

  public get width() {
    return this.colorDecoder.width
  }

  public get height() {
    return this.colorDecoder.height
  }

  public get duration() {
    return this.colorDecoder.duration
  }

  public get length() {
    return this.colorDecoder.length
  }

  public get alpha() {
    return !!this.alphaDecoder
  }

  private colorDecoder: TrackDecoder
  private alphaDecoder?: TrackDecoder
  private colorFrame?: VideoFrame
  private alphaFrame?: VideoFrame

  /**
   * Creates a new Decoder instance.
   *
   * @param callback A callback function that will be called with each decoded
   *        video frame and its index.
   */
  public constructor(callback: DecoderCallback) {
    this.callback = callback
    this.colorDecoder = new TrackDecoder(this.colorCallback)
  }

  /**
   * Loads a fsv video from the given data.
   *
   * @param data The fsv data to load.
   * @param config An optional VideoDecoderConfig to override config specified
   *        in the fsv data.
   *
   * @returns A promise that resolves when the video is loaded and the decoder
   *          is configured.
   */
  public async load(
    data: ArrayBuffer,
    config?: Partial<VideoDecoderConfig>
  ): Promise<void> {
    const fsv = Demuxer.demux(data)

    if (fsv.alpha) {
      this.alphaDecoder ||= new TrackDecoder(this.alphaCallback)
    } else {
      this.alphaDecoder?.close()
      this.alphaDecoder = undefined
    }

    await Promise.all([
      this.colorDecoder.load(fsv, config),
      this.alphaDecoder?.load(fsv.alpha!, config)
    ])

    if (
      this.alphaDecoder &&
      this.alphaDecoder.length !== this.colorDecoder.length) {
      throw new Error(
        'Color and alpha tracks don\'t have the same number of frames'
      )
    }

    this.currentFrame = undefined
    this.pendingFrame = undefined
    this.colorFrame = undefined
    this.alphaFrame = undefined
  }

  /**
   * Loads a fsv video from the given stream. Resolves immediately after loading
   * the manifest, and progressively loads frames from the stream.
   *
   * @param reader The reader of the stream to read the fsv data from.
   * @param byteLength The total byte length of the fsv data in the stream.
   *
   * @return A promise that resolves when the video data has started being read
   *         from the stream.
   */
  public async loadStream(
    reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
    byteLength: number,
    config?: Partial<VideoDecoderConfig>
  ): Promise<{
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
    const {
      fsv,
      loaded
    } = await Demuxer.demuxStream(reader, byteLength, () => {
      if (this.pendingFrame !== undefined) {
        this.colorDecoder.set(this.pendingFrame)
      }
    })

    this.alphaDecoder?.close()
    this.alphaDecoder = undefined

    try {
      await this.colorDecoder.load(fsv, config)
    } catch (error) {
      throw error
    } finally {
      await reader.cancel()
    }

    this.currentFrame = undefined
    this.pendingFrame = undefined
    this.colorFrame = undefined
    this.alphaFrame = undefined

    return {
      loaded
    }
  }

  public seek(time: number): void {
    this.progress(time / this.duration)
  }

  public progress(progress: number): void {
    this.set(Math.round(progress * (this.colorDecoder.length - 1)))
  }

  public set(index: number): void {
    if (index === this.currentFrame || index === this.pendingFrame) {
      return
    }

    this.pendingFrame = index
    this.colorFrame?.close()
    this.alphaFrame?.close()
    this.colorFrame = undefined
    this.alphaFrame = undefined

    this.colorDecoder.set(index)
    this.alphaDecoder?.set(index)
  }

  /**
   * Closes the decoder and releases all associated resources.
   */
  public close(): void {
    this.colorDecoder.close()
    this.alphaDecoder?.close()
    this.colorFrame?.close()
    this.alphaFrame?.close()
    this.colorFrame = undefined
    this.alphaFrame = undefined
    this.currentFrame = undefined
    this.pendingFrame = undefined
  }

  private colorCallback = (frame: VideoFrame, index: number): void => {
    if (index === this.pendingFrame) {
      this.colorFrame = frame
      this.commonCallback()
    } else {
      frame.close()
    }
  }

  private alphaCallback = (frame: VideoFrame, index: number): void => {
    if (index === this.pendingFrame) {
      this.alphaFrame = frame
      this.commonCallback()
    } else {
      frame.close()
    }
  }

  private commonCallback = (): void => {
    if (this.colorFrame && (!this.alphaDecoder || this.alphaFrame)) {
      this.currentFrame = this.pendingFrame
      this.callback(this.colorFrame, this.alphaFrame, this.currentFrame!)
      this.colorFrame.close()
      this.alphaFrame?.close()
      this.colorFrame = undefined
      this.alphaFrame = undefined
    }
  }
}
