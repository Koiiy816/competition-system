@echo off
REM 运动比赛竞赛系统部署脚本 - Windows版本
REM 此脚本帮助将系统部署到生产环境服务器

setlocal enabledelayedexpansion

echo 开始部署运动比赛竞赛系统...
echo.

REM 检查必要的命令是否存在
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误: 需要安装Node.js但未找到，请先安装Node.js
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误: 需要安装npm但未找到
    exit /b 1
)

REM 获取部署配置
set /p MONGO_URI=请输入MongoDB连接URI (默认: mongodb://localhost:27017/competition-system): 
if "!MONGO_URI!"=="" set MONGO_URI=mongodb://localhost:27017/competition-system

set /p PORT=请输入服务器端口 (默认: 5000): 
if "!PORT!"=="" set PORT=5000

set /p JWT_SECRET=请输入JWT密钥 (默认: random_secret_key): 
if "!JWT_SECRET!"=="" set JWT_SECRET=random_secret_key

set /p API_BASE_URL=请输入前端API基础URL (例如: https://api.yourdomain.com): 

REM 创建生产环境配置文件
echo 创建生产环境配置...
(
    echo NODE_ENV=production
    echo PORT=!PORT!
    echo MONGO_URI=!MONGO_URI!
    echo JWT_SECRET=!JWT_SECRET!
    echo JWT_EXPIRE=30d
) > .\backend\config\.env.production

REM 安装后端依赖
echo 安装后端依赖...
cd backend
call npm install --production

REM 更新前端API配置
if not "!API_BASE_URL!"=="" (
    echo 更新前端API配置...
    cd ..\frontend
    
    REM 创建生产环境API配置
    (
        echo import axios from 'axios';
        echo.
        echo // 创建axios实例 - 生产环境
        echo const api = axios.create({
        echo   baseURL: '!API_BASE_URL!',
        echo   headers: {
        echo     'Content-Type': 'application/json'
        echo   }
        echo });
        echo.
        echo // 请求拦截器 - 添加token到请求头
        echo api.interceptors.request.use(
        echo   config =^> {
        echo     const token = localStorage.getItem('token');
        echo     if (token) {
        echo       config.headers.Authorization = `Bearer ${token}`;
        echo     }
        echo     return config;
        echo   },
        echo   error =^> {
        echo     return Promise.reject(error);
        echo   }
        echo );
        echo.
        echo // 响应拦截器 - 处理常见错误
        echo api.interceptors.response.use(
        echo   response =^> response,
        echo   error =^> {
        echo     // 处理401错误 - 未授权/token过期
        echo     if (error.response ^&^& error.response.status === 401) {
        echo       localStorage.removeItem('token');
        echo       localStorage.removeItem('user');
        echo       // 如果不是登录页面，则重定向到登录页
        echo       if (window.location.pathname !== '/auth/login') {
        echo         window.location.href = '/auth/login';
        echo       }
        echo     }
        echo     return Promise.reject(error);
        echo   }
        echo );
        echo.
        echo export default api;
    ) > .\src\services\api.prod.js

    REM 修改前端构建配置以使用生产环境API
    echo 更新前端构建配置...
    call npm install
    call npm run build
)

echo.
echo 部署准备完成!
echo.
echo 后续步骤:
echo 1. 将生成的文件复制到您的Web服务器
echo 2. 配置Nginx或其他Web服务器作为反向代理
echo 3. 启动后端服务: 'cd backend && set NODE_ENV=production && node server.js'
echo 4. 或使用PM2管理后端服务: 'pm2 start backend/server.js --name competition-system'
echo.
echo 详细部署说明请参考 deployment-guide.md

pause