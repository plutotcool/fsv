# FSV

FSV (short for "Fast Scrubbing Video") is a video format optimized for fast
scrubbing on the web, supporting alpha channel. It has been inspired by the
[ActiveFrame](https://github.com/activetheory/activeframe) project.

[See the demo](https://plutotcool-fsv.vercel.app)

<img src="demo.gif" width="320" height="307"/>

> **Early development (v0):** This package is currently in v0. The API is
> unstable and may change between releases without prior notice. Pin your
> dependency to a specific version if stability matters for your project.

This repository provides both:
- **Conversion API**: based on [node-av](https://github.com/seydx/node-av) for
  encoding and config extraction using ffmpeg node bindings.
- **Decoding and rendering API**: based on the native WebCodecs and WebGL2 APIs.

## Installation

```shell
pnpm add @plutotcool/fsv
```

> **Note:** ffmpeg bindings are installed automatically via npm lifecycle scripts. Make sure
> pre/post-scripts are **not** disabled in your environment (i.e. do not pass
> `--ignore-scripts` when installing dependencies).

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
const renderer = new Renderer({ canvas })

// Load video from url
await renderer.load('/video.fsv')

// Load video from array buffer
await renderer.load(arrayBuffer)

// Load video from stream, resolving as soon as the manifest is loaded
await renderer.loadStream('/video.fsv')
await renderer.loadStream(streamReader)

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

// Load video from stream, resolving as soon as the manifest is loaded
await decoder.loadStream('/video.fsv')
await decoder.loadStream(streamReader)

// Decode the video at 50% of its duration
decoder.progress(0.5)

// Decode the video at 10 seconds
decoder.seek(10)

// Decode the 5th video frame
decoder.set(5)
```

## Demuxing

If you need even lower-level access to the encoded video chunks to write your
own decoding logic, use the `Demuxer` namespace:

```typescript
import { Demuxer } from '@plutotcool/fsv'

// Demux video from array buffer
const fsv = Demuxer.demux(arrayBuffer)

// Demux video from stream, resolving as soon as the manifest is loaded
const { fsv } = await Demuxer.demuxStream(streamReader)

console.log(fsv)
// {
//   config: { }     // suitable video decoder config
//   width: 1920,    // width in pixels
//   height: 1080,   // height in pixels
//   duration: 30,   // duration in seconds
//   length: 750,    // number of frames
//   indices: Map    // map from timestamps to frame indices
//   frames: [       // frames info (progressively filled when loading from stream)
//     {
//       keyIndex: 0 // Closest prior key frame index
//       chunk: EncodedVideoChunk
//     },
//     // 749 other frames
//   ]
// }
```

See the [FSV interface](src/core/FSV.ts) for more details on the returned object.

## Stream loading

When using the renderer/decoder `loadStream` or demuxer `demuxStream` methods,
a `loaded` method is returned, allowing you to create a promise that resolves
when a specific number of frames have been loaded:

```typescript
const { loaded } = await renderer.loadStream(streamReader)
const { loaded } = await decoder.loadStream(streamReader)
const { loaded } = await Demuxer.demuxStream(streamReader)

// Wait for the first 5 frames to be loaded
await loaded(5)

// Wait for all the frames to be loaded
await loaded()
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

The 4 leading empty bytes are used to automatically discriminate between alpha
and non-alpha videos: if the first 4 bytes of the file are empty, then it's a
non-alpha video, otherwise it's an alpha video, and they correspond to the alpha
data byte offset.
