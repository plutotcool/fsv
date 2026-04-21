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
├── @types/        # Internal type declarations for shader modules (*.vert, *.frag)
├── demo/          # Demo application source
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

3. Build the package:

   ```shell
   pnpm build
   ```

4. Test your changes using the CLI directly via the `fsv` script:

   ```shell
   pnpm fsv convert --help
   ```

5. Run the demo to verify browser-side changes:

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

## Opening a Pull Request

1. Push your branch to your fork:

   ```shell
   git push origin feat/my-feature
   ```

2. Open a pull request against the `main` branch of `plutotcool/fsv`.

3. Provide a clear description of *what* your change does and *why* it is needed. Link to any related issues.

4. Ensure the build passes before requesting a review.

## Reporting Issues

Please use [GitHub Issues](https://github.com/plutotcool/fsv/issues) to report bugs or request features. When reporting a bug, include:

- A short description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your Node.js version and operating system

## License

By contributing you agree that your contributions will be licensed under the [MIT License](./LICENSE).
