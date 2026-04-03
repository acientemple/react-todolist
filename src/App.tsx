import { useState, useEffect, useRef } from 'react'
import { AuthService, FirebaseDB } from './firebase'
import type { User } from './firebase'
import emailjs from '@emailjs/browser'

// EmailJS 配置
const EMAILJS_SERVICE_ID = 'service_mm0l2m5'
const EMAILJS_TEMPLATE_ID = 'template_vmv2xvo'
const EMAILJS_PUBLIC_KEY = 'LsNvV4SDNGLYE7PuD'

interface Todo {
  id: number
  text: string
  completed: boolean
  deadline?: string
  notified?: boolean
  deletedAt?: number
}

const STORAGE_KEY = 'react-todolist'
const DELETED_KEY = 'react-todolist-deleted'

function parseTimeFromText(text: string): { taskText: string; deadline?: string } {
  const now = new Date()
  let deadline: string | undefined
  let taskText = text

  // 清理文本
  const cleanText = text.replace(/[。！？，、]/g, ' ').replace(/\s+/g, ' ').trim()
  console.log('解析文本:', cleanText)

  let timePart = ''
  let remainingText = cleanText
  let targetDate: Date | null = null
  let hasExplicitDate = false  // 是否明确指定了日期（如下午3点、明天、星期一等）

  // 1. 先匹配具体日期：4月10号、4月10日、10号、10日
  const monthDayMatch = cleanText.match(/(\d{1,2})月(\d{1,2})[号日]/)
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1])
    const day = parseInt(monthDayMatch[2])
    targetDate = new Date(now.getFullYear(), month - 1, day)
    hasExplicitDate = true
    remainingText = remainingText.replace(monthDayMatch[0], ' ').replace(/\s+/g, ' ').trim()
    console.log('匹配到日期:', month + '月' + day + '日')
  } else {
    // 简单日期：10号、10日（当前月）
    const simpleDayMatch = cleanText.match(/^(\d{1,2})[号日]/)
    if (simpleDayMatch && !cleanText.includes('月')) {
      const day = parseInt(simpleDayMatch[1])
      targetDate = new Date(now.getFullYear(), now.getMonth(), day)
      hasExplicitDate = true
      remainingText = remainingText.replace(simpleDayMatch[0], ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到日期:', day + '日')
    }
  }

  // 2. 先移除星期相关文字（避免数字转换干扰）
  const weekdays = ['星期日', '星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekDayMap: Record<string, number> = {
    '星期日': 0, '星期天': 0, '周日': 0,
    '星期一': 1, '周一': 1,
    '星期二': 2, '周二': 2,
    '星期三': 3, '周三': 3,
    '星期四': 4, '周四': 4,
    '星期五': 5, '周五': 5,
    '星期六': 6, '周六': 6
  }

  let matchedWeekday = ''
  let isNextWeek = false

  // 优先匹配"下星期X"或"下周一"这种模式（数字形式的星期）
  const weekNumMatch = cleanText.match(/下星期(\d)|下周(\d)|下礼拜(\d)/)
  console.log('weekNumMatch:', weekNumMatch)
  if (weekNumMatch) {
    const dayNum = parseInt(weekNumMatch[1] || weekNumMatch[2] || weekNumMatch[3])
    console.log('dayNum:', dayNum, 'currentDay:', now.getDay())
    if (dayNum >= 0 && dayNum <= 6) {
      isNextWeek = true
      const currentDay = now.getDay()
      let daysUntil = dayNum - currentDay
      console.log('daysUntil初始:', daysUntil)
      if (daysUntil <= 0) daysUntil += 7
      console.log('daysUntil调整后:', daysUntil)
      targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + daysUntil)
      remainingText = remainingText.replace(weekNumMatch[0], ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到下星期:', dayNum, '目标:', targetDate.toLocaleDateString('zh-CN'))
    }
  } else {
    // 匹配中文星期
    for (const word of weekdays) {
      if (cleanText.includes(word)) {
        matchedWeekday = word
        remainingText = remainingText.replace(word, ' ').replace(/\s+/g, ' ').trim()
        break
      }
    }

    console.log('matchedWeekday:', matchedWeekday, 'cleanText包含下星期:', cleanText.includes('下星期'))

    if (matchedWeekday && (cleanText.includes('下周') || cleanText.includes('下星期') || cleanText.includes('下礼拜'))) {
      isNextWeek = true
    }

    // 移除"下"前缀
    remainingText = remainingText.replace(/^下星期|^下礼拜|^下周/, ' ').replace(/\s+/g, ' ').trim()
  }

  // 2. 匹配星期（中文形式）
  if (!targetDate && matchedWeekday) {
    const targetDay = weekDayMap[matchedWeekday] ?? 0
    const currentDay = now.getDay()
    let daysUntil = targetDay - currentDay
    if (isNextWeek) daysUntil += 7
    if (daysUntil <= 0) daysUntil += 7
    targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + daysUntil)
    hasExplicitDate = true
    console.log('匹配到星期:', matchedWeekday, 'isNextWeek:', isNextWeek, 'currentDay:', currentDay, 'targetDay:', targetDay, 'daysUntil:', daysUntil, '目标:', targetDate.toLocaleDateString('zh-CN'))
  }

  // 3. 匹配明天/后天/今天
  if (!targetDate) {
    let dayOffset = 0
    if (cleanText.includes('明天') || cleanText.includes('明日')) {
      dayOffset = 1
    } else if (cleanText.includes('后天')) {
      dayOffset = 2
    } else if (cleanText.includes('今天') || cleanText.includes('今日')) {
      dayOffset = 0
    }
    if (dayOffset !== 0 || cleanText.includes('明天') || cleanText.includes('今日') || cleanText.includes('今天')) {
      targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + dayOffset)
      hasExplicitDate = true
      remainingText = remainingText.replace(/明天|明日|后天|今天|今日/g, ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到相对日期, 偏移:', dayOffset)
    }
  }

  // 3.5 匹配下周/下星期/下周
  if (!targetDate) {
    if (cleanText.includes('下周') || cleanText.includes('下星期') || cleanText.includes('下礼拜')) {
      targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + 7)
      hasExplicitDate = true
      remainingText = remainingText.replace(/下周|下星期|下礼拜/g, ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到下周')
    }
  }

  // 3.6 匹配下个月X号（如：下个月5号、下月10号、下个月五号）
  if (!targetDate) {
    const cnNum: Record<string, number> = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }

    const nextMonthMatch = cleanText.match(/(下个月|下月)([零一二三四五六七八九十\d]{1,2})号/)
    if (nextMonthMatch) {
      let day = parseInt(nextMonthMatch[2])
      if (isNaN(day)) {
        // 转换中文数字
        const dayCn = nextMonthMatch[2]
        day = cnNum[dayCn] ?? parseInt(dayCn) ?? 0
      }
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, day)
      hasExplicitDate = true
      remainingText = remainingText.replace(nextMonthMatch[0], ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到下个月:', day + '号')
    } else if (cleanText.includes('下个月') || cleanText.includes('下月')) {
      targetDate = new Date(now)
      targetDate.setMonth(targetDate.getMonth() + 1)
      hasExplicitDate = true
      remainingText = remainingText.replace(/下个月|下月/g, ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到下个月')
    }
  }

  // 4. 中文数字转阿拉伯数字
  const cnNum: Record<string, number> = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }

  const convertCnNum = (str: string): string => {
    let result = str
    for (const [cn, num] of Object.entries(cnNum)) {
      result = result.replace(new RegExp(cn, 'g'), String(num))
    }
    return result
  }

  // 先转换中文数字
  const textWithNum = convertCnNum(remainingText)
  console.log('转换后文本:', textWithNum)

  // 匹配时间：上午9点、下午3点、9点、9点半、11:05、11点5分、3点50等
  const timePatterns = [
    /((?:上午|早上|下午|晚上|中午|凌晨)\s*)(\d{1,2})点(?:(\d{1,2})分)?(?:半)?/,  // 上午9点、上午9点30分
    /(\d{1,2}):(\d{2})/,  // 11:05 格式
    /(\d{1,2})点(\d{1,2})分/,  // 11点5分 格式
    /(\d{1,2})点半/,
    /(\d{1,2})点(\d{1,2})/,  // 3点50 格式（点后面直接跟数字）
    /(\d{1,2})点/
  ]

  let timeHour = 12
  let timeMin = 0
  let matchedTime = false

  for (const pattern of timePatterns) {
    const match = textWithNum.match(pattern)
    if (match) {
      timePart = match[0]
      remainingText = remainingText.replace(match[0], ' ').replace(/\s+/g, ' ').trim()
      console.log('匹配到时间:', timePart)

      // 解析小时和分钟
      if (pattern.source.startsWith('(') && pattern.source.includes(':')) {
        // 11:05 格式 - match[1] 是小时, match[2] 是分钟
        timeHour = parseInt(match[1])
        timeMin = parseInt(match[2])
        matchedTime = true
        break
      } else if (pattern.source.includes('点') && pattern.source.includes('分')) {
        // 11点5分 格式 - match[1] 是小时, match[2] 是分钟
        timeHour = parseInt(match[1])
        timeMin = parseInt(match[2])
        matchedTime = true
        break
      } else if (pattern.source.includes('点半')) {
        // 9点半 格式
        timeHour = parseInt(match[1])
        timeMin = 30
        matchedTime = true
        break
      } else if (pattern.source.includes('点') && !pattern.source.includes('分') && match.length >= 3) {
        // 3点50 格式 - 点后面跟数字但没有"分"字
        timeHour = parseInt(match[1])
        timeMin = parseInt(match[2])
        matchedTime = true
        break
      } else if (match[2]) {
        // 上午9点 格式
        timeHour = parseInt(match[2])
        if (match[3]) {
          timeMin = parseInt(match[3])
        }
        matchedTime = true
        break
      } else {
        // 9点 格式
        timeHour = parseInt(match[1])
        matchedTime = true
        break
      }
    }
  }

  // 5. 如果没有匹配到日期，设置默认日期（今天）
  if (!targetDate) {
    targetDate = new Date(now)
  }

  // 6. 解析时间
  if (matchedTime) {
    const isAfternoon = timePart.includes('下午') || timePart.includes('晚上')
    const isMorning = timePart.includes('上午') || timePart.includes('早上') || timePart.includes('中午') || timePart.includes('凌晨')
    console.log('时间解析 - timePart:', timePart, 'hour:', timeHour, 'min:', timeMin, 'isAfternoon:', isAfternoon, 'isMorning:', isMorning)

    let finalHour = timeHour
    // 调整小时：下午/晚上加12
    if (isAfternoon && finalHour < 12) {
      finalHour += 12
    } else if (isMorning && finalHour < 6) {
      finalHour = 8 // 早上6点以前默认为8点
    } else if (!isAfternoon && !isMorning && finalHour < 12) {
      // 纯时间（如"3点"）默认视为下午
      finalHour += 12
      if (finalHour >= 24) finalHour -= 24
    }

    targetDate.setHours(finalHour, timeMin, 0, 0)
  } else {
    // 没有时间，默认中午12点
    targetDate.setHours(12, 0, 0, 0)
  }

  // 如果设定的时间已过，且用户明确指定了日期（如下午3点、明天等），设置到第二天
  // 纯时间（如"3点50"）始终指当天，即使已过也留在当天
  if (hasExplicitDate && targetDate.getTime() < now.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1)
  }

  // 使用本地时间格式
  const pad = (n: number) => n.toString().padStart(2, '0')
  deadline = targetDate.getFullYear() + '-' + pad(targetDate.getMonth() + 1) + '-' + pad(targetDate.getDate()) + 'T' + pad(targetDate.getHours()) + ':' + pad(targetDate.getMinutes())
  console.log('设置截止时间:', deadline, '本地时间:', targetDate.toLocaleString('zh-CN'))

  // 7. 清理任务文本
  const removeWords = ['请', '提醒我', '提醒', '叫我', '帮我', '要', '记得']
  for (const word of removeWords) {
    remainingText = remainingText.split(word).join(' ')
  }
  taskText = remainingText.replace(/\s+/g, ' ').trim()

  return { taskText: taskText || cleanText, deadline }
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [interimText, setInterimText] = useState('')
  const [deadlineValue, setDeadlineValue] = useState('')
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    const saved = localStorage.getItem('notify-enabled')
    return saved ? JSON.parse(saved) : true
  })
  const [notifyMinutes, setNotifyMinutes] = useState(() => {
    const saved = localStorage.getItem('notify-minutes')
    return saved ? JSON.parse(saved) : 120
  })
  const notifyHours = Math.floor(notifyMinutes / 60)
  const notifyMins = notifyMinutes % 60
  const [deletedTodos, setDeletedTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem(DELETED_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [showTrash, setShowTrash] = useState(false)
  const [notifyStatus, setNotifyStatus] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [parsedTime, setParsedTime] = useState('')
  const [voiceResult, setVoiceResult] = useState('')
  const notifiedIds = useRef<Set<number>>(new Set())
  const recognitionRef = useRef<any>(null)
  const interimRef = useRef('')

  // 认证状态
  const [isLoggedIn, setIsLoggedIn] = useState(AuthService.isLoggedIn())
  const [isAdmin, setIsAdmin] = useState(AuthService.isAdmin())
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser())
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'verify'>('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [resetRequests, setResetRequests] = useState<any[]>([])
  const [resetPasswordInput, setResetPasswordInput] = useState('')
  // 验证码相关
  const [verifyTarget, setVerifyTarget] = useState('') // 要验证的用户名
  const [verifyCode, setVerifyCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  // 用户 webhook 设置
  const [userWebhook, setUserWebhook] = useState('')
  const [webhookSaved, setWebhookSaved] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem('notify-enabled', JSON.stringify(notifyEnabled))
  }, [notifyEnabled])

  useEffect(() => {
    localStorage.setItem('notify-minutes', JSON.stringify(notifyMinutes))
  }, [notifyMinutes])

  useEffect(() => {
    localStorage.setItem(DELETED_KEY, JSON.stringify(deletedTodos))
  }, [deletedTodos])

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setVoiceSupported(true)

      const recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (interimTranscript) {
          setInterimText(interimTranscript)
        }

        if (finalTranscript) {
          interimRef.current = finalTranscript
          handleVoiceResult(finalTranscript)
        }
      }

      recognition.onerror = (event: any) => {
        console.error('语音识别错误:', event.error)
        setIsRecording(false)
        setInterimText('')
      }

      recognition.onend = () => {
        // 如果有识别内容但没有final结果，用 interim 结果
        if (interimRef.current) {
          handleVoiceResult(interimRef.current)
          interimRef.current = ''
        }
        setIsRecording(false)
        setInterimText('')
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const formatTimeDisplay = (deadline: string) => {
    const date = new Date(deadline)
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekday = weekdays[date.getDay()]
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours < 12 ? '上午' : '下午'
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours)
    return `${weekday}${month}月${day}日 ${ampm}${displayHours.toString().padStart(2, '0')}:${minutes}`
  }

  const handleVoiceResult = (transcript: string) => {
    setVoiceResult('识别: "' + transcript + '"')
    const { deadline } = parseTimeFromText(transcript)
    setInputValue(transcript)
    setInterimText('')
    if (deadline) {
      setDeadlineValue(deadline)
      setParsedTime('已识别时间: ' + formatTimeDisplay(deadline))
      setTimeout(() => {
        setParsedTime('')
        setVoiceResult('')
      }, 5000)
    } else {
      setTimeout(() => setVoiceResult(''), 3000)
    }
  }

  useEffect(() => {
    if (!notifyEnabled) return

    const checkDeadlines = async () => {
      const now = new Date().getTime()
      const notifyWindow = notifyMinutes * 60 * 1000

      for (const todo of todos) {
        if (!todo.deadline || todo.completed || todo.notified || notifiedIds.current.has(todo.id)) continue

        const deadlineTime = new Date(todo.deadline).getTime()
        const timeDiff = deadlineTime - now

        if (timeDiff > 0 && timeDiff <= notifyWindow) {
          try {
            const notifyData: any = {
              text: todo.text,
              deadline: formatDeadline(todo.deadline).dateStr
            }
            // 如果用户设置了 webhook，添加到请求中
            if (userWebhook) {
              notifyData.webhook = userWebhook
            }
            const response = await fetch('https://react-todolist-rawv.onrender.com/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notifyData)
            })
            const result = await response.json()

            if (result.success) {
              notifiedIds.current.add(todo.id)
              setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, notified: true } : t))
              setNotifyStatus('已提醒: ' + todo.text)
              setTimeout(() => setNotifyStatus(''), 3000)
            }
          } catch (error) {
            console.error('通知服务连接失败:', error)
            setNotifyStatus('通知服务未启动')
            setTimeout(() => setNotifyStatus(''), 3000)
          }
        }
      }
    }

    checkDeadlines()
    const interval = setInterval(checkDeadlines, 60000)
    return () => clearInterval(interval)
  }, [todos, notifyEnabled])

  const addTodo = () => {
    const text = inputValue.trim()
    if (!text) return

    // 解析文本中的时间
    const { deadline: parsedDeadline } = parseTimeFromText(text)

    setTodos([...todos, {
      id: Date.now(),
      text,
      completed: false,
      deadline: parsedDeadline || deadlineValue || undefined
    }])
    setInputValue('')
    setDeadlineValue('')
    if (parsedDeadline) {
      setParsedTime('已识别时间: ' + formatTimeDisplay(parsedDeadline))
      setTimeout(() => setParsedTime(''), 3000)
    } else {
      setParsedTime('')
    }
  }

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id: number) => {
    const todo = todos.find(t => t.id === id)
    if (todo) {
      setDeletedTodos([...deletedTodos, { ...todo, deletedAt: Date.now() }])
    }
    setTodos(todos.filter(todo => todo.id !== id))
    notifiedIds.current.delete(id)
  }

  const restoreTodo = (id: number) => {
    const todo = deletedTodos.find(t => t.id === id)
    if (todo) {
      const { deletedAt, ...rest } = todo
      setTodos([...todos, rest as Todo])
      setDeletedTodos(deletedTodos.filter(t => t.id !== id))
    }
  }

  const permanentlyDelete = (id: number) => {
    setDeletedTodos(deletedTodos.filter(todo => todo.id !== id))
  }

  const clearTrash = () => {
    setDeletedTodos([])
  }

  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed))
  }

  const hasCompleted = todos.some(todo => todo.completed)
  const hasDeleted = deletedTodos.length > 0

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const isOverdue = diff < 0 && !isNaN(diff)

    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekday = weekdays[date.getDay()]
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours < 12 ? '上午' : '下午'
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours)
    const dateStr = `${weekday}${month}月${day}日 ${ampm}${displayHours.toString().padStart(2, '0')}:${minutes}`

    return { dateStr, isOverdue }
  }

  const testNotification = async () => {
    try {
      const response = await fetch('https://react-todolist-rawv.onrender.com/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '测试消息',
          deadline: new Date().toLocaleString('zh-CN')
        })
      })
      const result = await response.json()
      setNotifyStatus(result.success ? '测试通知已发送' : '发送失败: ' + result.message)
      setTimeout(() => setNotifyStatus(''), 3000)
    } catch {
      setNotifyStatus('无法连接通知服务')
      setTimeout(() => setNotifyStatus(''), 3000)
    }
  }

  // 认证处理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthMessage('')

    if (authMode === 'login') {
      const result = await AuthService.login(authUsername, authPassword)
      if (result.success) {
        setIsLoggedIn(true)
        setIsAdmin(result.user?.isAdmin || false)
        setCurrentUser(authUsername)
        // 加载用户的 webhook 设置
        const userData = await FirebaseDB.getUser(authUsername)
        if (userData) {
          const webhook = userData.wechatWebhook || ''
          setUserWebhook(webhook)
          setWebhookSaved(!!webhook)
        }
        setAuthUsername('')
        setAuthPassword('')
      } else {
        setAuthMessage(result.message)
      }
    } else if (authMode === 'register') {
      const result = await AuthService.register(authUsername, authPassword, authEmail)
      if (result.success) {
        setAuthMessage('注册成功，请登录')
        setAuthMode('login')
        setAuthEmail('')
      } else {
        setAuthMessage(result.message)
      }
    } else if (authMode === 'forgot') {
      // 发送验证码
      const result = await AuthService.requestPasswordReset(authUsername)
      setAuthMessage(result.message)
      if (result.success && result.user) {
        // 发送邮件
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        await FirebaseDB.saveVerificationCode(result.user.username, code)

        try {
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_name: result.user.username,
            to_email: result.user.email,
            email: result.user.email,
            reset_code: code
          }, EMAILJS_PUBLIC_KEY)
          setAuthMessage('验证码已发送到您的邮箱')
        } catch (error) {
          console.error('EmailJS error:', error)
          setAuthMessage('邮件发送失败，请稍后重试')
          return
        }

        setVerifyTarget(result.user.username)
        setAuthUsername('')
        setAuthMode('verify')
      }
    } else if (authMode === 'verify') {
      // 验证验证码并重置密码
      if (!verifyCode || verifyCode.length !== 6) {
        setAuthMessage('请输入6位验证码')
        return
      }
      if (!newPassword || newPassword.length < 3) {
        setAuthMessage('新密码至少3位')
        return
      }
      const isValid = await FirebaseDB.verifyCode(verifyTarget, verifyCode)
      if (!isValid) {
        setAuthMessage('验证码错误或已过期')
        return
      }
      await AuthService.adminResetPassword(verifyTarget, newPassword)
      await FirebaseDB.deleteVerificationCode(verifyTarget)
      setAuthMessage('密码重置成功，请登录')
      setVerifyTarget('')
      setVerifyCode('')
      setNewPassword('')
      setAuthMode('login')
    }
  }

  const handleLogout = () => {
    AuthService.logout()
    setIsLoggedIn(false)
    setIsAdmin(false)
    setCurrentUser(null)
    setUserWebhook('')
  }

  const saveWebhook = async () => {
    if (!currentUser) return
    await FirebaseDB.updateUserWebhook(currentUser, userWebhook)
    setWebhookSaved(true)
    setTimeout(() => setWebhookSaved(false), 2000)
  }

  const loadAllUsers = async () => {
    const users = await FirebaseDB.getAllUsers()
    const userList = Object.values(users) as User[]
    setAllUsers(userList)
  }

  const toggleAdmin = async (username: string, currentIsAdmin: boolean) => {
    await AuthService.setAdmin(username, !currentIsAdmin)
    loadAllUsers()
  }

  const deleteUser = async (username: string) => {
    if (window.confirm(`确定删除用户 "${username}" 吗？`)) {
      await AuthService.deleteUser(username)
      loadAllUsers()
    }
  }

  const loadResetRequests = async () => {
    const requests = await FirebaseDB.getResetRequests()
    setResetRequests(requests)
  }

  const handleResetPassword = async (request: any) => {
    if (!resetPasswordInput || resetPasswordInput.length < 3) {
      alert('密码至少3位')
      return
    }
    await AuthService.adminResetPassword(request.username, resetPasswordInput)
    await FirebaseDB.completeResetRequest(request.id)
    setResetPasswordInput('')
    loadResetRequests()
  }

  const toggleVoice = () => {
    if (!recognitionRef.current) return

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      setInterimText('')
    } else {
      setInputValue('')
      setDeadlineValue('')
      setParsedTime('')
      setInterimText('')
      setVoiceResult('')
      interimRef.current = ''
      recognitionRef.current.start()
      setIsRecording(true)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-top">
            <div>
              <h1>待办事项</h1>
              <p className="subtitle">{todos.filter(t => !t.deletedAt && !t.completed).length} 项待完成</p>
            </div>
            <div className="auth-section">
              {isLoggedIn && (
                <>
                  <span className="user-info">
                    {currentUser}{isAdmin && <span className="admin-badge">管理员</span>}
                  </span>
                  {isAdmin && (
                    <button className="admin-btn" onClick={() => { loadAllUsers(); setShowAdminPanel(!showAdminPanel); }}>
                      {showAdminPanel ? '隐藏管理' : '管理'}
                    </button>
                  )}
                  <button className="logout-btn" onClick={handleLogout}>退出</button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 登录/注册表单 */}
        {!isLoggedIn && (
          <div className="auth-section-page">
            <div className="auth-tabs">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => { setAuthMode('login'); setAuthMessage(''); setAuthEmail(''); }}
              >
                登录
              </button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => { setAuthMode('register'); setAuthMessage(''); }}
              >
                注册
              </button>
              <button
                className={authMode === 'forgot' ? 'active' : ''}
                onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}
              >
                忘记密码
              </button>
            </div>
            <form className="auth-form-inline" onSubmit={handleAuth}>
              {authMode === 'forgot' || authMode === 'verify' ? null : (
                <input
                  type="text"
                  placeholder="用户名"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  required
                />
              )}
              {authMode === 'login' && (
                <input
                  type="password"
                  placeholder="密码"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
              )}
              {authMode === 'register' && (
                <>
                  <input
                    type="password"
                    placeholder="密码"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="邮箱（选填，用于找回密码）"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </>
              )}
              {authMode === 'forgot' && (
                <input
                  type="text"
                  placeholder="用户名或邮箱"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  required
                />
              )}
              {authMode === 'verify' && (
                <>
                  <input
                    type="text"
                    placeholder="6位验证码"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                  <input
                    type="password"
                    placeholder="新密码（至少3位）"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </>
              )}
              {authMessage && <p className="auth-message">{authMessage}</p>}
              <button type="submit" className="auth-submit">
                {authMode === 'login' ? '登录' : authMode === 'register' ? '注册' : authMode === 'forgot' ? '发送验证码' : '重置密码'}
              </button>
            </form>
          </div>
        )}

        {/* 管理员面板 */}
        {isLoggedIn && isAdmin && (
          <div className="admin-panel">
            <h3>用户管理</h3>
            <ul className="user-list">
              {allUsers.map(user => (
                <li key={user.username} className="user-item">
                  <div className="user-info">
                    <span className="user-name">
                      {user.username}
                      {user.isAdmin && <span className="admin-badge">管理员</span>}
                    </span>
                    {user.email && <span className="user-email">{user.email}</span>}
                  </div>
                  <span className="user-date">{new Date(user.created).toLocaleDateString('zh-CN')}</span>
                  <div className="user-actions">
                    <button onClick={() => toggleAdmin(user.username, user.isAdmin)}>
                      {user.isAdmin ? '取消管理员' : '设为管理员'}
                    </button>
                    <button className="delete-btn" onClick={() => deleteUser(user.username)}>删除</button>
                  </div>
                </li>
              ))}
            </ul>

            <h3 style={{marginTop: '24px'}}>密码重置请求</h3>
            <button className="load-requests-btn" onClick={loadResetRequests}>刷新请求</button>
            <ul className="user-list">
              {resetRequests.map(request => (
                <li key={request.id} className="user-item reset-request">
                  <div className="user-info">
                    <span className="user-name">{request.username}</span>
                    <span className="user-email">{request.email}</span>
                  </div>
                  <span className="user-date">{new Date(request.requestedAt).toLocaleString('zh-CN')}</span>
                  <div className="reset-actions">
                    <input
                      type="password"
                      placeholder="新密码"
                      value={resetPasswordInput}
                      onChange={(e) => setResetPasswordInput(e.target.value)}
                      style={{padding: '6px', border: '1px solid var(--border)', borderRadius: '4px', width: '80px'}}
                    />
                    <button onClick={() => handleResetPassword(request)}>重置密码</button>
                  </div>
                </li>
              ))}
              {resetRequests.length === 0 && (
                <li className="user-item">暂无重置请求</li>
              )}
            </ul>
          </div>
        )}

        <div className="input-section">
          <div className="input-row">
            <div className="input-wrapper">
              <input
                type="text"
                className="todo-input"
                placeholder={isRecording ? '正在聆听...' : '输入新任务，或点击麦克风语音输入'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              />
              {isRecording && interimText && (
                <div className="interim-text">{interimText}</div>
              )}
              {voiceSupported && (
                <button
                  className={'voice-btn' + (isRecording ? ' recording' : '')}
                  onClick={toggleVoice}
                  title={isRecording ? '点击停止' : '点击开始语音'}
                >
                  {isRecording ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="12" cy="8" r="3"/>
                      <path d="M12 12v4M8 20h8" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
            <input
              type="datetime-local"
              className="deadline-input"
              value={deadlineValue}
              onChange={(e) => setDeadlineValue(e.target.value)}
            />
          </div>
          {parsedTime && <div className="parsed-time-hint success">{parsedTime}</div>}
          {voiceResult && !parsedTime && <div className="parsed-time-hint">{voiceResult}</div>}
          <button className="add-btn" onClick={addTodo} disabled={!inputValue.trim()}>添加</button>
        </div>

        <div className="notification-bar">
          <label className="notify-toggle">
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
            />
            <span>提前</span>
            <input
              type="number"
              className="notify-time-input"
              value={notifyHours}
              onChange={(e) => setNotifyMinutes((parseInt(e.target.value) || 0) * 60 + notifyMins)}
              min="0"
              max="24"
            />
            <span>小时</span>
            <input
              type="number"
              className="notify-time-input"
              value={notifyMins}
              onChange={(e) => setNotifyMinutes(notifyHours * 60 + (parseInt(e.target.value) || 0))}
              min="0"
              max="59"
            />
            <span>分钟发送企业微信通知</span>
          </label>
          <button className="test-btn" onClick={testNotification}>测试</button>
          {notifyStatus && <span className="notify-status">{notifyStatus}</span>}
        </div>

        {/* 企业微信 Webhook 设置 */}
        {isLoggedIn && (
          <div className="webhook-section" style={{ marginBottom: 16, padding: '12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Webhook:</span>
              {webhookSaved && userWebhook ? (
                <span style={{ flex: 1, minWidth: 200, padding: '6px 10px', fontSize: 13, color: 'var(--success)', background: '#ecfdf5', borderRadius: 6 }}>
                  已保存 ****{userWebhook.split('?key=')[1]}
                </span>
              ) : (
                <input
                  type="text"
                  placeholder="输入企业微信群机器人的 webhook URL"
                  value={userWebhook}
                  onChange={(e) => setUserWebhook(e.target.value)}
                  style={{ flex: 1, minWidth: 200, padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6 }}
                />
              )}
              <button
                className="test-btn"
                onClick={() => {
                  if (webhookSaved) {
                    setUserWebhook('')
                    setWebhookSaved(false)
                  } else {
                    saveWebhook()
                  }
                }}
                style={{ background: webhookSaved ? 'var(--danger)' : undefined, color: webhookSaved ? 'white' : undefined }}
              >
                {webhookSaved ? '修改' : '保存'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 6 }}>
              保存后将使用您自己的企业微信机器人接收通知
            </div>
          </div>
        )}

        <ul className="todo-list">
          {todos
            .filter(t => !t.deletedAt)
            .sort((a, b) => {
              // 未完成的优先
              if (a.completed !== b.completed) return a.completed ? 1 : -1
              // 按截止时间排序，没有时间的排最后
              if (!a.deadline && !b.deadline) return 0
              if (!a.deadline) return 1
              if (!b.deadline) return -1
              return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            })
            .map(todo => (
            <li key={todo.id} className={'todo-item' + (todo.completed ? ' completed' : '')}>
              <label className="todo-label" onClick={() => toggleTodo(todo.id)}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
                <div className="todo-content">
                  <span className="todo-text">{todo.text}</span>
                  {todo.deadline && (
                    <span className={'deadline' + (formatDeadline(todo.deadline).isOverdue ? ' overdue' : '')}>
                      {formatDeadline(todo.deadline).dateStr}
                    </span>
                  )}
                  {todo.deadline && notifyEnabled && (
                    <span className="notify-time">
                      （通知时间: {formatTimeDisplay(new Date(new Date(todo.deadline).getTime() - notifyMinutes * 60000).toISOString())}）
                    </span>
                  )}
                </div>
              </label>
              <button
                className="delete-btn"
                onClick={() => deleteTodo(todo.id)}
                aria-label="删除任务"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {todos.length > 0 && (
          <div className="footer">
            <button
              className="clear-btn"
              onClick={clearCompleted}
              disabled={!hasCompleted}
            >
              清空已完成
            </button>
            {hasDeleted && (
              <button
                className="trash-btn"
                onClick={() => setShowTrash(!showTrash)}
              >
                {showTrash ? '收起回收站' : '回收站 (' + deletedTodos.length + ')'}
              </button>
            )}
          </div>
        )}

        {showTrash && deletedTodos.length > 0 && (
          <div className="trash-section">
            <h3>回收站</h3>
            <ul className="trash-list">
              {deletedTodos.map(todo => (
                <li key={todo.id} className="trash-item">
                  <div className="trash-content">
                    <span className="trash-text">{todo.text}</span>
                    {todo.deadline && (
                      <span className="trash-deadline">
                        截止: {new Date(todo.deadline).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                    <span className="trash-time">
                      删除于: {new Date(todo.deletedAt!).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="trash-actions">
                    <button
                      className="restore-btn"
                      onClick={() => restoreTodo(todo.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span>恢复</span>
                    </button>
                    <button
                      className="permdelete-btn"
                      onClick={() => permanentlyDelete(todo.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                      <span>删除</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button className="clear-trash-btn" onClick={clearTrash}>
              清空回收站
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
