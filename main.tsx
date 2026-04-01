const DASHSCOPE_ANTHROPIC_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DASHSCOPE_DEFAULT_MAIN_MODEL = 'qwen3.5-plus'
const DASHSCOPE_DEFAULT_FAST_MODEL = 'qwen3-coder-next'
const MACRO_FALLBACK = {
  VERSION: '2.1.87',
  BUILD_TIME: '',
  PACKAGE_URL: '@anthropic-ai/claude-code',
  NATIVE_PACKAGE_URL: '@anthropic-ai/claude-code',
  VERSION_CHANGELOG: '',
  ISSUES_EXPLAINER: 'report it in the issue tracker',
  FEEDBACK_CHANNEL: 'the issue tracker',
} as const

function applyMacroFallback(): void {
  if (typeof globalThis.MACRO === 'undefined') {
    globalThis.MACRO = MACRO_FALLBACK
  }
}

function applyDashScopeCompatEnv(): void {
  const dashscopeApiKey = process.env.DASHSCOPE_API_KEY
  if (!dashscopeApiKey) {
    return
  }

  const dashscopeBaseUrl =
    process.env.DASHSCOPE_BASE_URL ?? DASHSCOPE_ANTHROPIC_BASE_URL
  const usesOpenAICompat = dashscopeBaseUrl.includes('/compatible-mode/')

  // When the user explicitly opts into DashScope mode for this process,
  // treat routing as host-managed so settings/env files cannot override it.
  process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST = '1'
  if (usesOpenAICompat) {
    process.env.CLAUDE_CODE_OPENAI_COMPAT = '1'
  } else {
    delete process.env.CLAUDE_CODE_OPENAI_COMPAT
  }

  // Override inherited Anthropic credentials for this process only.
  delete process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_AUTH_TOKEN = dashscopeApiKey
  process.env.ANTHROPIC_BASE_URL = dashscopeBaseUrl
  process.env.ANTHROPIC_MODEL ??=
    process.env.DASHSCOPE_MODEL ?? DASHSCOPE_DEFAULT_MAIN_MODEL
  process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ??=
    process.env.DASHSCOPE_DEFAULT_OPUS_MODEL ??
    process.env.DASHSCOPE_MODEL ??
    DASHSCOPE_DEFAULT_MAIN_MODEL
  process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ??=
    process.env.DASHSCOPE_DEFAULT_SONNET_MODEL ??
    process.env.DASHSCOPE_MODEL ??
    DASHSCOPE_DEFAULT_MAIN_MODEL
  process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ??=
    process.env.DASHSCOPE_DEFAULT_HAIKU_MODEL ?? DASHSCOPE_DEFAULT_FAST_MODEL
}

applyMacroFallback()
applyDashScopeCompatEnv()

const { main } = await import('./src/main.js')

void main()
