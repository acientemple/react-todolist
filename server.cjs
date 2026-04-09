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

// 格式化日期
function formatDeadline(isoString) {
  const date = new Date(isoString);
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${weekday}${month}月${day}日 ${hours}:${minutes}`;
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
    const now = Date.now();
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

      // 默认提前 2 小时 = 7200000 毫秒
      const notifyMinutes = userData.notifyMinutes || 120;
      const notifyWindow = notifyMinutes * 60 * 1000;

      // 遍历该用户的待办事项
      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        if (!todo.deadline || todo.completed || todo.notified) continue;

        const deadlineTime = new Date(todo.deadline).getTime();
        const timeDiff = deadlineTime - now;

        // 如果在通知窗口内且未过截止时间
        if (timeDiff > 0 && timeDiff <= notifyWindow) {
          const deadlineStr = formatDeadline(todo.deadline);

          console.log(`[定时任务] 发送通知: ${username} - ${todo.text}`);

          const result = await sendWeChatNotification(webhookKey, todo.text, deadlineStr);

          if (result.success) {
            // 标记为已通知
            todos[i].notified = true;
            sentCount++;
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
