require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const WECHAT_WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + process.env.WECHAT_WEBHOOK_KEY;

app.post('/api/notify', (req, res) => {
  const { text, deadline } = req.body;

  const message = {
    msgtype: 'text',
    text: {
      content: `📌 任务提醒\n\n${text}\n\n截止时间: ${deadline}`
    }
  };

  const url = new URL(WECHAT_WEBHOOK_URL);
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
