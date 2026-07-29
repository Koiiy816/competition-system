@echo off
echo ===================================
echo 运动比赛竞赛系统 - 依赖安装脚本
echo ===================================
echo.

echo 检查Node.js安装...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 请参考 node-js-installation.md 文件进行安装
    pause
    exit /b 1
)

echo Node.js已安装: 
node -v
echo.

echo 检查npm安装...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到npm，请重新安装Node.js
    pause
    exit /b 1
)

echo npm已安装: 
npm -v
echo.

echo ===================================
echo 开始安装后端依赖...
echo ===================================
cd backend
echo 当前目录: %CD%
echo.

echo 正在安装后端依赖，这可能需要几分钟时间...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
) else (
    echo [成功] 后端依赖安装完成
    echo.
)

echo ===================================
echo 开始安装前端依赖...
echo ===================================
cd ..
cd frontend
echo 当前目录: %CD%
echo.

echo 正在安装前端依赖，这可能需要几分钟时间...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
) else (
    echo [成功] 前端依赖安装完成
    echo.
)

cd ..
echo ===================================
echo 所有依赖安装完成！
echo ===================================
echo.
echo 下一步：
echo 1. 配置环境变量（参考 installation-guide.md）
echo 2. 启动后端服务器：cd backend && npm run dev
echo 3. 启动前端开发服务器：cd frontend && npm run dev
echo.

pause