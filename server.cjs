require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DEFAULT_WEBHOOK_KEY = process.env.WECHAT_WEBHOOK_KEY;

app.post('/api/notify', (req, res) => {
  const { text, deadline, webhook } = req.body;

  // 如果用户提供了 webhook，使用用户的；否则使用默认的
  let webhookKey = DEFAULT_WEBHOOK_KEY;
  if (webhook) {
    // 从用户 webhook URL 中提取 key
    try {
      const url = new URL(webhook);
      webhookKey = url.searchParams.get('key') || DEFAULT_WEBHOOK_KEY;
    } catch {
      // 无效的 URL，使用默认
    }
  }

  if (!webhookKey) {
    res.status(400).json({ success: false, message: '未配置企业微信 webhook' });
    return;
  }

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
          res.json({ success: true, message: '通知发送成功' });
        } else {
          res.json({ success: false, message: result.errmsg });
        }
      } catch {
        res.json({ success: false, message: '解析响应失败', raw: data });
      }
    });
  });

  wechatReq.on('error', (error) => {
    res.status(500).json({ success: false, message: error.message });
  });

  wechatReq.write(JSON.stringify(message));
  wechatReq.end();
});

app.listen(PORT, () => {
  console.log(`通知服务已启动: http://localhost:${PORT}`);
});
