@echo off
echo ===================================
echo 运动比赛竞赛系统 - 启动后端服务器
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

echo 检查MongoDB服务...
sc query MongoDB >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] MongoDB服务可能未启动
    echo 请确保MongoDB已安装并正在运行
    echo 请参考 mongodb-installation.md 文件进行安装
    echo.
    echo 是否继续启动后端服务器？(Y/N)
    set /p CONTINUE=
    if /i "%CONTINUE%" NEQ "Y" (
        echo 操作已取消
        pause
        exit /b 1
    )
)

echo 检查环境变量配置...
if not exist backend\config\.env (
    echo [错误] 环境变量配置文件不存在
    echo 请先运行 configure-env.bat 配置环境变量
    pause
    exit /b 1
)

echo 检查后端依赖...
if not exist backend\node_modules (
    echo [警告] 后端依赖可能未安装
    echo 是否安装后端依赖？(Y/N)
    set /p INSTALL=
    if /i "%INSTALL%" EQU "Y" (
        echo 安装后端依赖...
        cd backend
        call npm install
        cd ..
        if %ERRORLEVEL% NEQ 0 (
            echo [错误] 后端依赖安装失败
            pause
            exit /b 1
        )
    )
)

echo.
echo ===================================
echo 启动后端服务器...
echo ===================================
echo.
echo 按 Ctrl+C 可停止服务器
echo.

cd backend
call npm run dev

pause