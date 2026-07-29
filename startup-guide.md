# 运动比赛竞赛系统启动指南

本指南将帮助您快速启动运动比赛竞赛系统。

## 准备工作

在启动系统前，请确保您已完成以下准备工作：

1. **安装Node.js**
   - 如果尚未安装，请参考 `node-js-installation.md`
   - 或访问 [Node.js官网](https://nodejs.org/) 下载安装

2. **安装MongoDB**
   - 如果尚未安装，请参考 `mongodb-installation.md`
   - 或访问 [MongoDB官网](https://www.mongodb.com/try/download/community) 下载安装

## 快速启动（推荐）

我们提供了一键启动脚本，它将自动检查环境、安装依赖并启动系统：

1. 双击运行 `start-system.bat`
2. 脚本将自动检查Node.js和MongoDB安装情况
3. 如果需要，脚本会提示您配置环境变量和安装依赖
4. 系统将在两个命令窗口中启动（后端和前端）
5. 启动完成后，您可以通过浏览器访问 http://localhost:3000 使用系统

## 分步启动

如果您希望分步骤启动系统，可以按照以下步骤操作：

### 1. 安装依赖

双击运行 `install-dependencies.bat`，它将为前端和后端安装所需的依赖包。

### 2. 配置环境变量

双击运行 `configure-env.bat`，它将在后端目录中创建必要的环境变量配置文件。

### 3. 启动后端服务器

双击运行 `start-backend.bat`，它将启动后端API服务器。

### 4. 启动前端开发服务器

双击运行 `start-frontend.bat`，它将启动前端开发服务器。

## 手动启动

如果您不想使用批处理脚本，也可以按照以下步骤手动启动系统：

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 配置环境变量

复制 `backend/config/.env.example` 为 `backend/config/.env`，并根据需要修改配置。

### 4. 启动后端服务器

```bash
cd backend
npm run dev
```

### 5. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

## 访问系统

系统启动后，您可以通过以下地址访问：

- **前端界面**：http://localhost:3000
- **后端API**：http://localhost:5000

## 演示账号

系统初始化后，您可以使用以下演示账号登录：

- **管理员**：admin@example.com / password
- **组织者**：organizer@example.com / password
- **裁判**：referee@example.com / password
- **参赛者**：participant@example.com / password

## 常见问题

### 1. 端口被占用

如果启动时提示端口被占用，您可以修改配置文件中的端口号：

- 后端：修改 `backend/config/.env` 中的 `PORT` 值
- 前端：修改 `frontend/vite.config.js` 中的 `server.port` 值

### 2. MongoDB连接失败

确保MongoDB服务已启动，并检查连接字符串是否正确。

### 3. 依赖安装失败

尝试使用管理员权限运行命令提示符，然后重新运行安装脚本。

## 系统关闭

要关闭系统，只需关闭相应的命令窗口即可。