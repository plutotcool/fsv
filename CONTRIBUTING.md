# Contributing to FSV

Thank you for your interest in contributing to FSV! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) (see `package.json` for the required version)
- [corepack](https://nodejs.org/api/corepack.html) (included with Node.js)
- [pnpm](https://pnpm.io/) package manager (managed via corepack)

> **Note:** ffmpeg bindings are installed automatically by [node-av](https://github.com/seydx/node-av)
> via npm lifecycle scripts. Make sure npm pre/post-scripts are **not** disabled in your
> environment (i.e. do not pass `--ignore-scripts` when installing dependencies).

## Getting Started

1. **Fork** the repository and clone your fork:

   ```shell
   git clone https://github.com/<your-username>/fsv.git
   cd fsv
   ```

2. **Install dependencies**:

   ```shell
   corepack enable
   pnpm install
   ```

3. **Build the package**:

   ```shell
   pnpm build
   ```

4. **Run the demo** locally to verify everything is working:

   ```shell
   pnpm dev
   ```

## Project Structure

```
fsv/
├── src/
│   ├── cli/       # CLI entry points and commands
│   ├── core/      # Core library (Converter, Decoder, Demuxer, Muxer, Renderer, …)
│   └── index.ts   # Public browser-side exports
├── tests/
│   ├── fixtures/  # Small video fixture files used by tests
│   ├── polyfills/ # Node.js polyfills for browser-only APIs (e.g. EncodedVideoChunk)
│   ├── setup.ts   # Vitest global setup (imports polyfills)
│   ├── Manifest.test.ts
│   ├── Muxer.test.ts
│   ├── Demuxer.test.ts
│   └── Converter.test.ts
├── @types/        # Internal type declarations for shader modules (*.vert, *.frag)
├── demo/          # Demo application source
├── vitest.config.ts
└── tsdown.config.ts
```

## Development Workflow

### Making Changes

Branch names are prefixed using the same conventions as commit messages (see below), loosely
inspired by [Gitflow](https://nvie.com/posts/a-successful-git-branching-model/).

1. Create a new branch from `main`:

   ```shell
   git checkout -b feat/my-feature
   # or
   git checkout -b docs/my-doc-change
   ```

2. Make your changes.

3. Run the tests:

   ```shell
   pnpm test
   ```

4. Build the package:

   ```shell
   pnpm build
   ```

5. Test your changes using the CLI directly via the `fsv` script:

   ```shell
   pnpm fsv convert --help
   ```

6. Run the demo to verify browser-side changes:

   ```shell
   pnpm dev
   ```

### Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Please use the following prefixes:

| Prefix     | When to use                                  |
|:-----------|:---------------------------------------------|
| `feat:`    | A new feature                                |
| `fix:`     | A bug fix                                    |
| `docs:`    | Documentation-only changes                   |
| `chore:`   | Build process, dependency, or tooling changes |
| `refactor:`| Code change that neither fixes a bug nor adds a feature |
| `perf:`    | A code change that improves performance      |

To indicate a **breaking change**, add an exclamation mark (`!`) after the commit type:

```shell
git commit -m "feat!: rename Renderer.load signature"
```

## Code Style

The codebase is written in TypeScript and follows these conventions:

- **2-space indentation**, no tabs
- **Single quotes** for strings
- **No semicolons** at the end of statements
- **`import type`** for type-only imports
- **JSDoc** comments on public API members

## Testing

Tests are written with [Vitest](https://vitest.dev/) and live in the `tests/` directory.

```shell
pnpm test
```

### Test fixtures

Small video files used as inputs are stored in `tests/fixtures/`:

| File | Codec | Alpha |
|------|-------|-------|
| `input-h264.mp4` | H.264 / MP4 | No |
| `input-vp9-alpha.webm` | VP9 / WebM | Yes |
| `input-prores444.mov` | ProRes 4444 / MOV | Yes |

### EncodedVideoChunk polyfill

Node.js does not implement the WebCodecs API. `tests/polyfills/EncodedVideoChunk.ts` provides a minimal polyfill so that `Demuxer` (which calls `new EncodedVideoChunk(...)`) can be exercised in Node.js. It is loaded automatically via `tests/setup.ts` (configured as `setupFiles` in `vitest.config.ts`).

## Opening a Pull Request

1. Push your branch to your fork:

   ```shell
   git push origin feat/my-feature
   ```

2. Open a pull request against the `main` branch of `plutotcool/fsv`.

3. Provide a clear description of *what* your change does and *why* it is needed. Link to any related issues.

4. Ensure the tests and build pass before requesting a review.

## Reporting Issues

Please use [GitHub Issues](https://github.com/plutotcool/fsv/issues) to report bugs or request features. When reporting a bug, include:

- A short description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your Node.js version and operating system

## License

By contributing you agree that your contributions will be licensed under the [MIT License](./LICENSE).
