import type { Video } from './Video'
import { Decoder } from './Decoder'
import vertex from './shaders/renderer.vert'
import fragment from './shaders/renderer.frag'

/**
 * Provides methods to scrub and render videos in fsv or fsv tuple formats onto
 * a canvas.
 */
export class Renderer implements Video {
  /**
   * The canvas element used for rendering the video frames.
   */
  public canvas: HTMLCanvasElement
  public alpha: boolean = false

  private gl: WebGL2RenderingContext
  private decoder: Decoder
  private buffer: WebGLBuffer
  private vertexArray: WebGLVertexArrayObject
  private vertexShader?: WebGLShader
  private fragmentShader?: WebGLShader
  private program?: WebGLProgram
  private colorTexture: WebGLTexture
  private alphaTexture?: WebGLTexture

  public get width() {
    return this.decoder.width
  }

  public get height() {
    return this.decoder.height
  }

  public get duration() {
    return this.decoder.duration
  }

  public get length() {
    return this.decoder.length
  }

  public get currentFrame() {
    return this.decoder.currentFrame
  }

  public get pendingFrame() {
    return this.decoder.pendingFrame
  }

  /**
   * Creates a new Renderer instance with the provided canvas element and
   * options.
   *
   * @param canvas The canvas element to use for rendering the video frames.
   *        If not provided, a new canvas element will be created.
   */
  public constructor(canvas?: HTMLCanvasElement) {
    canvas ||= document.createElement('canvas')

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true
    })

    if (!gl) {
      throw new Error('WebGL2 is not supported')
    }

    this.gl = gl
    this.canvas = canvas
    this.decoder = new Decoder(this.draw.bind(this))

    this.colorTexture = this.createTexture()

    this.vertexArray = gl.createVertexArray()
    gl.bindVertexArray(this.vertexArray)

    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    // x,  y,  u,  v
      -1, -1,  0,  1,
       3, -1,  2,  1,
      -1,  3,  0,  -1
    ]), gl.STATIC_DRAW)

    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
  }

  /**
   * Loads a video in fsv format from the provided data or url and optional
   * video decoder config.
   *
   * @param data The video data as an ArrayBuffer or a url.
   * @param config Optional video decoder config that overrides the one from the
   *        fsv manifest.
   *
   * @returns A promise that resolves when the video is loaded and ready to be
   *          scrubbed.
   */
  public async load(
    data: ArrayBuffer | string,
    config?: Partial<VideoDecoderConfig>
  ): Promise<void> {
    if (typeof data === 'string') {
      const response = await fetch(data)

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`)
      }

      data = await response.arrayBuffer()
    }

    await this.decoder.load(data, config)
    this.initialize()
  }

  /**
   * Loads a video in fsv format from the provided stream reader or url and
   * optional video decoder config.
   *
   * @param source The video source as an stream reader or a url.
   * @param config Optional video decoder config that overrides the one from the
   *        fsv manifest.
   *
   * @throws If the video fails to load or if the stream reader encounters an error
   *
   * @return A promise that resolves when the video data has started being read
   *         from the stream.
   */
  public async loadStream(
    source: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | string,
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
    let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>

    if (typeof source === 'string') {
      const response = await fetch(source)

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`)
      }

      reader = response.body!.getReader()
    } else {
      reader = source
    }

    const { loaded } = await this.decoder.loadStream(
      reader,
      config
    )

    this.initialize()

    return {
      loaded
    }
  }

  public seek(time: number): void {
    this.decoder.seek(time)
  }

  public progress(progress: number): void {
    this.decoder.progress(progress)
  }

  public set(index: number): void {
    this.decoder.set(index)
  }

  /**
   * Closes the renderer and releases all associated resources.
   */
  public close(): void {
    this.decoder.close()

    this.program && this.gl.deleteProgram(this.program)
    this.vertexShader && this.gl.deleteShader(this.vertexShader)
    this.fragmentShader && this.gl.deleteShader(this.fragmentShader)

    this.gl.deleteTexture(this.colorTexture)
    this.alphaTexture && this.gl.deleteTexture(this.alphaTexture)

    this.gl.deleteBuffer(this.buffer)
  }

  private initialize() {
    if (this.program && this.alpha === this.decoder.alpha) {
      return
    }

    this.alpha = this.decoder.alpha

    this.program && this.gl.deleteProgram(this.program)
    this.vertexShader && this.gl.deleteShader(this.vertexShader)
    this.fragmentShader && this.gl.deleteShader(this.fragmentShader)

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertex)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragment)
    const program = this.createProgram(vertexShader, fragmentShader)

    this.program = program
    this.vertexShader = vertexShader
    this.fragmentShader = fragmentShader

    this.gl.useProgram(program)
    this.gl.uniform1i(this.gl.getUniformLocation(program, 'color'), 0)

    if (this.alpha) {
      this.alphaTexture ||= this.createTexture()
      this.gl.uniform1i(this.gl.getUniformLocation(program, 'alpha'), 1)
    } else if (this.alphaTexture) {
      this.gl.deleteTexture(this.alphaTexture)
      this.alphaTexture = undefined
    }
  }

  private draw(color: VideoFrame): void
  private draw(color: VideoFrame, alpha: VideoFrame): void
  private draw(color: VideoFrame, alpha?: VideoFrame): void {
    if (
      this.canvas.width !== color.displayWidth ||
      this.canvas.height !== color.displayHeight
    ) {
      this.canvas.width = color.displayWidth
      this.canvas.height = color.displayHeight
      this.gl.viewport(0, 0,
        this.gl.drawingBufferWidth,
        this.gl.drawingBufferHeight
      )
    }

    this.updateTexture(this.gl.TEXTURE0, this.colorTexture, color)
    color.close()

    this.updateTexture(this.gl.TEXTURE1, this.alphaTexture, alpha)
    alpha?.close()

    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.useProgram(this.program!)
    this.gl.bindVertexArray(this.vertexArray)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 3)
  }

  private createProgram(
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader
  ): WebGLProgram {
    const program = this.gl.createProgram()
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program)
      this.gl.deleteProgram(program)
      this.gl.deleteShader(vertexShader)
      this.gl.deleteShader(fragmentShader)

      console.error(info)
      throw new Error('Unable to create WebGL program')
    }

    return program
  }

  private createShader(type: GLenum, source: string): WebGLShader {
    if (this.alpha) {
      source = source.replace(/^(#version\s+.+)$/m, '$1\n#define ALPHA 1')
    }

    const shader = this.gl.createShader(type)

    if (!shader) {
      throw new Error('Unable to create WebGL shader')
    }

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)

      console.error(info)
      throw new Error('Unable to create WebGL shader')
    }

    return shader
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    return texture
  }

  private updateTexture(
    slot: number,
    texture?: WebGLTexture,
    frame?: VideoFrame
  ): void {
    if (!texture || !frame) {
      return
    }

    this.gl.activeTexture(slot)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      frame
    )
  }
}
