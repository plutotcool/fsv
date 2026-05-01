/**
 * A raw encoded video packet as produced by the encoder.
 */
export interface Packet {
  /**
   * The raw encoded packet data.
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
