// LLM 服务配置
export interface LLMConfig {
  provider: string
  name: string
  apiKey: string
  endpoint?: string
  model: string
}

export interface LLMResponse {
  success: boolean
  timeText?: string
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
    models: ['abab6.5s-chat', 'abab5.5s-chat'],
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
const SYSTEM_PROMPT = `你是一个时间解析助手。用户会输入一段话，你需要从中提取时间信息并返回。

支持的格式：
- 具体日期：今天、明天、后天、下周、下个月、4月10号、星期三、下星期一
- 具体时间：上午9点、下午3点、11:05、11点5分、3点50
- 组合：明天下午3点、下周星期一9点

请分析用户输入，提取任务内容和时间。

返回格式（必须是有效的JSON）：
{
  "task": "任务内容（如果只有时间没有任务内容，则为空字符串）",
  "time": "解析出的时间描述（如：明天上午9点，或下午3点50）",
  "deadline": "ISO格式日期时间（如：2026-04-05T15:50），只在能确定具体时间时才返回"
}

注意：
- 如果用户没有提到具体时间，deadline 返回 null
- 只解析中文时间表达
- task 应该只包含任务内容，不包含时间
`

// 解析用户输入的时间
export async function parseTimeWithLLM(text: string, config: LLMConfig): Promise<LLMResponse> {
  if (!config.apiKey) {
    return { success: false, error: '请先配置 API Key' }
  }

  try {
    let response: Response

    switch (config.provider) {
      case 'openai':
        response = await fetch(config.endpoint || 'https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text }
            ],
            temperature: 0.1
          })
        })
        break

      case 'anthropic':
        response = await fetch(config.endpoint || 'https://api.anthropic.com/v1/messages', {
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
              { role: 'user', content: `系统提示：${SYSTEM_PROMPT}\n\n用户输入：${text}` }
            ]
          })
        })
        break

      case 'google':
        response = await fetch(`${config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${config.model || 'gemini-2.0-flash'}:generateContent?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `系统提示：${SYSTEM_PROMPT}\n\n用户输入：${text}` }]
            }],
            generationConfig: { temperature: 0.1 }
          })
        })
        break

      case 'deepseek':
        response = await fetch(config.endpoint || 'https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text }
            ],
            temperature: 0.1
          })
        })
        break

      case 'minimax':
        response = await fetch(config.endpoint || 'https://api.minimax.chat/v1/text/chatcompletion_v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'abab6.5s-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text }
            ],
            temperature: 0.1
          })
        })
        break

      case 'moonshot':
        response = await fetch(config.endpoint || 'https://api.moonshot.cn/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'moonshot-v1-8k',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text }
            ],
            temperature: 0.1
          })
        })
        break

      case 'zhipu':
        response = await fetch(config.endpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'glm-4-flash',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text }
            ],
            temperature: 0.1
          })
        })
        break

      case 'ali':
        response = await fetch(config.endpoint || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
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
                { role: 'user', content: text }
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
          content = data.choices?.[0]?.messages?.[0]?.text || ''
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
          timeText: result.time || result.deadline || '',
        }
      }
      return { success: false, error: '无法解析时间信息' }
    } catch (e) {
      return { success: false, error: '解析 JSON 失败' }
    }

  } catch (error: any) {
    return { success: false, error: error.message || '请求失败' }
  }
}
