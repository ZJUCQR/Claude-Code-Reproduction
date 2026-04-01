import type Anthropic from '@anthropic-ai/sdk'
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from '@anthropic-ai/sdk'
import type { ClientOptions } from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'

type RequestOptions = {
  headers?: Record<string, string>
  signal?: AbortSignal
  timeout?: number
}

type ChatCompletionToolCall = {
  id?: string
  type?: 'function'
  function?: {
    name?: string
    arguments?: string
  }
}

type ChatCompletionResponse = {
  id?: string
  model?: string
  choices?: Array<{
    finish_reason?: string | null
    message?: {
      role?: string
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: ChatCompletionToolCall[]
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

type CompatResponseEnvelope<T> = {
  data: T
  requestId: null | string
  response: Response
}

class CompatAPIPromise<T> implements PromiseLike<T> {
  constructor(
    private readonly inner: Promise<CompatResponseEnvelope<T>>,
  ) {}

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.inner.then(result => result.data).then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: unknown) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<T | TResult> {
    return this.then(undefined, onrejected)
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<T> {
    return this.then(
      value => {
        onfinally?.()
        return value
      },
      error => {
        onfinally?.()
        throw error
      },
    )
  }

  withResponse(): Promise<{
    data: T
    request_id: null | string
    response: Response
  }> {
    return this.inner.then(({ data, requestId, response }) => ({
      data,
      request_id: requestId,
      response,
    }))
  }

  asResponse(): Promise<Response> {
    return this.inner.then(({ response }) => response)
  }
}

type CompatStream<T> = AsyncIterable<T> & {
  controller: AbortController
}

function createCompatStream<T>(events: T[]): CompatStream<T> {
  const controller = new AbortController()
  return {
    controller,
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        if (controller.signal.aborted) {
          return
        }
        yield event
      }
    },
  }
}

function parseJsonOrDefault(value: string | undefined): unknown {
  if (!value) {
    return {}
  }
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function flattenToolResultContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .map(item => {
      if (typeof item === 'string') {
        return item
      }
      if (
        item &&
        typeof item === 'object' &&
        'type' in item &&
        item.type === 'text' &&
        'text' in item &&
        typeof item.text === 'string'
      ) {
        return item.text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function anthropicMessagesToOpenAI(
  system: unknown,
  messages: Array<{ role: string; content: unknown }>,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = []

  if (Array.isArray(system)) {
    for (const block of system) {
      if (
        block &&
        typeof block === 'object' &&
        'text' in block &&
        typeof block.text === 'string'
      ) {
        result.push({ role: 'system', content: block.text })
      }
    }
  }

  for (const message of messages) {
    if (typeof message.content === 'string') {
      result.push({ role: message.role, content: message.content })
      continue
    }

    if (!Array.isArray(message.content)) {
      result.push({ role: message.role, content: '' })
      continue
    }

    if (message.role === 'assistant') {
      const textParts: string[] = []
      const toolCalls: Array<Record<string, unknown>> = []

      for (const block of message.content) {
        if (!block || typeof block !== 'object' || !('type' in block)) {
          continue
        }
        if (block.type === 'text' && 'text' in block && typeof block.text === 'string') {
          textParts.push(block.text)
        }
        if (block.type === 'tool_use' && 'name' in block && typeof block.name === 'string') {
          toolCalls.push({
            id:
              'id' in block && typeof block.id === 'string'
                ? block.id
                : `call_${randomUUID().replace(/-/g, '')}`,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(
                'input' in block ? (block.input ?? {}) : {},
              ),
            },
          })
        }
      }

      result.push({
        role: 'assistant',
        content: textParts.join('\n\n'),
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      })
      continue
    }

    const textParts: string[] = []
    for (const block of message.content) {
      if (!block || typeof block !== 'object' || !('type' in block)) {
        continue
      }
      if (block.type === 'text' && 'text' in block && typeof block.text === 'string') {
        textParts.push(block.text)
        continue
      }
      if (
        block.type === 'tool_result' &&
        'tool_use_id' in block &&
        typeof block.tool_use_id === 'string'
      ) {
        result.push({
          role: 'tool',
          tool_call_id: block.tool_use_id,
          content: flattenToolResultContent('content' in block ? block.content : ''),
        })
      }
    }

    if (textParts.length > 0) {
      result.push({
        role: message.role,
        content: textParts.join('\n\n'),
      })
    }
  }

  return result
}

function anthropicToolsToOpenAI(
  tools: unknown,
): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(tools) || tools.length === 0) {
    return undefined
  }

  return tools
    .filter(tool => tool && typeof tool === 'object')
    .map(tool => {
      const schema =
        'input_schema' in tool && tool.input_schema && typeof tool.input_schema === 'object'
          ? tool.input_schema
          : { type: 'object', properties: {} }
      return {
        type: 'function',
        function: {
          name:
            'name' in tool && typeof tool.name === 'string'
              ? tool.name
              : `tool_${randomUUID().replace(/-/g, '')}`,
          description:
            'description' in tool && typeof tool.description === 'string'
              ? tool.description
              : '',
          parameters: schema,
        },
      }
    })
}

function anthropicToolChoiceToOpenAI(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== 'object' || !('type' in toolChoice)) {
    return undefined
  }
  if (toolChoice.type === 'tool' && 'name' in toolChoice) {
    return {
      type: 'function',
      function: {
        name: toolChoice.name,
      },
    }
  }
  if (toolChoice.type === 'any') {
    return 'required'
  }
  return 'auto'
}

function buildOpenAIRequestBody(params: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: anthropicMessagesToOpenAI(
      Array.isArray(params.system) ? params.system : [],
      Array.isArray(params.messages) ? (params.messages as Array<{ role: string; content: unknown }>) : [],
    ),
    stream: false,
  }

  if (typeof params.max_tokens === 'number') {
    body.max_tokens = params.max_tokens
  }
  if (typeof params.temperature === 'number') {
    body.temperature = params.temperature
  }

  const tools = anthropicToolsToOpenAI(params.tools)
  if (tools && tools.length > 0) {
    body.tools = tools
    const toolChoice = anthropicToolChoiceToOpenAI(params.tool_choice)
    if (toolChoice !== undefined) {
      body.tool_choice = toolChoice
    }
  }

  return body
}

function normalizeUsage(response: ChatCompletionResponse) {
  return {
    input_tokens: response.usage?.prompt_tokens ?? 0,
    output_tokens: response.usage?.completion_tokens ?? 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    server_tool_use: {
      web_search_requests: 0,
      web_fetch_requests: 0,
    },
    service_tier: null,
    cache_creation: {
      ephemeral_1h_input_tokens: 0,
      ephemeral_5m_input_tokens: 0,
    },
    inference_geo: null,
    iterations: null,
    speed: null,
  }
}

function normalizeStopReason(finishReason: string | null | undefined) {
  switch (finishReason) {
    case 'tool_calls':
      return 'tool_use'
    case 'length':
      return 'max_tokens'
    case 'stop':
    default:
      return 'end_turn'
  }
}

function completionToAnthropicMessage(response: ChatCompletionResponse) {
  const choice = response.choices?.[0]
  const message = choice?.message
  const content: Array<Record<string, unknown>> = []

  if (message?.reasoning_content) {
    content.push({
      type: 'thinking',
      thinking: message.reasoning_content,
      signature: '',
    })
  }

  if (message?.content) {
    content.push({
      type: 'text',
      text: message.content,
    })
  }

  if (Array.isArray(message?.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      content.push({
        type: 'tool_use',
        id:
          toolCall.id ??
          `call_${randomUUID().replace(/-/g, '')}`,
        name: toolCall.function?.name ?? 'tool',
        input: parseJsonOrDefault(toolCall.function?.arguments),
      })
    }
  }

  return {
    id: response.id ?? `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    model: response.model ?? 'unknown',
    content,
    stop_reason: normalizeStopReason(choice?.finish_reason),
    stop_sequence: null,
    usage: normalizeUsage(response),
    container: null,
    context_management: null,
  }
}

function completionToAnthropicStreamEvents(
  response: ChatCompletionResponse,
): Array<Record<string, unknown>> {
  const message = completionToAnthropicMessage(response)
  const usage = normalizeUsage(response)
  const events: Array<Record<string, unknown>> = [
    {
      type: 'message_start',
      message: {
        ...message,
        content: [],
        stop_reason: null,
        usage,
      },
    },
  ]

  let index = 0
  for (const block of message.content) {
    if (block.type === 'thinking') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: {
          type: 'thinking',
          thinking: '',
          signature: '',
        },
      })
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'thinking_delta',
          thinking: block.thinking,
        },
      })
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'signature_delta',
          signature: '',
        },
      })
      events.push({
        type: 'content_block_stop',
        index,
      })
      index++
      continue
    }

    if (block.type === 'text') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: {
          type: 'text',
          text: '',
        },
      })
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'text_delta',
          text: block.text,
        },
      })
      events.push({
        type: 'content_block_stop',
        index,
      })
      index++
      continue
    }

    if (block.type === 'tool_use') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: '',
        },
      })
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(block.input ?? {}),
        },
      })
      events.push({
        type: 'content_block_stop',
        index,
      })
      index++
    }
  }

  events.push({
    type: 'message_delta',
    delta: {
      stop_reason: message.stop_reason,
    },
    usage,
  })
  events.push({
    type: 'message_stop',
  })
  return events
}

function estimateInputTokens(body: Record<string, unknown>): number {
  return Math.ceil(JSON.stringify(body).length / 4)
}

async function fetchWithTimeout(
  fetchImpl: ClientOptions['fetch'] | undefined,
  url: string,
  init: RequestInit,
  timeoutMs: number | undefined,
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  let externalAborted = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const abortExternal = () => {
    externalAborted = true
    controller.abort()
  }

  if (init.signal) {
    if (init.signal.aborted) {
      throw new APIUserAbortError()
    }
    init.signal.addEventListener('abort', abortExternal, { once: true })
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
  }

  try {
    const response = await (fetchImpl ?? globalThis.fetch)(url, {
      ...init,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (timedOut) {
      throw new APIConnectionTimeoutError({})
    }
    if (externalAborted) {
      throw new APIUserAbortError()
    }
    throw new APIConnectionError({
      cause: error instanceof Error ? error : undefined,
    })
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    init.signal?.removeEventListener('abort', abortExternal)
  }
}

class OpenAICompatibleMessages {
  constructor(
    private readonly config: {
      authToken?: string
      baseURL: string
      defaultHeaders: Record<string, string>
      fetchImpl?: ClientOptions['fetch']
      timeout: number
    },
  ) {}

  create(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): CompatAPIPromise<unknown> {
    return new CompatAPIPromise(this.createInternal(params, options))
  }

  async countTokens(params: Record<string, unknown>): Promise<{ input_tokens: number }> {
    const body = buildOpenAIRequestBody(params)
    return {
      input_tokens: estimateInputTokens(body),
    }
  }

  private async createInternal(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<CompatResponseEnvelope<unknown>> {
    const url = buildOpenAIChatCompletionsUrl(this.config.baseURL)
    const requestBody = buildOpenAIRequestBody(params)
    const headers = new Headers(this.config.defaultHeaders)

    if (this.config.authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.config.authToken}`)
    }
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value)
      }
    }
    headers.set('Content-Type', 'application/json')

    const rawResponse = await fetchWithTimeout(
      this.config.fetchImpl,
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      },
      options?.timeout ?? this.config.timeout,
    )

    let json: ChatCompletionResponse | undefined
    try {
      json = (await rawResponse.json()) as ChatCompletionResponse
    } catch (error) {
      throw new APIConnectionError({
        cause: error instanceof Error ? error : undefined,
      })
    }

    const response = new Response(JSON.stringify(json), {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
      headers: rawResponse.headers,
    })

    if (!rawResponse.ok) {
      throw APIError.generate(
        rawResponse.status,
        json as Record<string, unknown> | undefined,
        undefined,
        rawResponse.headers,
      )
    }

    const requestId =
      rawResponse.headers.get('request-id') ??
      rawResponse.headers.get('x-request-id') ??
      json.id ??
      null

    if (params.stream === true) {
      return {
        data: createCompatStream(
          completionToAnthropicStreamEvents(json),
        ) as unknown,
        requestId,
        response,
      }
    }

    return {
      data: completionToAnthropicMessage(json) as unknown,
      requestId,
      response,
    }
  }
}

function buildOpenAIChatCompletionsUrl(baseURL: string): string {
  const normalized = baseURL.replace(/\/+$/, '')
  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }
  return `${normalized}/chat/completions`
}

export function shouldUseOpenAICompatClient(baseURL: string): boolean {
  if (process.env.CLAUDE_CODE_OPENAI_COMPAT === '1') {
    return true
  }
  return /\/compatible-mode\/v\d+(?:\/|$)/.test(baseURL)
}

export function createOpenAICompatClient(config: {
  authToken?: string
  baseURL: string
  defaultHeaders: Record<string, string>
  fetch?: ClientOptions['fetch']
  timeout: number
}): Anthropic {
  const messages = new OpenAICompatibleMessages({
    authToken: config.authToken,
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
    fetchImpl: config.fetch,
    timeout: config.timeout,
  })

  return {
    beta: {
      messages,
    },
    messages,
    models: {
      async *list() {},
    },
  } as unknown as Anthropic
}
