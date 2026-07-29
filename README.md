# 运动比赛竞赛系统

一个功能完善的运动比赛竞赛管理平台，支持比赛创建、参赛管理、赛程安排和成绩统计等功能。

## 系统功能

### 用户管理
- 多角色支持（管理员、组织者、裁判、参赛者、观众）
- 用户注册和登录
- 个人资料管理
- 基于JWT的身份验证和授权

### 比赛管理
- 比赛创建、编辑和删除
- 比赛详情展示和搜索
- 比赛状态管理（草稿、报名中、进行中、已结束、已取消）
- 比赛封面图片上传

### 参赛管理
- 个人和团队报名
- 参赛申请审核（通过/拒绝）
- 参赛者信息管理

### 赛程管理
- 赛程创建和编辑
- 按日期和比赛查看赛程
- 赛程状态管理

### 成绩管理
- 成绩录入和审核
- 成绩查询和排名
- 成绩异议处理

## 技术栈

### 前端
- React.js
- Material-UI
- React Router
- Context API
- Axios

### 后端
- Node.js
- Express.js
- MongoDB
- JWT认证
- RESTful API

## 快速开始

### 系统要求
- Node.js 14.x 或更高版本
- MongoDB 4.x 或更高版本

### 安装指南

本项目提供了一系列批处理脚本，帮助您快速安装和启动系统：

1. **安装Node.js和MongoDB**
   - 如果尚未安装Node.js，请参考 `node-js-installation.md`
   - 如果尚未安装MongoDB，请参考 `mongodb-installation.md`

2. **一键安装和启动**
   - 运行 `start-system.bat` 脚本，它将检查环境、安装依赖并启动系统

3. **分步安装**
   - 安装依赖：运行 `install-dependencies.bat`
   - 配置环境变量：运行 `configure-env.bat`
   - 启动后端服务器：运行 `start-backend.bat`
   - 启动前端开发服务器：运行 `start-frontend.bat`

### 手动安装

如果您不想使用批处理脚本，也可以按照以下步骤手动安装：

1. **安装后端依赖**
   ```bash
   cd backend
   npm install
   ```

2. **安装前端依赖**
   ```bash
   cd frontend
   npm install
   ```

3. **配置环境变量**
   - 复制 `backend/config/.env.example` 为 `backend/config/.env`
   - 根据您的环境修改配置

4. **启动后端服务器**
   ```bash
   cd backend
   npm run dev
   ```

5. **启动前端开发服务器**
   ```bash
   cd frontend
   npm run dev
   ```

6. **访问系统**
   - 前端：http://localhost:3000
   - 后端API：http://localhost:5000

## 项目结构

```
├── backend/                # 后端代码
│   ├── config/             # 配置文件
│   ├── controllers/        # 控制器
│   ├── middlewares/        # 中间件
│   ├── models/             # 数据模型
│   ├── routes/             # 路由
│   ├── services/           # 服务
│   ├── utils/              # 工具函数
│   ├── app.js              # 应用入口
│   └── server.js           # 服务器启动
│
├── frontend/               # 前端代码
│   ├── public/             # 静态资源
│   ├── src/                # 源代码
│   │   ├── assets/         # 资源文件
│   │   ├── components/     # 组件
│   │   ├── contexts/       # 上下文
│   │   ├── hooks/          # 自定义钩子
│   │   ├── layouts/        # 布局组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
│   └── vite.config.js      # Vite配置
│
├── .gitignore              # Git忽略文件
├── README.md               # 项目说明
└── project-plan.md         # 项目计划
```

## 演示账号

系统初始化后，可以使用以下演示账号登录：

- 管理员：admin@example.com / password
- 组织者：organizer@example.com / password
- 裁判：referee@example.com / password
- 参赛者：participant@example.com / password

## 许可证

[MIT](LICENSE)