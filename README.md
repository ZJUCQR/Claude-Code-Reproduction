# Claude-Code Reproduction

[English](README.md) | [简体中文](https://www.google.com/search?q=README_zh-CN.md)

This is a Command Line Interface (CLI) tool designed to reproduce and be compatible with the core interactive features of Claude Code.

> **⚠️ Disclaimer and Warning:** > The code in this project is based on the reproduction of leaked Claude Code related code. It is only for personal learning, technical research, and security testing purposes.

## ✨ Core Features

- **Interactive Mode:** Provides an immersive terminal chat experience.
- **Non-Interactive Mode:** Supports single quick Q&A sessions via command-line arguments.
- **Model API Support:** Natively compatible with the official Anthropic API, while seamlessly supporting Alibaba Cloud DashScope models via a compatible gateway mode.

## 🚀 Quick Start

### 1. Environment Setup

This project requires the Bun runtime. First, please install Bun globally via npm:

```
npm install -g bun
```

### 2. Install Dependencies

After cloning this project locally, run the following command in the project root directory:

```
bun install
```

### 3. Basic Commands

Start the interactive terminal:

```
bun run cc
```

Run a single prompt (non-interactive mode):

```
bun run cc --print "Hello, please introduce yourself"
```

Enable debug mode for logging:

```
bun run cc --debug-to-stderr
```

## 📖 Usage Guide

You can run this project in any of the following modes depending on the API key you possess.

### Mode 1: Using Official Anthropic

Configure your official key and run the tool.

**Windows (PowerShell):**

```
$env:ANTHROPIC_API_KEY="your-official-key"
bun run cc
```

### Mode 2: Using Alibaba Cloud DashScope

If you use DashScope models, please configure the following environment variables.

**Windows (PowerShell):**

```
$env:DASHSCOPE_API_KEY="your-dashscope-key"
$env:DASHSCOPE_BASE_URL="your-dashscope-url"
$env:DASHSCOPE_MODEL="qwen3.5-plus"
bun run cc
```

> **💡 Tip:** If the program detects that `DASHSCOPE_API_KEY` is set in the current environment, the current process will automatically switch to DashScope mode and ignore any Anthropic settings for that specific run.

## 📄 License

An MIT open-source license template is provided in the root directory of this project. Please note that due to the special nature of the code's source, this license only restricts the portions of the code that have been secondarily modified or independently written within this repository.
