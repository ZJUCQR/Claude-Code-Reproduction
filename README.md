# Open-Claude-Code

Open-Claude-Code is a Bun-based Claude Code-compatible CLI that can run locally
with either official Anthropic credentials or DashScope Qwen credentials.

> Warning: 仅供学习使用。Please verify license, compliance, and redistribution
> rights before any public or commercial use.

## Features

- Interactive mode with `bun run cc`
- Non-interactive mode with `--print`
- Official Anthropic API support
- DashScope Qwen support through compatible gateway mode

## Quick Start

Install Bun globally with npm:

```sh
npm install -g bun
```

Install dependencies:

```sh
bun install
```

Start the interactive CLI:

```sh
bun run cc
```

Run a single prompt:

```sh
bun run cc --print "hello"
```

Debug startup:

```sh
bun run cc --debug-to-stderr
```

## Official Anthropic

```powershell
$env:ANTHROPIC_API_KEY='your-key'

bun run cc
```

## DashScope / Qwen

```powershell
$env:DASHSCOPE_API_KEY='your-key'
$env:DASHSCOPE_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1'
$env:DASHSCOPE_MODEL='qwen3.5-plus'

bun run cc
```

Useful DashScope environment variables:

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `DASHSCOPE_MODEL`
- `DASHSCOPE_DEFAULT_OPUS_MODEL`
- `DASHSCOPE_DEFAULT_SONNET_MODEL`
- `DASHSCOPE_DEFAULT_HAIKU_MODEL`

If `DASHSCOPE_API_KEY` is set, the current process switches to DashScope mode
and ignores inherited Anthropic auth settings for that run.

## License

This repository includes an MIT license template in [LICENSE](./LICENSE).
