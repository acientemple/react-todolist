# 待办事项 - React TodoList

一个功能丰富的待办事项管理应用，支持 AI 智能时间解析、企业微信通知和云端同步。

**在线访问**：https://acientemple.github.io/react-todolist/

---

## 功能特性

### 基础功能
- **用户账户系统** - 注册、登录、忘记密码
- **待办事项管理** - 添加、完成、删除、恢复
- **语音输入** - 点击麦克风按钮，通过语音添加任务
- **回收站** - 误删可恢复，支持永久删除
- **清空已完成** - 一键清除所有已完成任务

### 智能时间解析
- **默认时间解析** - 支持自然语言设置截止时间
- **AI 时间解析**（可选）- 支持更复杂的时间表达
  - 支持多任务解析：如"7点送贝壳上学，5点接贝壳放学"
  - 支持相对时间：如"两小时后看月亮"
  - 支持多种 AI 提供商：DeepSeek、ChatGPT、Claude 等

### 通知提醒
- **企业微信通知** - 截止时间前自动发送提醒
- **可配置提醒时间** - 默认提前 2 小时

### 云端同步
- **Firebase 实时数据库** - 所有数据云端存储
- **跨设备同步** - 登录后自动同步待办事项
- **配置同步** - AI 设置、Webhook 配置自动同步

### 管理员功能
- **用户管理** - 查看所有用户、设置管理员权限
- **密码重置处理** - 处理用户的密码重置请求

---

## 快速开始

### 在线使用

直接访问 https://acientemple.github.io/react-todolist/ 即可使用。

### 本地开发

```bash
# 克隆项目
git clone https://github.com/acientemple/react-todolist.git
cd react-todolist

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

### 部署到 GitHub Pages

```bash
npm run deploy
```

---

## 使用说明

### 注册与登录

1. **注册账号**
   - 点击"注册"标签
   - 输入用户名（至少3位）
   - 输入密码（至少3位）
   - 输入邮箱（可选，用于找回密码）
   - 点击"注册"

2. **登录**
   - 输入用户名和密码
   - 点击"登录"

3. **忘记密码**
   - 点击"忘记密码"标签
   - 输入用户名或注册邮箱
   - 收到验证码后，输入新密码

### 添加任务

**方式一：直接输入**
- 在输入框中输入任务内容
- 按 Enter 或点击"添加"按钮

**方式二：语音输入**
- 点击麦克风按钮开始录音
- 对着麦克风说话
- 语音会自动识别并填入输入框
- 再次点击麦克风停止录音

**方式三：指定时间**
- 在时间选择器中设置截止时间
- 或在输入框中用自然语言描述时间

### 时间表达方式

应用支持多种时间表达方式：

| 输入示例 | 解析结果 |
|---------|---------|
| 今天 | 今天当前时间 |
| 明天 | 明天同一时间 |
| 后天 | 后天同一时间 |
| 下周三 | 下周三 |
| 4月10号 | 今年4月10号 |
| 上午9点 | 当天上午 09:00 |
| 下午3点半 | 当天下午 15:30 |
| 7点 | 当天上午 07:00 |
| 两小时后 | 当前时间 + 2小时 |

### AI 时间解析

1. **配置 AI**
   - 点击"设置"展开 AI 配置
   - 选择 AI 提供商（如 DeepSeek）
   - 选择模型
   - 输入 API Key
   - 点击"保存"

2. **启用 AI 解析**
   - 勾选"使用 AI 解析时间"
   - 输入任务时自动使用 AI 解析时间

3. **多任务解析**
   - 输入多个任务和时间的组合
   - AI 会自动拆分并设置各自的截止时间
   - 示例："7点送贝壳上学，5点接贝壳放学"
   - 会创建两个任务：7点送贝壳上学、5点接贝壳放学

### 企业微信通知

1. **获取 Webhook 地址**
   - 打开企业微信群
   - 点击群设置 -> 群机器人 -> 添加机器人
   - 复制机器人的 Webhook 地址

2. **配置 Webhook**
   - 在设置中输入 Webhook 地址
   - 点击"保存"

3. **测试通知**
   - 点击"测试"按钮
   - 如果配置正确，企业微信会收到测试消息

4. **设置提醒时间**
   - 调整"提前 X 小时 Y 分钟"设置
   - 系统会在截止时间前发送通知

### 完成任务与删除

- **完成任务**：点击任务左侧的复选框
- **删除任务**：点击任务右侧的"删除"按钮
- **恢复任务**：在回收站中点击"恢复"
- **永久删除**：在回收站中点击"永久删除"
- **清空回收站**：点击"清空回收站"按钮
- **清空已完成**：点击"清空已完成"按钮

### 管理员功能

管理员登录后可以看到额外的管理选项：

1. **用户管理**
   - 点击右上角的"管理"按钮
   - 查看所有用户列表
   - 设为管理员 / 取消管理员
   - 删除用户

2. **密码重置处理**
   - 查看密码重置请求
   - 输入新密码并点击"重置密码"

---

## 项目结构

```
react-todolist/
├── src/
│   ├── App.tsx        # 主组件和业务逻辑
│   ├── App.css        # 样式文件
│   ├── firebase.ts    # Firebase 配置和数据库操作
│   ├── llm.ts         # AI 大模型集成
│   ├── main.tsx       # React 入口
│   └── index.css      # 全局样式
├── server.cjs         # Express 通知服务（可选）
├── .env               # 环境变量（不上传）
├── .env.example       # 环境变量模板
├── index.html         # HTML 入口
├── package.json
└── vite.config.ts     # Vite 配置
```

---

## 技术栈

### 前端
- **框架**：React 19 + TypeScript
- **构建工具**：Vite
- **样式**：CSS3（CSS 变量）
- **语音识别**：Web Speech API

### 后端与服务
- **数据库**：Firebase Realtime Database
- **通知服务**：企业微信 Webhook（可选）
- **AI 集成**：支持多种 LLM 提供商

### AI 支持的模型

| 提供商 | 模型 | 免费额度 |
|-------|------|---------|
| DeepSeek | deepseek-chat, deepseek-coder | 有 |
| ChatGPT (OpenAI) | gpt-4o-mini 等 | 有 |
| Claude (Anthropic) | claude-3-5-haiku 等 | 有 |
| Gemini (Google) | gemini-1.5-flash 等 | 有 |
| MiniMax | MiniMax-M2.7 | 需要申请 |
| Kimi (Moonshot) | moonshot-v1-8k 等 | 需要申请 |
| 智谱清言 | glm-4-flash 等 | 有 |
| 通义千问 | qwen-turbo 等 | 有 |

---

## 数据存储

### Firebase 数据库结构

```
todolist/
├── users/
│   └── {username}/
│       ├── username: string
│       ├── password: string (哈希)
│       ├── email: string
│       ├── isAdmin: boolean
│       ├── created: string (ISO日期)
│       ├── wechatWebhook: string
│       ├── llmProvider: string
│       ├── llmApiKey: string
│       ├── llmModel: string
│       └── useAITimeParsing: boolean
├── todos/
│   └── {username}/
│       └── [] (待办事项数组)
├── verifyCodes/      # 邮箱验证码
└── resetRequests/    # 密码重置请求
```

---

## 环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 企业微信 Webhook Key（可选）
WECHAT_WEBHOOK_KEY=你的企业微信机器人webhook密钥
```

---

## 许可证

MIT License

---

## 更新日志

### v1.0.0
- 待办事项基础功能
- 用户账户系统
- AI 时间解析（支持多任务）
- 企业微信通知
- Firebase 云端同步
- 管理员功能
- 语音输入
- 回收站功能
