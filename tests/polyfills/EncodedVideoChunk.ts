if (typeof globalThis.EncodedVideoChunk === 'undefined') {
  class EncodedVideoChunkPolyfill {
    readonly type: 'key' | 'delta'
    readonly timestamp: number
    readonly byteLength: number
    private _data: Uint8Array

    constructor(init: {
      type: 'key' | 'delta'
      timestamp: number
      data: ArrayBuffer | ArrayBufferView
    }) {
      this.type = init.type
      this.timestamp = init.timestamp

      if (ArrayBuffer.isView(init.data)) {
        this._data = new Uint8Array(
          init.data.buffer,
          init.data.byteOffset,
          init.data.byteLength
        )
      } else {
        this._data = new Uint8Array(init.data)
      }

      this.byteLength = this._data.byteLength
    }

    copyTo(destination: ArrayBufferView): void {
      const dest = new Uint8Array(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength
      )
      dest.set(this._data)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).EncodedVideoChunk = EncodedVideoChunkPolyfill
}
