// LLM 服务配置
export interface LLMConfig {
  provider: string
  name: string
  apiKey: string
  endpoint?: string
  model: string
  currentTime?: string  // 当前时间，用于相对时间计算
}

export interface LLMResponse {
  success: boolean
  timeText?: string
  deadline?: string
  error?: string
}

// 可用的 LLM 提供商
export const LLM_PROVIDERS = [
  {
    id: 'openai',
    name: 'ChatGPT (OpenAI)',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    endpoint: 'https://api.openai.com/v1/chat/completions',
    free: '有免费额度'
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
    endpoint: 'https://api.anthropic.com/v1/messages',
    free: '有免费额度'
  },
  {
    id: 'google',
    name: 'Gemini (Google)',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    free: '有免费额度'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    free: '有免费额度'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    models: ['MiniMax-M2.7', 'MiniMax-Text-01', 'abab6.5s-chat', 'abab5.5s-chat'],
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    free: '需要申请'
  },
  {
    id: 'moonshot',
    name: 'Kimi (Moonshot)',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    free: '需要申请'
  },
  {
    id: 'zhipu',
    name: '智谱清言 (智谱AI)',
    models: ['glm-4-flash', 'glm-4v', 'glm-3-turbo'],
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    free: '有免费额度'
  },
  {
    id: 'ali',
    name: '通义千问 (阿里云)',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    free: '有免费额度'
  }
]

// 系统提示词
const SYSTEM_PROMPT = `你是一个时间解析助手。用户会输入一段话，你需要从中提取任务内容，并计算出精确的时间点。

当前时间：2026年4月8日 下午1点（13:00）

请分析用户输入，计算出精确的时间点。

支持的格式：
- 具体日期：今天、明天、后天、下周、下个月、4月10号、星期三、下星期一
- 具体时间：上午9点、下午3点、11:05、11点5分、3点50
- 组合：明天下午3点、下周星期一9点
- 相对时间：两小时后（= 15:00）、半小时后（= 13:30）、三小时后（= 16:00）

重要：根据上下文智能推断时间！
- "看月亮"、"赏月" → 晚上20:00-21:00，今晚
- "起床"、"吃早饭" → 早上7:00-8:00
- "吃午饭" → 中午12:00
- "吃晚饭" → 晚上18:00-19:00
- "两小时后" → 当前时间 + 2小时 = 15:00
- "半小时后" → 当前时间 + 30分钟 = 13:30

返回格式（必须是有效的JSON）：
{
  "task": "任务内容",
  "deadline": "YYYY-MM-DDTHH:mm格式的精确时间，如：2026-04-08T15:00"
}

注意：
- deadline 必须是精确的日期时间，格式为 YYYY-MM-DDTHH:mm
- 不要返回中文时间描述，直接返回计算好的具体时间
- task 应该只包含任务内容，不包含时间
`

// 带超时的 fetch
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 15000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// 解析用户输入的时间
export async function parseTimeWithLLM(text: string, config: LLMConfig): Promise<LLMResponse> {
  if (!config.apiKey) {
    return { success: false, error: '请先配置 API Key' }
  }

  // 构建用户消息，包含当前时间
  const userMessage = config.currentTime
    ? `当前时间：${config.currentTime}\n\n用户输入：${text}`
    : text

  try {
    let response: Response

    switch (config.provider) {
      case 'openai':
        response = await fetchWithTimeout(config.endpoint || 'https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1
          })
        })
        break

      case 'anthropic':
        response = await fetchWithTimeout(config.endpoint || 'https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: config.model || 'claude-3-5-sonnet-latest',
            max_tokens: 1024,
            messages: [
              { role: 'user', content: `系统提示：${SYSTEM_PROMPT}\n\n${userMessage}` }
            ]
          })
        })
        break

      case 'google':
        response = await fetchWithTimeout(`${config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${config.model || 'gemini-2.0-flash'}:generateContent?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `系统提示：${SYSTEM_PROMPT}\n\n${userMessage}` }]
            }],
            generationConfig: { temperature: 0.1 }
          })
        })
        break

      case 'deepseek':
        response = await fetchWithTimeout(config.endpoint || 'https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1
          })
        })
        break

      case 'minimax':
        response = await fetchWithTimeout(config.endpoint || 'https://api.minimax.chat/v1/text/chatcompletion_v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'abab6.5s-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1
          })
        })
        break

      case 'moonshot':
        response = await fetchWithTimeout(config.endpoint || 'https://api.moonshot.cn/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'moonshot-v1-8k',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1
          })
        })
        break

      case 'zhipu':
        response = await fetchWithTimeout(config.endpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'glm-4-flash',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1
          })
        })
        break

      case 'ali':
        response = await fetchWithTimeout(config.endpoint || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'qwen-turbo',
            input: {
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage }
              ]
            },
            parameters: { temperature: 0.1 }
          })
        })
        break

      default:
        return { success: false, error: '不支持的模型提供商' }
    }

    if (!response.ok) {
      const errorText = await response.text()
      // 检查是否是 CORS 错误
      if (response.type === 'opaque' || response.status === 0) {
        return { success: false, error: '网络错误：可能是 CORS 限制或 API 不支持浏览器直接调用' }
      }
      return { success: false, error: `API 错误: ${response.status} - ${errorText}` }
    }

    const data = await response.json()

    // 解析不同格式的响应
    let content = ''
    try {
      switch (config.provider) {
        case 'openai':
        case 'deepseek':
        case 'moonshot':
        case 'zhipu':
          content = data.choices?.[0]?.message?.content || ''
          break
        case 'anthropic':
          content = data.content?.[0]?.text || ''
          break
        case 'google':
          content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          break
        case 'minimax':
          content = data.choices?.[0]?.messages?.[0]?.content || data.choices?.[0]?.messages?.[0]?.text || ''
          break
        case 'ali':
          content = data.output?.text || ''
          break
      }
    } catch (e) {
      return { success: false, error: '解析响应失败' }
    }

    // 解析 JSON
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          success: true,
          timeText: result.time || '',
          deadline: result.deadline || undefined,
        }
      }
      return { success: false, error: '无法解析时间信息' }
    } catch (e) {
      return { success: false, error: '解析 JSON 失败' }
    }

  } catch (error: any) {
    // 处理超时错误
    if (error.name === 'AbortError') {
      return { success: false, error: '请求超时（15秒），请检查网络或 API 是否可用' }
    }
    return { success: false, error: error.message || '请求失败' }
  }
}
