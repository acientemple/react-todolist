require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 设置时区为中国标准时间 (Asia/Shanghai)
const TIMEZONE = 'Asia/Shanghai';

// 获取当前服务器时间（中国时区）
function getNowInTimezone() {
  const now = new Date();
  // 转换为中国时区的时间
  return new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

// 获取 UTC 当前时间
function getNowUTC() {
  return new Date();
}

// Firebase 配置
const firebaseConfig = {
  projectId: 'snake-game-6e39e',
  databaseURL: 'https://snake-game-6e39e-default-rtdb.asia-southeast1.firebasedatabase.app/'
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

const DEFAULT_WEBHOOK_KEY = process.env.WECHAT_WEBHOOK_KEY;

// 发送企业微信通知
function sendWeChatNotification(webhookKey, text, deadline) {
  return new Promise((resolve, reject) => {
    const wechatWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + webhookKey;

    const message = {
      msgtype: 'text',
      text: {
        content: `📌 任务提醒\n\n${text}\n\n截止时间: ${deadline}`
      }
    };

    const url = new URL(wechatWebhookUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const wechatReq = https.request(options, (wechatRes) => {
      let data = '';
      wechatRes.on('data', chunk => data += chunk);
      wechatRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errcode === 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: result.errmsg });
          }
        } catch (e) {
          resolve({ success: false, error: '解析响应失败' });
        }
      });
    });

    wechatReq.on('error', (error) => {
      reject(error);
    });

    wechatReq.write(JSON.stringify(message));
    wechatReq.end();
  });
}

// 格式化日期（使用中国时区显示）
function formatDeadline(isoString) {
  const date = new Date(isoString);
  // 转换为中国时区
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // 使用 toLocaleString 转换到中国时区
  const chinaDateStr = date.toLocaleString('zh-CN', { timeZone: TIMEZONE });
  const parts = chinaDateStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/);
  if (parts) {
    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]);
    const day = parseInt(parts[3]);
    const hours = parseInt(parts[4]).toString().padStart(2, '0');
    const minutes = parseInt(parts[5]).toString().padStart(2, '0');
    // 获取星期几
    const tempDate = new Date(year, month - 1, day);
    const weekday = weekdays[tempDate.getDay()];
    return `${weekday}${month}月${day}日 ${hours}:${minutes}`;
  }

  // 后备格式化
  const weekday = weekdays[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${weekday}${month}月${day}日 ${hours}:${minutes}`;
}

// 获取截止时间在中国时区的时间戳
// 注意：Firebase 存储的 deadline 是北京时间（如 "2026-04-09T11:30" = 北京11:30）
// new Date() 会将其解析为 UTC 时间，我们实际要的是北京时间
// UTC 11:30 = 北京时间 19:30，所以要减去8小时才是正确的北京时间
function getDeadlineTimestampInTimezone(isoString) {
  const date = new Date(isoString);
  const chinaOffset = 8 * 60 * 60 * 1000; // 8小时毫秒数
  // 减去8小时偏移，将UTC 11:30转换为北京时间 11:30
  return date.getTime() - chinaOffset;
}

// 检查所有用户的待办事项并发送通知
async function checkAllDeadlines() {
  console.log('[定时任务] 开始检查所有用户的待办事项...');

  try {
    // 获取所有用户的待办事项
    const todosRef = ref(database, 'todolist/todos');
    const snapshot = await get(todosRef);

    if (!snapshot.exists()) {
      console.log('[定时任务] 没有待办事项数据');
      return { success: true, sent: 0 };
    }

    const allTodos = snapshot.val();
    const now = getNowInTimezone().getTime();  // 使用中国时区的当前时间
    let sentCount = 0;

    // 遍历所有用户的待办事项
    for (const [username, todos] of Object.entries(allTodos)) {
      if (!Array.isArray(todos)) continue;

      // 获取用户的 webhook 配置
      const userRef = ref(database, `todolist/users/${username}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      if (!userData || !userData.wechatWebhook) continue;

      // 从 webhook URL 中提取 key（兼容两种格式）
      let webhookKey = '';
      try {
        const url = new URL(userData.wechatWebhook);
        webhookKey = url.searchParams.get('key') || '';
      } catch {
        // 如果不是有效 URL，直接当作 key 使用
        webhookKey = userData.wechatWebhook;
      }

      if (!webhookKey) continue;

      // 遍历该用户的待办事项
      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        if (!todo.deadline || todo.completed || todo.notified) continue;

        // 使用任务自己的通知时间，否则使用全局默认（默认提前2小时）
        const notifyMinutes = todo.notifyMinutes ?? userData.notifyMinutes ?? 120;
        const notifyWindow = notifyMinutes * 60 * 1000;

        const deadlineTime = getDeadlineTimestampInTimezone(todo.deadline);
        const timeDiff = deadlineTime - now;

        // 如果在通知窗口内且未过截止时间
        if (timeDiff > 0 && timeDiff <= notifyWindow) {
          const deadlineStr = formatDeadline(todo.deadline);

          console.log(`[定时任务] 发送通知: ${username} - ${todo.text}`);

          const result = await sendWeChatNotification(webhookKey, todo.text, deadlineStr);

          if (result.success) {
            // 标记为已通知，并记录发送时间（中国时区）
            todos[i].notified = true;
            todos[i].notifiedAt = getNowInTimezone().toISOString();
            sentCount++;
            console.log(`[定时任务] 通知已发送: ${todo.text}, 发送时间: ${todos[i].notifiedAt}`);
          }
        }
      }

      // 保存更新后的 todos
      const userTodosRef = ref(database, `todolist/todos/${username}`);
      await set(userTodosRef, todos);
    }

    console.log(`[定时任务] 检查完成，发送了 ${sentCount} 个通知`);
    return { success: true, sent: sentCount };

  } catch (error) {
    console.error('[定时任务] 检查失败:', error);
    return { success: false, error: error.message };
  }
}

// 手动发送通知
app.post('/api/notify', async (req, res) => {
  const { text, deadline, webhook } = req.body;

  // 必须提供有效的 webhook，不使用默认 fallback
  if (!webhook) {
    res.status(400).json({ success: false, message: '未配置企业微信 webhook' });
    return;
  }

  let webhookKey;
  // 尝试作为 URL 解析
  try {
    const url = new URL(webhook);
    webhookKey = url.searchParams.get('key');
  } catch {
    // 如果解析失败，可能只是 key 部分
    webhookKey = webhook;
  }

  if (!webhookKey || webhookKey.length < 10) {
    res.status(400).json({ success: false, message: '无效的 webhook，请检查配置' });
    return;
  }

  try {
    const result = await sendWeChatNotification(webhookKey, text, deadline);
    if (result.success) {
      res.json({ success: true, message: '通知发送成功' });
    } else {
      res.json({ success: false, message: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 定时检查所有用户的待办事项（由 keep-alive workflow 调用）
app.get('/api/check-deadlines', async (req, res) => {
  console.log('[API] 收到定时检查请求');

  const result = await checkAllDeadlines();

  res.json({
    success: result.success,
    message: result.success ? `检查完成，发送了 ${result.sent} 个通知` : result.error,
    timestamp: new Date().toISOString()
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`通知服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`定时检查: http://localhost:${PORT}/api/check-deadlines`);
});
