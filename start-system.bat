@echo off
echo ===================================
echo 运动比赛竞赛系统 - 一键启动脚本
echo ===================================
echo.

echo 检查系统环境...

echo 1. 检查Node.js安装...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 请参考 node-js-installation.md 文件进行安装
    pause
    exit /b 1
)
echo    Node.js已安装: 
node -v

echo 2. 检查MongoDB服务...
sc query MongoDB >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] MongoDB服务可能未启动
    echo 请确保MongoDB已安装并正在运行
    echo 请参考 mongodb-installation.md 文件进行安装
    echo.
    echo 是否继续启动系统？(Y/N)
    set /p CONTINUE=
    if /i "%CONTINUE%" NEQ "Y" (
        echo 操作已取消
        pause
        exit /b 1
    )
)

echo 3. 检查环境变量配置...
if not exist backend\config\.env (
    echo [警告] 环境变量配置文件不存在
    echo 是否现在配置环境变量？(Y/N)
    set /p CONFIG=
    if /i "%CONFIG%" EQU "Y" (
        call configure-env.bat
    ) else (
        echo 请先运行 configure-env.bat 配置环境变量
        pause
        exit /b 1
    )
)

echo 4. 检查依赖安装...
if not exist backend\node_modules (
    echo [警告] 后端依赖未安装
    echo 是否安装项目依赖？(Y/N)
    set /p INSTALL=
    if /i "%INSTALL%" EQU "Y" (
        call install-dependencies.bat
    ) else (
        echo 请先运行 install-dependencies.bat 安装依赖
        pause
        exit /b 1
    )
) else if not exist frontend\node_modules (
    echo [警告] 前端依赖未安装
    echo 是否安装项目依赖？(Y/N)
    set /p INSTALL=
    if /i "%INSTALL%" EQU "Y" (
        call install-dependencies.bat
    ) else (
        echo 请先运行 install-dependencies.bat 安装依赖
        pause
        exit /b 1
    )
)

echo.
echo ===================================
echo 启动系统...
echo ===================================
echo.

echo 正在启动后端服务器...
start "运动比赛竞赛系统 - 后端服务器" cmd /c "start-backend.bat"

echo 等待后端服务器启动...
timeout /t 5 /nobreak > nul

echo 正在启动前端开发服务器...
start "运动比赛竞赛系统 - 前端开发服务器" cmd /c "start-frontend.bat"

echo.
echo ===================================
echo 系统启动完成！
echo ===================================
echo.
echo 前端地址: http://localhost:3000
echo 后端API地址: http://localhost:5000
echo.
echo 提示：
echo - 系统已在新窗口中启动
echo - 关闭窗口可停止相应的服务
echo.

pause