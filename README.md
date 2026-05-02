# 位置拍照打卡小程序

微信小程序 + Node.js 后端，支持 GPS 定位打卡、前置摄像头拍照、打卡记录日历视图，以及管理员多用户管理。

---

## 配置前须知

本仓库已将所有个人/私密信息替换为占位符，克隆后**必须**在以下位置填写真实值才能运行：

| 占位符 | 含义 | 需要修改的文件 |
|--------|------|---------------|
| `YOUR_DOMAIN` | 你的服务器域名（不含 `https://`） | `client/config.js`、`checkin-app/.env`、`checkin-app/deploy/*.py`、`nginx-checkin.conf.example` |
| `YOUR_ADMIN_PHONE` | 管理员手机号（11 位） | `client/app.js`、`checkin-app/.env` |
| `YOUR_QQMAP_KEY` | 腾讯地图 Web Service API Key | `client/pages/checkIn/checkIn.js` |
| `YOUR_SERVER_IP` | 服务器 IP（仅部署脚本用） | `checkin-app/deploy/update_remote.py`、`deploy_remote.py` |

**快速搜索所有占位符：**
```bash
grep -r "YOUR_" --include="*.js" --include="*.py" --include="*.json" --include="*.conf" --include=".env*" .
```

---

## 功能概览

### 普通用户
- 微信一键登录（手机号 + 昵称授权）
- 定位打卡：获取 GCJ-02 坐标，腾讯地图逆地理编码解析中文地址（本地缓存，100 m 内复用上次结果）
- 前置摄像头拍照，自动压缩后上传
- iOS 日历风格打卡记录：支持年月切换、点击日期查看当日记录
- 点击记录地址行弹出底部地图面板（微信原生 `<map>` 组件，带标注气泡）

### 管理员
- 打卡记录页顶部显示用户选择器，可切换查看任意被管理用户的打卡记录
- 所有 `/api/admin/*` 路由服务端校验 openid 对应手机号，防止越权

---

## 项目结构

```
wxss-master/
├── client/                        微信小程序前端
│   ├── pages/
│   │   ├── login/                 登录页（微信授权）
│   │   ├── checkIn/               打卡页（拍照 + 定位 + 提交）
│   │   ├── logs/                  打卡记录页（日历 + 地图弹窗）
│   │   └── user/                  个人中心（绑定手机号）
│   ├── libs/
│   │   └── qqmap-wx-jssdk.js      腾讯地图 JS SDK
│   ├── config.js                  后端 API 地址配置
│   ├── app.js                     全局数据（openid / phone / isAdmin / geocoderCache）
│   └── app.json
│
└── checkin-app/                   Node.js 后端
    ├── src/
    │   ├── server.js              Express 入口，端口 3100
    │   ├── config/
    │   │   ├── db.js              MySQL 连接池（mysql2）
    │   │   └── env.js             环境变量读取
    │   ├── routes/
    │   │   ├── auth.js            登录 / 手机号授权
    │   │   ├── checkins.js        打卡记录 CRUD
    │   │   ├── admin.js           管理员路由
    │   │   └── health.js          健康检查
    │   ├── middlewares/
    │   │   └── upload.js          multer 图片上传（5 MB 限制，仅 image/*）
    │   └── utils/
    │       └── wechat.js          微信 API 封装（code2session / getPhoneNumber，含 access_token 缓存）
    ├── sql/
    │   ├── 001_init.sql           建表 checkin_records
    │   ├── 002_users.sql          建表 users
    │   └── 003_add_nickname.sql   users 表新增 nickname 字段
    ├── deploy/
    │   └── update_remote.py       SSH 部署脚本（paramiko）
    └── .env.example
```

---

## 数据库

### 初始化（按顺序执行）

```bash
mysql -uroot < checkin-app/sql/001_init.sql
mysql -uroot < checkin-app/sql/002_users.sql
mysql -uroot < checkin-app/sql/003_add_nickname.sql
```

### 表结构

**checkin_records**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT UNSIGNED | 主键 |
| openid | VARCHAR(64) | 微信 openid |
| latitude | DECIMAL(10,7) | 纬度 |
| longitude | DECIMAL(10,7) | 经度 |
| address | VARCHAR(255) | 逆地理编码中文地址 |
| photo_url | VARCHAR(512) | 图片访问 URL |
| checkin_time | DATETIME | 打卡时间 |

**users**

| 字段 | 类型 | 说明 |
|------|------|------|
| openid | VARCHAR(64) | 微信 openid（唯一） |
| phone | VARCHAR(20) | 手机号 |
| nickname | VARCHAR(64) | 微信昵称 |

---

## 环境变量

复制 `checkin-app/.env.example` 为 `checkin-app/.env`：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3100` | 服务监听端口 |
| `DB_HOST` | `127.0.0.1` | MySQL 主机 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_NAME` | `checkin_prod` | 数据库名 |
| `DB_USER` | `checkin_user` | 数据库用户 |
| `DB_PASSWORD` | | 数据库密码 |
| `WX_APPID` | | 微信小程序 AppID |
| `WX_APPSECRET` | | 微信小程序 AppSecret |
| `ADMIN_PHONE` | `YOUR_ADMIN_PHONE` | 管理员手机号 |
| `PUBLIC_BASE_URL` | `https://YOUR_DOMAIN/checkin-api` | 图片 URL 前缀（不含 `/api`） |
| `UPLOAD_DIR` | `uploads` | 图片存储目录（绝对或相对路径） |

---

## 本地启动

```bash
cd checkin-app
npm install
cp .env.example .env    # 填写环境变量
node src/server.js
# => checkin-app listening on 3100
```

健康检查：`GET http://localhost:3100/api/health`

---

## 远程部署

```bash
cd checkin-app
# Windows CMD
set CHECKIN_PASS=<SSH root 密码>
set WX_APPID=<AppID>
set WX_APPSECRET=<AppSecret>
python deploy/update_remote.py
```

脚本依次执行：上传 `src/`、上传 SQL 迁移文件、更新服务器 `.env`、运行迁移、重启 `checkin-app` systemd 服务、输出健康检查结果。

依赖：`pip install paramiko`

---

## API 接口

### 鉴权

| 方法 | 路径 | Body | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | `{ loginCode, phoneCode?, nickname? }` | 微信登录，返回 `{ openid, phone, isAdmin }` |
| POST | `/api/auth/phone` | `{ phoneCode, openid }` | 绑定/更新手机号 |

### 打卡记录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/checkins` | 提交打卡（multipart/form-data，含 `photo` 文件字段） |
| GET | `/api/checkins?openid=&limit=` | 查询打卡记录（最多 200 条） |
| DELETE | `/api/checkins?openid=` | 清空指定用户全部记录 |

POST 表单字段：`openid`、`latitude`、`longitude`、`address`、`checkin_time`（ISO 8601）、`photo`（文件）

### 管理员（所有请求需携带 `adminOpenid`，服务端验证手机号）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users?adminOpenid=` | 获取所有非管理员用户列表 |
| GET | `/api/admin/checkins?adminOpenid=&openid=&limit=` | 查询任意用户打卡记录（最多 500 条） |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/uploads/:filename` | 打卡图片静态文件 |

---

## 前端配置

编辑 `client/config.js`，修改 `url` 为实际后端地址：

```js
var url = 'https://YOUR_DOMAIN/checkin-api'
```

在**微信公众平台 → 开发 → 开发管理 → 开发设置 → 服务器域名**中添加：

- request 合法域名：`https://YOUR_DOMAIN`、`https://apis.map.qq.com`
- uploadFile 合法域名：`https://YOUR_DOMAIN`

腾讯地图 API Key 在 `client/pages/checkIn/checkIn.js` 顶部配置（`YOUR_QQMAP_KEY`）。

---

## nginx 配置要点

使用 `^~` 前缀匹配保证 API 代理优先于静态文件缓存规则：

```nginx
location ^~ /checkin-api/ {
    proxy_pass         http://127.0.0.1:3100/;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
}
```

完整示例见 `checkin-app/deploy/nginx-checkin.conf.example`（将 `YOUR_DOMAIN` 替换为你的域名）。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 小程序前端 | 微信原生 WXML / WXSS / JS |
| 后端框架 | Node.js + Express 4 |
| 数据库 | MySQL 5.7+（mysql2 连接池） |
| 图片上传 | multer |
| 地图逆地理编码 | 腾讯地图 qqmap-wx-jssdk（含本地缓存） |
| 地图展示 | 微信内置 `<map>` 原生组件 |
| 部署 | Python paramiko SSH + systemd |
