@echo off
echo ===================================
echo 运动比赛竞赛系统 - 启动前端开发服务器
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

echo 检查前端依赖...
if not exist frontend\node_modules (
    echo [警告] 前端依赖可能未安装
    echo 是否安装前端依赖？(Y/N)
    set /p INSTALL=
    if /i "%INSTALL%" EQU "Y" (
        echo 安装前端依赖...
        cd frontend
        call npm install
        cd ..
        if %ERRORLEVEL% NEQ 0 (
            echo [错误] 前端依赖安装失败
            pause
            exit /b 1
        )
    )
)

echo.
echo ===================================
echo 启动前端开发服务器...
echo ===================================
echo.
echo 提示：请确保后端服务器已经启动
echo 可以使用 start-backend.bat 启动后端服务器
echo.
echo 按 Ctrl+C 可停止服务器
echo.

cd frontend
call npm run dev

pause