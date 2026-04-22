# Copilot Instructions for `@plutotcool/fsv`

## Project Overview

`@plutotcool/fsv` is a TypeScript library that defines and implements the **FSV (Fast Scrubbing Video)** format — a custom binary video format optimized for frame-accurate scrubbing on the web, with optional alpha-channel support.

The library ships two distinct APIs:

| API | Environment | Purpose |
|-----|-------------|---------|
| **Conversion** | Node.js | Converts any video file to `.fsv` using ffmpeg (`node-av`) and WebCodecs bindings (`@napi-rs/webcodecs`) |
| **Decoding / Rendering** | Browser | Loads, demuxes, decodes, and WebGL2-renders `.fsv` files using native browser WebCodecs and WebGL2 APIs |

The package is published to the GitHub Packages registry (`https://npm.pkg.github.com`) under the `@plutotcool` scope.

---

## Repository Layout

```
fsv/
├── src/
│   ├── index.ts          # Browser-side public exports (Renderer, Decoder, Demuxer, FSV types)
│   ├── cli/
│   │   ├── index.ts      # CLI entry point (#!/usr/bin/env node, runs citty main)
│   │   ├── main.ts       # CLI main command definition (citty)
│   │   └── convert.ts    # `fsv convert` sub-command
│   └── core/
│       ├── FSV.ts        # FSV & FSVTrack TypeScript interfaces
│       ├── Video.ts      # Shared Video interface (seek/progress/set/width/height/duration/length)
│       ├── Manifest.ts   # Binary manifest serialization/deserialization (compact flat number arrays)
│       ├── Converter.ts  # Node.js-only: ffmpeg transcode → FSV (uses node-av + FSVMuxer)
│       ├── Muxer.ts      # Node.js-only: pack encoded mp4/webm data into .fsv binary
│       ├── Demuxer.ts    # Browser-compatible: unpack .fsv binary into FSV objects (sync + streaming)
│       ├── Decoder.ts    # Browser: coordinate color+alpha TrackDecoders, invoke user callback
│       ├── TrackDecoder.ts # Browser: WebCodecs VideoDecoder wrapper for a single FSV track
│       ├── Renderer.ts   # Browser: WebGL2 renderer using decoded VideoFrames
│       ├── Logger.ts     # Thin consola wrapper for CLI/Converter logging
│       └── shaders/
│           ├── renderer.vert  # GLSL vertex shader (imported as string via tsdown loader)
│           └── renderer.frag  # GLSL fragment shader (#define ALPHA 1 injected for alpha videos)
├── @types/
│   └── shaders.d.ts      # Module declarations for *.vert and *.frag text imports
├── demo/                 # Vite demo app (browser-side usage showcase)
├── .github/
│   └── workflows/
│       ├── ci.yml        # PR checks: typecheck + build
│       └── release.yml   # Push to main: build + changelogen release + npm publish
├── tsconfig.json         # strict, ESNext, Bundler resolution, path aliases (~/→src/, ~~/→root/)
├── tsdown.config.ts      # Build config: unbundle, ESM+CJS, dts, .vert/.frag as text
├── package.json          # Scripts, exports map, bin entry, peerDeps, publishConfig
└── pnpm-workspace.yaml   # allowBuilds for native node-av modules
```

---

## Code Style & Conventions

- **Language**: TypeScript (strict mode, `strictNullChecks`, `noUnusedLocals`)
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes
- **Semicolons**: None at end of statements
- **Type imports**: Use `import type` for type-only imports
- **JSDoc**: Required on all public API members (classes, methods, interfaces, exported functions)
- **Path aliases**: `~/` maps to `src/`, `~~/` maps to the repo root (tsconfig `paths`)

---

## Package Manager & Tooling

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager (managed via `corepack enable`) |
| **tsdown** | Build tool — outputs unbundled ESM (`.mjs`) + CJS (`.cjs`) + type declarations (`.d.ts`) |
| **tsc** | Type checking only (no emit, `noEmit: true`) |
| **tsx** | Runs the CLI directly from TypeScript source in development (`pnpm fsv`) |
| **Vite** | Demo app dev server and build |
| **changelogen** | Changelog generation + npm release (`pnpm release`) |

---

## Key Commands

```shell
# Install (IMPORTANT: do not use --ignore-scripts; ffmpeg bindings require lifecycle scripts)
corepack enable
pnpm install

# Type-check (runs tsc --noEmit)
pnpm typecheck

# Build the package (tsdown → dist/)
pnpm build

# Run the CLI directly via tsx (development, no build required)
pnpm fsv convert --help
pnpm fsv convert input.webm output.fsv --alpha --crf 20

# Run the demo app locally
pnpm dev

# Build the demo
pnpm build:demo

# Create a release (bump version, update changelog, push tag, publish to GitHub Packages)
pnpm release
```

---

## CI/CD Workflows

- **`ci.yml`** — Triggered on PRs to `main`. Runs two parallel jobs:
  1. **Typecheck** (`pnpm typecheck`)
  2. **Build** (`pnpm build`)
- **`release.yml`** — Triggered on push to `main`. Builds the package and runs `pnpm release` (changelogen) to publish to `https://npm.pkg.github.com`.

Always ensure both `pnpm typecheck` and `pnpm build` pass before merging.

---

## Architecture Deep-Dive

### The FSV Binary Format

Non-alpha videos:
```
[4 bytes: 0x00000000 (null)] [4 bytes: manifest byte length] [manifest JSON] [encoded video data]
```

Alpha videos (color + alpha tracks):
```
[4 bytes: alpha data byte offset] [color track: header + manifest + data] [alpha track: header + manifest + data]
```

The first 4 bytes discriminate: `0` → non-alpha, non-zero → alpha (stores the byte offset to the alpha track).

The manifest is serialized as a compact flat number array: each frame is 4 consecutive numbers `[offset, byteLength, timestamp, type (1=key, 0=delta)]`.

### Converter (Node.js only — `src/core/Converter.ts`)

- Uses `node-av` (ffmpeg bindings) for decoding and encoding
- Uses a `FilterComplexAPI` for pixel format conversion to `yuv420p`
- For alpha videos, uses ffmpeg's `alphaextract` filter to produce separate color + alpha streams
- Supported output codecs: `libx264`, `libx265`, `libvpx-vp8`, `libvpx-vp9`
- Default output codec: `libx264` → mp4 container
- Default encoder settings: `crf=20`, `gopSize=5`, `maxBFrames=0`, `threadType=FF_THREAD_FRAME`
- Writes intermediate encoded video to a temp file in `os.tmpdir()`, then reads it back as a Buffer

### Muxer (Node.js only — `src/core/Muxer.ts`)

- Accepts mp4 or webm `Buffer` data (from the Converter)
- Uses `@napi-rs/webcodecs` (`Mp4Demuxer` / `WebMDemuxer`) to demux encoded chunks
- Extracts `EncodedVideoChunk` objects and builds the manifest
- Packs everything into the FSV binary format

### Demuxer (browser-compatible — `src/core/Demuxer.ts`)

- `Demuxer.demux(arrayBuffer)` — synchronous, reads the whole file at once
- `Demuxer.demuxStream(reader, byteLength)` — async streaming; resolves as soon as the manifest is read, then progressively fills `fsv.frames`
  - **Limitation**: Alpha channel videos are NOT supported in streaming mode
  - Returns a `loaded(n?)` function to wait for `n` frames (or all frames)
- Creates `EncodedVideoChunk` objects directly from the binary data (zero-copy for non-streaming path)

### Decoder (`src/core/Decoder.ts`)

- Wraps a `TrackDecoder` for the color track and optionally one for the alpha track
- Coordinates both decoders: fires the user `DecoderCallback` only when both color and alpha frames for the same index are ready
- Methods: `load(arrayBuffer)`, `loadStream(reader, byteLength)`, `seek(time)`, `progress(0-1)`, `set(frameIndex)`, `close()`

### TrackDecoder (`src/core/TrackDecoder.ts`)

- Wraps the browser `VideoDecoder` API
- Smart seeking: if the target frame is a key frame or sequential from current, decodes minimally; otherwise resets the decoder and replays from the nearest key frame (`frame.keyIndex`)
- Calls `VideoDecoder.isConfigSupported()` with multiple candidate configs (with/without `optimizeForLatency`) to find the best supported config
- On error, logs `'FSV'` + error to console

### Renderer (`src/core/Renderer.ts`)

- Uses WebGL2 (`canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true })`)
- Vertex shader uses a single oversized triangle covering the whole viewport
- Fragment shader has an `#ifdef ALPHA` code path — the `#define ALPHA 1` is injected at runtime into the GLSL source string when alpha mode is active
- Textures use `CLAMP_TO_EDGE` + `LINEAR` filtering
- `close()` must be called to release WebGL resources when done

---

## Known Issues & Workarounds

1. **VP8/VP9 input codec auto-detection**: The ffmpeg auto-detection may fail for WebM videos with VP8 or VP9 codec, especially when alpha channel is needed. Explicitly pass `inputCodec: 'libvpx-vp8'` or `inputCodec: 'libvpx-vp9'` to `Converter.convert()`.

2. **ffmpeg lifecycle scripts**: `node-av` installs ffmpeg binaries via npm lifecycle scripts. If dependencies are installed with `--ignore-scripts`, the native bindings will be missing. Always use plain `pnpm install` without that flag.

3. **Alpha streaming not supported**: `Demuxer.demuxStream()` throws `'Streaming videos with alpha channel is not supported'` if the FSV file has an alpha track. Use `Demuxer.demux()` (non-streaming) for alpha videos.

4. **Streaming requires byte length**: `Renderer.loadStream()` and `Decoder.loadStream()` require either an HTTP `Content-Length` header (when passing a URL string) or an explicit `byteLength` parameter (when passing a stream reader). Without it, an error is thrown.

5. **Muxer frame count race condition**: `@napi-rs/webcodecs` demuxers may resolve before all frames have been emitted. The `Muxer.mux()` function accepts a `framesCount` parameter (provided by the Converter) and polls until that count is reached (up to 10 seconds), falling back to a 500 ms delay if not provided.

6. **Native module builds**: `pnpm-workspace.yaml` explicitly sets `allowBuilds` for `@seydx/node-av-darwin-arm64` and `node-av` to allow native addon compilation.

---

## Exports Map

The package uses a detailed exports map in `package.json`. Each core class has its own named entry point:

- `.` → `src/index.ts` (browser-side: `Renderer`, `Decoder`, `Demuxer`, `FSV` types)
- `./cli` / `./cli/convert` / `./cli/main` → CLI modules
- `./core/Converter`, `./core/Muxer`, etc. → individual core modules

This means `import { Converter } from '@plutotcool/fsv/core/Converter'` works in Node.js but `Converter` is not included in the browser bundle.

---

## Branch & Commit Conventions

Branch names mirror the commit type prefix (e.g., `feat/my-feature`, `fix/some-bug`, `docs/update-readme`). Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Build/tooling/dependency changes |
| `refactor:` | Code restructuring without behavior change |
| `perf:` | Performance improvement |

Use `feat!:` (with `!`) to indicate a **breaking change**.

---

## Agent Git & Branch Conventions

> These conventions apply to interactive agents (e.g. OpenCode running locally). They do **not** apply to GitHub Copilot when running directly on a PR on GitHub — in that context, Copilot should follow its normal operations process.

- **Before committing**: always show the proposed commit message and the list of changed files, and wait for explicit confirmation before proceeding.
- **Before pushing**: always ask for explicit confirmation before pushing to any remote.
- **Never commit and push in one go** unless the user explicitly asks (e.g. "commit and push", or confirms a push immediately after a commit).
- **Pull before working**: if the local repo has no uncommitted changes, run `git pull` before starting any work.
- **Branches**: whenever a change is non-trivial or affects a distinct concern, propose creating a dedicated branch with the appropriate conventional prefix and a short descriptive name (e.g. `feat/my-feature`, `fix/some-bug`, `chore/update-deps`), and wait for confirmation before creating it.
