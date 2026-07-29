@echo off
echo ===================================
echo 运动比赛竞赛系统 - 环境配置脚本
echo ===================================
echo.

set ENV_FILE=backend\config\.env
set EXAMPLE_FILE=backend\config\.env.example

echo 检查环境变量配置文件...

if exist %ENV_FILE% (
    echo [信息] 环境变量配置文件已存在
    echo 如需重新配置，请手动删除 %ENV_FILE% 文件后重新运行此脚本
    echo 或者直接编辑该文件
    goto :END
)

if not exist %EXAMPLE_FILE% (
    echo [错误] 示例配置文件不存在: %EXAMPLE_FILE%
    pause
    exit /b 1
)

echo 创建环境变量配置文件...
echo.

:: 生成随机JWT密钥
setlocal EnableDelayedExpansion
set "chars=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%%^&*"
set JWT_SECRET=

for /L %%i in (1,1,32) do (
    set /a rand=!random! %% 72
    for /F %%j in ("!rand!") do set "JWT_SECRET=!JWT_SECRET!!chars:~%%j,1!"
)

echo NODE_ENV=development> %ENV_FILE%
echo PORT=5000>> %ENV_FILE%
echo MONGO_URI=mongodb://localhost:27017/competition-system>> %ENV_FILE%
echo JWT_SECRET=%JWT_SECRET%>> %ENV_FILE%
echo JWT_EXPIRE=30d>> %ENV_FILE%
echo JWT_COOKIE_EXPIRE=30>> %ENV_FILE%
echo FILE_UPLOAD_PATH=./public/uploads>> %ENV_FILE%
echo MAX_FILE_UPLOAD=1000000>> %ENV_FILE%

echo [成功] 环境变量配置文件已创建: %ENV_FILE%
echo.

echo 配置内容:
type %ENV_FILE%
echo.

:END
echo ===================================
echo 环境配置完成！
echo ===================================
echo.
echo 下一步：
echo 1. 启动后端服务器：cd backend && npm run dev
echo 2. 启动前端开发服务器：cd frontend && npm run dev
echo.

pause