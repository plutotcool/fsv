/**
 * A raw encoded video packet as produced by the encoder.
 */
export interface Packet {
  /**
   * The raw encoded packet data.
   *
   * For H.264 and H.265 this is an Annex B bitstream (start-code delimited).
   * For VP8 and VP9 this is the raw codec bitstream (no conversion needed).
   */
  data: Buffer

  /**
   * Presentation timestamp of the packet in microseconds.
   */
  timestamp: number

  /**
   * Whether this packet is a key frame.
   */
  isKeyFrame: boolean
}
