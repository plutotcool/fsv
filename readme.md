# FSV

FSV (short for "Fast Scrubbing Video") is a video format optimized for fast
scrubbing on the web, supporting alpha channel. It has been inspired by the
[ActiveFrame](https://github.com/activetheory/activeframe) project.

More specifically, FSV is a container for h264 and h265. It is designed to be
easily demuxable on the browser, and contains additional metadata to allow for
frame-accurate scrubbing and efficient seeking. See the [format](#format)
section for more details.

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

fsv convert v0.4.1 - Convert videos to optimized fsv format

Usage
  $ fsv convert <input> <output> [flags]

Parameters
  <input>   String  Path to the input video file
  <output>  String  Path to the output fsv file

Flags
  --input-codec   String             Codec to use for decoding the input video               [default: "auto"]
  --output-codec  libx264 | libx265  Codec to use for encoding the video tracks              [default: "libx264"]
  --crf           Number             Constant Rate Factor, lower is better quality           [default: 20]
  --gop           Number             Group of Pictures size, determining keyframe intervals  [default: 5]
  --alpha         Boolean            Whether to include an alpha track                       [default: false]
  --debug         Boolean            Enable debug logging for the conversion process         [default: false]

Global Flags
  --version, -V  Boolean  Prints current version  [default: false]
  --help, -h     Boolean  Show help               [default: false]
```

In NodeJS, you can also use the conversion API programmatically to provide more
options for fine-tuning the conversion process:

```ts
import { Converter } from '@plutotcool/fsv/core/Converter'
import { H264 } from '@plutotcool/fsv/core/Codec'

await Converter.convert('input.webm', 'output.fsv', {
  alpha: true,
  inputCodec: 'libvpx-vp9',
  outputCodec: H264, // default codec, could be ommited here

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
compatible with the conversion process. For VP8/VP9 input videos, you may
need to explicitly set the input codec to `libvpx-vp8` or `libvpx-vp9`.

### Encoder Options

FSV uses codec-specific default encoder options optimized for fast scrubbing
and efficient decoding:

| Option | H.264 (libx264) | H.265 (libx265) |
|:-------|:-----------------|:-----------------|
| crf | 20 | 20 |
| preset | slower | slower |
| tune | fastdecode | fastdecode |
| profile | baseline | - |
| level | 5.1 | - |
| gopSize | 5 | 5 |
| maxBFrames | 0 | 0 |
| refs | 1 | 1 |
| pixel_format | yuv420p | yuv420p |

**Performance notes:**
- `fastdecode` tune optimizes the encoded bitstream for faster decoding
- Low `gopSize` (5) ensures frequent keyframes for frame-accurate seeking
- `maxBFrames: 0` avoids bidirectional frames, simplifying decoding order
- `refs: 1` limits reference frames, reducing memory usage during decoding
- `profile: baseline` for H.264 ensures maximum compatibility

All of these values as well as other encoder options can be overridden via the
`encoder` option of the converter.

When using the cli, the `crf` and `gopSize` options can be overridden via the
`--crf` and `--gop` arguments.

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

The format consists of a single binary containing both h264 / h265 packets and
a manifest with infos for decoding and rendering the video efficiently.
It can contain an additional alpha track for videos with transparency.

For non-alpha videos, it follows this structure:

| Chunk size | Description                      |
|:-----------|:---------------------------------|
| 4 bytes    | Empty bytes                      |
| 4 bytes    | Manifest byte length             |
| Variable   | Manifest data serialized in JSON |
| Variable   | h264 / h265 packets              |

For transparent videos, the structure is:

| Chunk size | Description                      | Track |
|:-----------|:---------------------------------|-------|
| 4 bytes    | Alpha data byte offset           |       |
| 4 bytes    | Empty bytes                      | Color |
| 4 bytes    | Manifest byte length             | Color |
| Variable   | h264 / h265 packets              | Color |
| Variable   | Manifest data serialized in JSON | Color |
| 4 bytes    | Empty bytes                      | Alpha |
| 4 bytes    | Manifest byte length             | Alpha |
| Variable   | Manifest data serialized in JSON | Alpha |
| Variable   | h264 / h265 packets              | Alpha |

The 4 leading empty bytes are used to automatically discriminate between alpha
and non-alpha videos: if the first 4 bytes of the file are empty, then it's a
non-alpha video, otherwise it's an alpha video, and they correspond to the alpha
data byte offset.
