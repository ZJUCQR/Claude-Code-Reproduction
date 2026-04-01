# Claude-Code 命令行复刻版 (Reproduction)

[English](README.md) | [简体中文](README_zh-CN.md)

这是一个命令行界面 (CLI) 工具，旨在复刻并兼容 Claude Code 的核心交互功能。

> **⚠️ 免责声明与警告：** > 本项目代码基于泄露的 Claude Code 相关代码进行复刻，仅供个人学习、技术研究和安全测试使用。请勿用于商业用途。

## ✨ 核心功能

- **交互模式**：提供沉浸式的终端聊天体验。
- **非交互模式**：支持通过命令行参数进行单次快速问答。
- **模型 API 支持**：原生兼容官方 Anthropic API，同时通过兼容网关模式无缝支持阿里云百炼大模型。

## 🚀 快速开始

### 1. 环境准备

本项目需要依赖 Bun 运行时。首先，请通过 npm 全局安装 Bun：

```
npm install -g bun
```

### 2. 安装依赖

将本项目克隆到本地后，在项目根目录下运行以下命令安装依赖：

```
bun install
```

### 3. 基础命令

启动交互式终端：

```
bun run cc
```

运行单次提示词（非交互模式）：

```
bun run cc --print "你好，请介绍一下你自己"
```

开启调试模式以查看日志：

```
bun run cc --debug-to-stderr
```

## 📖 使用指南

您可以根据自己拥有的 API 密钥，在以下任一模式下运行本项目。

### 模式 1：使用官方 Anthropic API

配置您的官方密钥并运行工具。

**Windows (PowerShell):**

```
$env:ANTHROPIC_API_KEY="your-official-key"
bun run cc
```

### 模式 2：使用阿里云 DashScope

如果您希望使用阿里云百炼模型，请配置以下环境变量。

**Windows (PowerShell):**

```
$env:DASHSCOPE_API_KEY="your-dashscope-key"
$env:DASHSCOPE_BASE_URL="your-dashscope-url"
$env:DASHSCOPE_MODEL="qwen3.5-plus"
bun run cc
```

> **💡 提示：** 如果程序检测到当前环境中设置了 `DASHSCOPE_API_KEY`，当前进程将自动切换到 DashScope 模式，忽略该次运行的任何 Anthropic 设置。

## 📄 开源协议 (License)

本项目根目录提供了一份 MIT 开源协议模板。请注意，由于代码来源的特殊性，此协议仅限制本仓库中经过二次修改或独立编写的代码部分。