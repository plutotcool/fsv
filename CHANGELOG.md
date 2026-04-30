# Changelog


## v0.4.1

[compare changes](https://github.com/plutotcool/fsv/compare/v0.4.0...v0.4.1)

### 🩹 Fixes

- Approve node-av-linux-x64 build for github workflows ([23a7b00](https://github.com/plutotcool/fsv/commit/23a7b00))

### 💅 Refactors

- Eliminate container demuxing in conversion pipeline ([7933f6b](https://github.com/plutotcool/fsv/commit/7933f6b))

### 🏡 Chore

- Suppress ffmpeg logs in tests with Log.setLevel(AV_LOG_QUIET) ([8edc3b5](https://github.com/plutotcool/fsv/commit/8edc3b5))
- Add mandatory confirmation gate for git operations ([0a16f0e](https://github.com/plutotcool/fsv/commit/0a16f0e))
- Merge pull request #18 from plutotcool/refactor/eliminate-container-demuxing ([#18](https://github.com/plutotcool/fsv/issues/18))
- Replace ip subdependency by @webpod/ip to mitigate SSRF vulnerabilities ([1829a82](https://github.com/plutotcool/fsv/commit/1829a82))

### ✅ Tests

- Create tests and add corresponding ci checks ([632426b](https://github.com/plutotcool/fsv/commit/632426b))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>
- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))

## v0.4.0

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.15...v0.4.0)

### 🚀 Enhancements

- ⚠️  Remove unused byteLength parameter in renderer loadStream method ([05dda73](https://github.com/plutotcool/fsv/commit/05dda73))
- ⚠️  Expose webgl context attributes from the renderer options, make alpha premultiplication optional in fragment shader, closes #11 ([#11](https://github.com/plutotcool/fsv/issues/11))

### 📖 Documentation

- Mention unstable API in v0 notice ([2a231a7](https://github.com/plutotcool/fsv/commit/2a231a7))

#### ⚠️ Breaking Changes

- ⚠️  Remove unused byteLength parameter in renderer loadStream method ([05dda73](https://github.com/plutotcool/fsv/commit/05dda73))
- ⚠️  Expose webgl context attributes from the renderer options, make alpha premultiplication optional in fragment shader, closes #11 ([#11](https://github.com/plutotcool/fsv/issues/11))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.15

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.14...v0.3.15)

### 🩹 Fixes

- Duration was exposed in microseconds but is expected to be in seconds ([78bd842](https://github.com/plutotcool/fsv/commit/78bd842))
- Actually let's just apply the unit conversion only in the public seek so everything still uses microseconds ([c84865e](https://github.com/plutotcool/fsv/commit/c84865e))

### 🏡 Chore

- Disable vercel checks on prs ([e0d0687](https://github.com/plutotcool/fsv/commit/e0d0687))
- Merge pull request #14 from benjaminrobinet/fix/duration-in-seconds ([#14](https://github.com/plutotcool/fsv/issues/14))

### ❤️ Contributors

- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))
- Juliendargelos <hello@julien.gl>
- Benjamin Robinet ([@benjaminrobinet](https://github.com/benjaminrobinet))

## v0.3.14

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.13...v0.3.14)

### 🏡 Chore

- Upgrade npm to latest before publishing to support trusted publishing ([1d6a5be](https://github.com/plutotcool/fsv/commit/1d6a5be))
- Upgrade node to 24 lts to support npm trusted publishing ([3809e56](https://github.com/plutotcool/fsv/commit/3809e56))
- Remove npm upgrade step superseded by node 24 upgrade ([1bf915d](https://github.com/plutotcool/fsv/commit/1bf915d))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.13

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.12...v0.3.13)

### 🏡 Chore

- Normalize repository url for npm trusted publishing oidc validation ([27adac8](https://github.com/plutotcool/fsv/commit/27adac8))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.12

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.11...v0.3.12)

### 🏡 Chore

- Publish to npm registry via trusted publishing in release workflow ([9a533c8](https://github.com/plutotcool/fsv/commit/9a533c8))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.11

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.10...v0.3.11)

### 🩹 Fixes

- Remove registry-url and NPM_CONFIG_PROVENANCE from release workflow ([12e5027](https://github.com/plutotcool/fsv/commit/12e5027))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.10

[compare changes](https://github.com/plutotcool/fsv/compare/v0.3.9...v0.3.10)

### 🩹 Fixes

- Do not cancel the reader and make sure to process the last frame which was skipped ([0649679](https://github.com/plutotcool/fsv/commit/0649679))

### 🏡 Chore

- **release:** V0.3.10 ([515875d](https://github.com/plutotcool/fsv/commit/515875d))
- Replace automated release with manual workflow_dispatch ([bab35ed](https://github.com/plutotcool/fsv/commit/bab35ed))
- Add PR opening conventions to AGENTS.md ([9961646](https://github.com/plutotcool/fsv/commit/9961646))
- Remove copilot-instructions.md ([8252888](https://github.com/plutotcool/fsv/commit/8252888))
- Add agent identity and values to AGENTS.md ([2ef4aae](https://github.com/plutotcool/fsv/commit/2ef4aae))
- Enrich agent identity with session memory and functionalist framing ([aac39fb](https://github.com/plutotcool/fsv/commit/aac39fb))
- Move On Being an Agent section to end of AGENTS.md ([88d3272](https://github.com/plutotcool/fsv/commit/88d3272))
- Merge pull request #13 from plutotcool/ci/improve-release-management ([#13](https://github.com/plutotcool/fsv/issues/13))
- Publish to npm with trusted publishing and GitHub Packages ([175b39c](https://github.com/plutotcool/fsv/commit/175b39c))
- Set packageManager field to pnpm@10.33.1 ([f64e0d6](https://github.com/plutotcool/fsv/commit/f64e0d6))
- Setup eslint with typescript-eslint ([1fc2c67](https://github.com/plutotcool/fsv/commit/1fc2c67))
- Remove unused and useless byteLength ([6a8f2ea](https://github.com/plutotcool/fsv/commit/6a8f2ea))
- Update documentation and copilot instructions ([a14dba1](https://github.com/plutotcool/fsv/commit/a14dba1))
- Merge pull request #10 from benjaminrobinet/fix/reader-canceled-too-soon ([#10](https://github.com/plutotcool/fsv/issues/10))

### ❤️ Contributors

- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))
- Benjamin Robinet ([@benrbnt](https://github.com/benrbnt))
- Juliendargelos <hello@julien.gl>

## v0.3.10


### 🏡 Chore

- **release:** V0.3.9 ([5473a9d](https://github.com/plutotcool/fsv/commit/5473a9d))

## v0.3.9


### 🚀 Enhancements

- Cancel reading stream when failed to initialize decoder ([f1be72e](https://github.com/plutotcool/fsv/commit/f1be72e))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.8


### 🚀 Enhancements

- Encode using h264 baseline profile by default ([1b2d2cd](https://github.com/plutotcool/fsv/commit/1b2d2cd))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.7


### 🏡 Chore

- Merge pull request #7 from plutotcool/copilot/add-copilot-instructions-file ([#7](https://github.com/plutotcool/fsv/issues/7))

### ❤️ Contributors

- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))

## v0.3.6


### 🏡 Chore

- Merge pull request #6 from plutotcool/copilot/add-type-check-script ([#6](https://github.com/plutotcool/fsv/issues/6))

### ❤️ Contributors

- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))

## v0.3.5


### 🏡 Chore

- Merge pull request #4 from plutotcool/copilot/add-guide-for-contribution ([#4](https://github.com/plutotcool/fsv/issues/4))

### ❤️ Contributors

- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))

## v0.3.4


### 🩹 Fixes

- Pixel format conversion and better encoder options, wrong byte offset in non-alpha format ([3e428ce](https://github.com/plutotcool/fsv/commit/3e428ce))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.3

## v0.3.2


### 🏡 Chore

- Merge pull request #3 from benjaminrobinet/fix/add-tsx-to-dep ([#3](https://github.com/plutotcool/fsv/issues/3))

### ❤️ Contributors

- Julien Dargelos ([@juliendargelos](https://github.com/juliendargelos))

## v0.3.1


### 🩹 Fixes

- Decoder sets pending frame when loading from stream, even if it is the first one ([d02c9b0](https://github.com/plutotcool/fsv/commit/d02c9b0))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.3.0


### 🚀 Enhancements

- ⚠️  Wait for a specific number of frames to be available when loading from stream ([dbb8eb4](https://github.com/plutotcool/fsv/commit/dbb8eb4))

#### ⚠️ Breaking Changes

- ⚠️  Wait for a specific number of frames to be available when loading from stream ([dbb8eb4](https://github.com/plutotcool/fsv/commit/dbb8eb4))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.2.3

## v0.2.2


### 🚀 Enhancements

- Load video from stream ([59117ad](https://github.com/plutotcool/fsv/commit/59117ad))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.2.1


### 🩹 Fixes

- Output codec pixel format ([fd57bba](https://github.com/plutotcool/fsv/commit/fd57bba))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.2.0


### 🚀 Enhancements

- ⚠️  Append manifest and magic bytes at the start of the file ([ec0b2ec](https://github.com/plutotcool/fsv/commit/ec0b2ec))

#### ⚠️ Breaking Changes

- ⚠️  Append manifest and magic bytes at the start of the file ([ec0b2ec](https://github.com/plutotcool/fsv/commit/ec0b2ec))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.1.6

## v0.1.5

## v0.1.4

## v0.1.3

## v0.1.2


### 🏡 Chore

- Remove debug logs ([d46ccc5](https://github.com/plutotcool/fsv/commit/d46ccc5))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

## v0.1.1

## v0.1.0


### 🚀 Enhancements

- ⚠️  Setup release workflow ([702fc61](https://github.com/plutotcool/fsv/commit/702fc61))

#### ⚠️ Breaking Changes

- ⚠️  Setup release workflow ([702fc61](https://github.com/plutotcool/fsv/commit/702fc61))

### ❤️ Contributors

- Juliendargelos <hello@julien.gl>

