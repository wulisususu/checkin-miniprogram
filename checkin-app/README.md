# checkin-app (后端)

独立 Node.js 后端，详见项目根目录 [README.md](../README.md)。

## 快速启动

```bash
cd checkin-app
npm install
cp .env.example .env   # 填写 YOUR_DOMAIN / YOUR_ADMIN_PHONE / WX_APPID / WX_APPSECRET
node src/server.js
```

## 部署要点

- 在 Nginx 中使用 `^~` 前缀匹配代理 `/checkin-api/` 到 `127.0.0.1:3100`，详见 `deploy/nginx-checkin.conf.example`
- `PUBLIC_BASE_URL` 设为 `https://YOUR_DOMAIN/checkin-api`（不含 `/api`）
- 微信公众平台服务器域名白名单添加 `https://YOUR_DOMAIN` 和 `https://apis.map.qq.com`
