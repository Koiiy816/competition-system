#!/bin/bash

# 运动比赛竞赛系统部署脚本
# 此脚本帮助将系统部署到生产环境服务器

# 确保脚本在错误时停止执行
set -e

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${GREEN}开始部署运动比赛竞赛系统...${NC}"

# 检查必要的命令是否存在
command -v node >/dev/null 2>&1 || { echo -e "${RED}需要安装Node.js但未找到，请先安装Node.js${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}需要安装npm但未找到${NC}" >&2; exit 1; }
command -v mongo >/dev/null 2>&1 || { echo -e "${YELLOW}警告: MongoDB未安装，请确保有可用的MongoDB服务${NC}" >&2; }

# 获取部署配置
read -p "请输入MongoDB连接URI (默认: mongodb://localhost:27017/competition-system): " MONGO_URI
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017/competition-system}

read -p "请输入服务器端口 (默认: 5000): " PORT
PORT=${PORT:-5000}

read -p "请输入JWT密钥 (默认: 随机生成): " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}

read -p "请输入前端API基础URL (例如: https://api.yourdomain.com): " API_BASE_URL

# 创建生产环境配置文件
echo -e "${GREEN}创建生产环境配置...${NC}"
cat > ./backend/config/.env.production << EOL
NODE_ENV=production
PORT=${PORT}
MONGO_URI=${MONGO_URI}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE=30d
EOL

# 安装后端依赖
echo -e "${GREEN}安装后端依赖...${NC}"
cd backend
npm install --production

# 更新前端API配置
if [ ! -z "$API_BASE_URL" ]; then
  echo -e "${GREEN}更新前端API配置...${NC}"
  cd ../frontend
  
  # 创建生产环境API配置
  cat > ./src/services/api.prod.js << EOL
import axios from 'axios';

// 创建axios实例 - 生产环境
const api = axios.create({
  baseURL: '${API_BASE_URL}',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加token到请求头
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = \`Bearer \${token}\`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理常见错误
api.interceptors.response.use(
  response => response,
  error => {
    // 处理401错误 - 未授权/token过期
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 如果不是登录页面，则重定向到登录页
      if (window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
EOL

  # 修改前端构建配置以使用生产环境API
  echo -e "${GREEN}更新前端构建配置...${NC}"
  npm install
  npm run build
fi

echo -e "${GREEN}部署准备完成!${NC}"
echo -e "${YELLOW}后续步骤:${NC}"
echo "1. 将生成的文件复制到您的Web服务器"
echo "2. 配置Nginx或其他Web服务器作为反向代理"
echo "3. 启动后端服务: 'cd backend && NODE_ENV=production node server.js'"
echo "4. 或使用PM2管理后端服务: 'pm2 start backend/server.js --name competition-system'"

echo -e "${GREEN}详细部署说明请参考 deployment-guide.md${NC}"