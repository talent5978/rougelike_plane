# 🚀 Vercel 部署指南

## 📋 部署前准备

1. 确保你有 GitHub 账号
2. 注册 Vercel 账号（推荐用 GitHub 登录）
3. 安装 Git（如果还没有）

## 🔧 部署步骤

### 方法一：通过 GitHub（推荐）

#### 1. 创建 GitHub 仓库
1. 访问 [GitHub.com](https://github.com)
2. 点击右上角 "New repository"
3. 仓库名称：`magic-academy-adventure`
4. 设置为 Public
5. 点击 "Create repository"

#### 2. 上传代码到 GitHub
```bash
# 在项目文件夹中执行
git init
git add .
git commit -m "Initial commit: Magic Academy Adventure Game"
git branch -M main
git remote add origin https://github.com/你的用户名/magic-academy-adventure.git
git push -u origin main
```

#### 3. 连接 Vercel
1. 访问 [Vercel.com](https://vercel.com)
2. 用 GitHub 账号登录
3. 点击 "New Project"
4. 选择你的 `magic-academy-adventure` 仓库
5. 点击 "Deploy"

### 方法二：直接上传文件

#### 1. 打包项目文件
将以下文件打包成 ZIP：
- package.json
- server.js  
- vercel.json
- public/ 文件夹（包含所有 HTML 文件）
- README.md

#### 2. 直接部署
1. 访问 [Vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 选择 "Upload"
4. 上传 ZIP 文件
5. 点击 "Deploy"

## 🎮 部署完成后

1. Vercel 会给你一个类似 `https://magic-academy-adventure-xxx.vercel.app` 的链接
2. 点击链接即可访问你的游戏
3. 分享给朋友一起玩！

## ⚠️ 注意事项

- Socket.IO 在 Vercel 上可能有限制，实时功能可能受影响
- 数据存储在内存中，重启后会丢失
- 如需持久化数据，建议连接数据库（如 MongoDB Atlas）

## 🔄 更新游戏

如果你想更新游戏：
1. 修改代码
2. 推送到 GitHub
3. Vercel 会自动重新部署