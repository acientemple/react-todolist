# Firebase 安全规则配置

请在 Firebase Console 中配置以下规则：

## 1. 进入 Firebase Console
访问：https://console.firebase.google.com/project/snake-game-6e39e/database

## 2. 配置 Realtime Database 规则

点击 "Realtime Database" -> "规则"，粘贴以下规则：

```json
{
  "rules": {
    "todolist": {
      "users": {
        "$username": {
          ".read": "$username === auth.uid",
          ".write": "$username === auth.uid"
        }
      },
      "todos": {
        "$username": {
          ".read": "$username === auth.uid",
          ".write": "$username === auth.uid"
        }
      },
      "resetRequests": {
        ".read": false,
        ".write": true
      }
    }
  }
}
```

## 规则说明

- `users/$username` - 只有用户本人可以读写自己的用户数据
- `todos/$username` - 只有用户本人可以读写自己的 todos
- `resetRequests` - 所有人都可以写入（用于密码重置请求），但不能读取

## 重要说明

1. Firebase Authentication 的 `auth.uid` 对应用户的用户名 (username)
2. 这些规则确保：
   - 用户 A 无法访问用户 B 的数据
   - 只有经过身份验证的用户才能访问数据
   - 未登录用户无法访问任何数据
