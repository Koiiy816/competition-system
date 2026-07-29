# 运动比赛竞赛系统部署指南

本文档提供了将运动比赛竞赛系统部署到互联网上的简要指南，使其他人可以通过网络访问使用。

## 部署选项

您有以下几种部署选项：

### 1. 传统服务器部署

适合有服务器管理经验的用户，可以使用自己的服务器或云服务器（如阿里云、腾讯云、AWS等）。

**步骤：**

1. 准备一台服务器（Linux或Windows）
2. 安装必要的软件：Node.js、MongoDB、Nginx/Apache
3. 上传项目文件到服务器
4. 运行部署脚本：
   - Linux: `./deploy.sh`
   - Windows: `deploy.bat`
5. 按照脚本提示完成配置
6. 启动服务

详细说明请参考 [deployment-guide.md](./deployment-guide.md)

### 2. Docker容器化部署

适合喜欢容器化部署的用户，提供了更好的环境一致性和可移植性。

**步骤：**

1. 安装Docker和Docker Compose
2. 修改`docker-compose.yml`中的环境变量（如JWT密钥）
3. 运行：`docker-compose up -d`

### 3. 云平台部署

#### 阿里云/腾讯云

1. 创建ECS/CVM实例
2. 按照传统服务器部署步骤操作

#### Heroku (后端)

1. 创建Heroku账号和应用
2. 安装Heroku CLI
3. 初始化Git仓库（如果尚未初始化）
4. 添加Heroku远程仓库：`heroku git:remote -a your-app-name`
5. 配置环境变量：`heroku config:set NODE_ENV=production JWT_SECRET=your_secret`
6. 添加MongoDB插件：`heroku addons:create mongolab`
7. 部署：`git push heroku main`

#### Vercel/Netlify (前端)

1. 创建账号
2. 导入前端项目仓库
3. 配置构建命令：`npm run build`
4. 配置输出目录：`dist`
5. 配置环境变量，指向后端API

## 网络访问配置

### 域名设置

1. 购买域名（如阿里云、腾讯云、GoDaddy等提供商）
2. 在域名提供商控制面板中添加DNS记录：
   - 添加A记录，将域名指向您的服务器IP地址
   - 如需配置子域名，添加相应的A记录或CNAME记录

### HTTPS配置

使用Let's Encrypt免费SSL证书：

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取并安装证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 防火墙设置

确保服务器防火墙开放必要端口：

- HTTP: 80
- HTTPS: 443
- 如果直接访问后端API: 5000（或您配置的端口）

## 快速启动指南

### 方法1：使用部署脚本

```bash
# Linux
./deploy.sh

# Windows
deploy.bat
```

### 方法2：使用Docker

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 常见问题

1. **无法连接到数据库**
   - 检查MongoDB服务是否运行
   - 验证连接字符串是否正确
   - 确认防火墙设置允许数据库连接

2. **API请求失败**
   - 检查后端服务是否运行
   - 验证API基础URL配置是否正确
   - 检查CORS设置

3. **HTTPS证书问题**
   - 确认证书未过期
   - 验证证书配置正确

4. **前端无法加载**
   - 检查Nginx/Apache配置
   - 验证构建过程是否成功
   - 检查浏览器控制台错误

## 更多资源

详细的部署指南请参考 [deployment-guide.md](./deployment-guide.md)

---

如有任何部署问题，请参考详细文档或联系系统管理员。