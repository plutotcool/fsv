export interface FSV extends FSVTrack {
  /**
   * The alpha track of the video, if it exists.
   */
  alpha?: FSVTrack
}

export interface FSVTrack {
  /**
   * The configuration to use to initialize a VideoDecoder instance.
   */
  config: VideoDecoderConfig

  /**
   * The width of the video in pixels.
   */
  width: number

  /**
   * The height of the video in pixels.
   */
  height: number

  /**
   * The duration of the video in microseconds.
   */
  duration: number

  /**
   * The total number of frames in the video.
   */
  length: number

  /**
   * Map of frame timestamps to their corresponding index.
   */
  indices: Map<number, number>

  /**
   * The video frames.
   */
  frames: {
    /**
     * The closest prior key frame index for the video frame.
     */
    keyIndex: number

    /**
     * The encoded video chunk containing the video frame data.
     */
    chunk: EncodedVideoChunk
  }[]
}
