# FSV

FSV (short for "Fast Scrubbing Video") is a video format optimized for fast
scrubbing on the web, supporting alpha channel. It has been inspired by the
[ActiveFrame](https://github.com/activetheory/activeframe) project.

[See the demo](https://plutotcool-fsv.vercel.app)

<img src="demo.gif" width="320" height="307"/>

This repository provides both:
- **Conversion API**: based on [node-av](https://github.com/seydx/node-av) for
  encoding using ffmpeg node bindings, and
  [webcodecs-node](https://github.com/Brooooooklyn/webcodecs-node) for demuxing
  video frames and infer WebCodecs VideoDecoder config.
- **Decoding and rendering API**: based on the native WebCodecs and WebGL2 APIs.

## Installation

In your .npmrc, make sure the @plutotcool scope is set to use the GitHub
packages registry:

```
# .npmrc

@plutotcool:registry=https://npm.pkg.github.com
```

Then add the package to your project:

```shell
pnpm add @plutotcool/fsv
```

## Conversion

To convert a video to fsv, you can simply use the `fsv convert` cli command:

```shell
$ fsv convert --help

Convert videos to optimized fsv format. (fsv convert vx.x.x)

USAGE fsv convert [OPTIONS] <INPUT> <OUTPUT>

ARGUMENTS

                 INPUT  Path to the input video file. (Required)
                OUTPUT  Path to the output fsv file. (Required)

OPTIONS

 --input-codec=<codec>  Codec to use for decoding the input video. (Default: auto)
--output-codec=<codec>  Codec to use for encoding the video tracks. (Default: libx264)
        --crf=<number>  Constant Rate Factor, lower is better quality. (Default: 20)
        --gop=<number>  Group of Pictures size, determining keyframe intervals. (Default: 5)
               --alpha  Whether to include an alpha track. (Default: false)
               --debug  Enable debug logging for the conversion process. (Default: false)
```

In NodeJS, you can also use the conversion API programmatically to provide more
options for fine-tuning the conversion process:

```ts
import { Converter } from '@plutotcool/fsv/core/Converter'

await Converter.convert('input.webm', 'output.fsv', {
  alpha: true,
  inputCodec: 'libvpx-vp9',
  outputCodec: 'libx264',

  encoder: {
    gopSize: 5,
    /** Other ffmpeg encoder-specific options **/

    options: {
      crf: 20
      /** Other ffmpeg codec-specific options **/
    }
  }
})
```

The input file codec is automatically detected if not provided. Yet the
conversion may fail (especially for alpha videos) if the input codec is not
compatible with the conversion process. For VP8/VP9 videos, you may need to
explicitly set the input codec to `libvpx-vp8` or `libvpx-vp9`.

## Rendering

To render a fsv video in the browser with frame-accurate scrubbing, use the
`Renderer` class:

```typescript
import { Renderer } from '@plutotcool/fsv'

const canvas = document.createElement('canvas')
const renderer = new Renderer(canvas)

// Load video from url
await renderer.load('/video.fsv')

// Load video from array buffer
await renderer.load(arrayBuffer)

// Render the video at 50% of its duration
renderer.progress(0.5)

// Render the video at 10 seconds
renderer.seek(10)

// Render the 5th video frame
renderer.set(5)
```

## Decoding

If you need lower-level access to the video frames to write your own rendering
logic, use the `Decoder` class:

```typescript
import { Decoder } from '@plutotcool/fsv'

const decoder = new Decoder((
  color: VideoFrame,
  alpha: VideoFrame | undefined,
  index: number
) => {
  // Do something with the decoded frames
})

// Load video from array buffer
await decoder.load(arrayBuffer)

// Decode the video at 50% of its duration
decoder.progress(0.5)

// Decode the video at 10 seconds
decoder.seek(10)

// Decode the 5th video frame
decoder.set(5)
```

## Format

The format consists of a single binary containing both demuxed video frames and
a manifest containing infos for decoding and rendering the video efficiently.
It can contain an additional alpha track for videos with transparency.

For non-alpha videos, it follows this structure:

| Chunk size | Description                      |
|:-----------|:---------------------------------|
| 4 bytes    | Empty bytes                      |
| 4 bytes    | Manifest byte length             |
| Variable   | Manifest data serialized in JSON |
| Variable   | Internal codec and frames data   |

For transparent videos, the structure is:

| Chunk size | Description                      | Track |
|:-----------|:---------------------------------|-------|
| 4 bytes    | Alpha data byte offset           |       |
| 4 bytes    | Empty bytes                      | Color |
| 4 bytes    | Manifest byte length             | Color |
| Variable   | Internal codec and frames data   | Color |
| Variable   | Manifest data serialized in JSON | Color |
| 4 bytes    | Empty bytes                      | Alpha |
| 4 bytes    | Manifest byte length             | Alpha |
| Variable   | Manifest data serialized in JSON | Alpha |
| Variable   | Internal codec and frames data   | Alpha |

The 4 trailing empty bytes are used to automatically discriminate between alpha
and non-alpha videos: if the last 4 bytes of the file are empty, then it's a
non-alpha video, otherwise it's an alpha video, and they correspond to the alpha
data byte offset.
