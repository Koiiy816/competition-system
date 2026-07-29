# 使用Node.js官方镜像作为基础镜像
FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY backend/package*.json ./

# 安装依赖
RUN npm install --production

# 复制后端源代码
COPY backend/ ./

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=5000

# 暴露端口
EXPOSE 5000

# 启动应用
CMD ["node", "server.js"]