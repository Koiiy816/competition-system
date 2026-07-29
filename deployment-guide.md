# 运动比赛竞赛系统部署指南

本指南将帮助您将运动比赛竞赛系统部署到互联网上，使其他人可以通过网络访问使用。

## 目录

1. [部署前准备](#部署前准备)
2. [选择部署方案](#选择部署方案)
3. [服务器配置](#服务器配置)
4. [域名与DNS设置](#域名与DNS设置)
5. [HTTPS配置](#HTTPS配置)
6. [系统部署](#系统部署)
7. [负载均衡与扩展](#负载均衡与扩展)
8. [监控与维护](#监控与维护)
9. [常见问题](#常见问题)

## 部署前准备

在将系统部署到互联网之前，请确保：

1. 系统在本地环境中已经完整测试，功能正常
2. 数据库已正确配置，包括必要的索引和安全设置
3. 环境变量已适当配置，特别是生产环境相关设置
4. 敏感信息（如数据库密码、JWT密钥等）已妥善保护

## 选择部署方案

### 方案1：传统VPS/云服务器部署

适合有一定服务器管理经验的团队，成本较低但需要自行管理服务器。

**推荐服务商**：
- 阿里云ECS
- 腾讯云CVM
- AWS EC2
- DigitalOcean Droplets

### 方案2：平台即服务(PaaS)部署

无需管理服务器，专注于应用开发，但成本较高。

**推荐服务商**：
- Heroku
- Vercel (前端)
- Netlify (前端)
- Railway

### 方案3：容器化部署

使用Docker和Kubernetes等技术，适合需要高可用性和可扩展性的场景。

**推荐服务商**：
- 阿里云容器服务
- 腾讯云TKE
- AWS ECS/EKS
- Google Cloud Run

## 服务器配置

以下以Linux服务器(Ubuntu)为例，说明基本配置步骤：

### 1. 安装必要软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js和npm
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# 安装MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# 安装Nginx作为反向代理
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. 创建系统用户

```bash
sudo adduser --system --group competition-app
sudo mkdir -p /var/www/competition-system
sudo chown -R competition-app:competition-app /var/www/competition-system
```

### 3. 配置防火墙

```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

## 域名与DNS设置

1. 购买域名（如阿里云、腾讯云、GoDaddy等提供商）
2. 在域名提供商的控制面板中，添加DNS记录：
   - 添加A记录，将域名指向您的服务器IP地址
   - 如需配置子域名（如api.yourdomain.com），添加相应的A记录或CNAME记录

## HTTPS配置

使用Let's Encrypt免费SSL证书：

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取并安装证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期证书
sudo systemctl status certbot.timer
```

## 系统部署

### 1. 部署后端

```bash
# 切换到应用目录
cd /var/www/competition-system

# 克隆代码仓库（假设使用Git）
sudo -u competition-app git clone https://your-repository-url.git .

# 安装依赖
sudo -u competition-app npm install --production

# 配置环境变量
sudo -u competition-app cp .env.example .env
sudo -u competition-app nano .env  # 编辑环境变量

# 使用PM2管理Node.js应用
sudo npm install -g pm2
sudo -u competition-app pm2 start server.js --name "competition-backend"
sudo -u competition-app pm2 startup
sudo -u competition-app pm2 save
```

### 2. 部署前端

```bash
# 进入前端目录
cd /var/www/competition-system/frontend

# 安装依赖
sudo -u competition-app npm install

# 修改API地址配置
sudo -u competition-app nano src/services/api.js  # 将baseURL修改为生产环境API地址

# 构建生产版本
sudo -u competition-app npm run build
```

### 3. 配置Nginx反向代理

创建Nginx配置文件：

```bash
sudo nano /etc/nginx/sites-available/competition-system
```

添加以下内容：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # 重定向HTTP到HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 前端静态文件
    location / {
        root /var/www/competition-system/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/competition-system /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

## 负载均衡与扩展

当用户量增加时，可以考虑：

1. **垂直扩展**：增加服务器配置（CPU、内存）
2. **水平扩展**：
   - 使用Nginx或云服务商提供的负载均衡器
   - 将MongoDB部署为副本集
   - 使用Redis进行会话管理和缓存

示例Nginx负载均衡配置：

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}

server {
    listen 80;
    
    location /api {
        proxy_pass http://backend;
    }
}
```

## 监控与维护

### 1. 日志管理

```bash
# 查看应用日志
pm2 logs

# 查看Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 查看MongoDB日志
sudo tail -f /var/log/mongodb/mongod.log
```

### 2. 监控工具

- **服务器监控**：Prometheus + Grafana
- **应用监控**：PM2 + PM2 Plus
- **错误跟踪**：Sentry
- **性能监控**：New Relic

### 3. 备份策略

```bash
# MongoDB备份脚本示例
mongodump --db competition_db --out /backup/mongodb/$(date +"%Y-%m-%d")

# 添加到crontab定时执行
0 2 * * * mongodump --db competition_db --out /backup/mongodb/$(date +\%Y-\%m-\%d)
```

## 常见问题

### 1. 系统无法访问

- 检查服务器防火墙设置
- 确认Nginx和Node.js服务正在运行
- 检查域名DNS是否正确解析到服务器IP

### 2. 数据库连接问题

- 确认MongoDB服务正在运行：`sudo systemctl status mongod`
- 检查数据库连接字符串是否正确
- 确认MongoDB是否允许远程连接（如适用）

### 3. HTTPS证书问题

- 检查证书是否过期：`sudo certbot certificates`
- 手动更新证书：`sudo certbot renew`

### 4. 性能问题

- 优化数据库查询和索引
- 检查服务器资源使用情况：`top`, `htop`
- 考虑增加服务器资源或进行水平扩展

---

通过以上步骤，您的运动比赛竞赛系统将成功部署到互联网上，并可以被其他用户通过网络访问。根据实际需求和用户量，您可以选择适合的部署方案和扩展策略。