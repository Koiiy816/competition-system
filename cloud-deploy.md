# 云服务部署指南

本指南提供在主流云服务提供商上部署运动比赛竞赛系统的详细步骤。

## 目录

1. [阿里云部署](#阿里云部署)
2. [腾讯云部署](#腾讯云部署)
3. [华为云部署](#华为云部署)
4. [AWS部署](#AWS部署)

## 阿里云部署

### 1. 创建ECS实例

1. 登录[阿里云控制台](https://ecs.console.aliyun.com/)
2. 点击「创建实例」
3. 选择配置：
   - 地域：选择离用户较近的地域
   - 实例规格：至少2核4GB内存
   - 镜像：Ubuntu 20.04 或 CentOS 7
   - 存储：系统盘至少40GB
   - 网络：默认VPC
   - 安全组：开放80、443、22端口
4. 完成创建并获取实例公网IP

### 2. 连接到服务器

```bash
ssh root@<your-server-ip>
```

### 3. 安装必要软件

```bash
# 更新系统
apt update && apt upgrade -y

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt install -y nodejs

# 安装MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-5.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# 安装Nginx
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# 安装PM2
npm install -g pm2
```

### 4. 上传项目文件

使用SCP或SFTP将项目文件上传到服务器：

```bash
# 在本地执行
scp -r /path/to/competition-system root@<your-server-ip>:/var/www/
```

### 5. 配置后端

```bash
# 进入后端目录
cd /var/www/competition-system/backend

# 安装依赖
npm install --production

# 创建生产环境配置
cp config/.env.example config/.env.production
nano config/.env.production

# 启动后端服务
PORT=5000 NODE_ENV=production pm2 start server.js --name "competition-backend"
pm2 save
pm2 startup
```

### 6. 构建前端

```bash
# 进入前端目录
cd /var/www/competition-system/frontend

# 安装依赖
npm install

# 修改API基础URL
nano src/services/api.js
# 将baseURL修改为: 'https://yourdomain.com/api' 或 '/api'

# 构建前端
npm run build
```

### 7. 配置Nginx

```bash
nano /etc/nginx/sites-available/competition-system
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

    # SSL配置
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
ln -s /etc/nginx/sites-available/competition-system /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 8. 配置SSL证书

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 腾讯云部署

### 1. 创建CVM实例

1. 登录[腾讯云控制台](https://console.cloud.tencent.com/cvm/instance)
2. 点击「新建」
3. 选择配置：
   - 地域：选择离用户较近的地域
   - 机型：至少2核4GB内存
   - 镜像：Ubuntu 20.04 或 CentOS 7
   - 存储：系统盘至少40GB
   - 网络：默认VPC
   - 安全组：开放80、443、22端口
4. 完成创建并获取实例公网IP

### 2. 连接到服务器

```bash
ssh root@<your-server-ip>
```

### 3. 安装必要软件

与阿里云部署步骤3相同

### 4. 上传项目文件

与阿里云部署步骤4相同

### 5. 配置后端

与阿里云部署步骤5相同

### 6. 构建前端

与阿里云部署步骤6相同

### 7. 配置Nginx

与阿里云部署步骤7相同

### 8. 配置SSL证书

腾讯云提供免费SSL证书，可以在控制台申请并下载：

1. 访问[SSL证书控制台](https://console.cloud.tencent.com/ssl)
2. 点击「申请免费证书」
3. 按照向导完成域名验证
4. 下载证书并上传到服务器
5. 更新Nginx配置中的证书路径

## 华为云部署

### 1. 创建ECS实例

1. 登录[华为云控制台](https://console.huaweicloud.com/)
2. 进入「弹性云服务器ECS」
3. 点击「购买弹性云服务器」
4. 选择配置：
   - 区域：选择离用户较近的区域
   - 规格：至少2核4GB内存
   - 镜像：Ubuntu 20.04 或 CentOS 7
   - 存储：系统盘至少40GB
   - 网络：默认VPC
   - 安全组：开放80、443、22端口
5. 完成创建并获取实例公网IP

### 2-8. 后续步骤

与阿里云部署步骤2-8相同

## AWS部署

### 1. 创建EC2实例

1. 登录[AWS管理控制台](https://console.aws.amazon.com/)
2. 进入EC2控制台
3. 点击「启动实例」
4. 选择配置：
   - 区域：选择离用户较近的区域
   - AMI：Ubuntu Server 20.04 LTS
   - 实例类型：至少t2.small
   - 存储：至少30GB
   - 安全组：开放80、443、22端口
5. 创建或选择密钥对
6. 启动实例并获取公网IP

### 2. 连接到服务器

```bash
ssh -i your-key.pem ubuntu@<your-server-ip>
```

### 3-8. 后续步骤

与阿里云部署步骤3-8相同，但需要注意用户名为ubuntu而非root

## 使用Docker部署（适用于所有云服务商）

如果您更喜欢使用Docker部署，可以按照以下步骤操作：

### 1. 安装Docker和Docker Compose

```bash
# 安装Docker
curl -fsSL https://get.docker.com | sh

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.5.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 2. 上传项目文件

使用SCP或SFTP将项目文件上传到服务器

### 3. 配置环境变量

```bash
cd /path/to/competition-system
cp backend/config/.env.example backend/config/.env.production
nano backend/config/.env.production
```

### 4. 修改前端API配置

```bash
nano frontend/src/services/api.js
# 将baseURL修改为适当的值
```

### 5. 启动Docker容器

```bash
docker-compose up -d
```

### 6. 配置Nginx和SSL

与前面步骤7-8相同

## 常见问题

### 1. 无法连接到MongoDB

检查MongoDB服务是否正在运行：

```bash
systemctl status mongod
```

如果未运行，启动服务：

```bash
systemctl start mongod
systemctl enable mongod
```

### 2. Nginx配置测试失败

使用以下命令检查配置错误：

```bash
nginx -t
```

### 3. 无法访问网站

检查安全组/防火墙设置是否开放了80和443端口：

```bash
# Ubuntu
ufw status

# CentOS
firewall-cmd --list-all
```

如需开放端口：

```bash
# Ubuntu
ufw allow 80/tcp
ufw allow 443/tcp

# CentOS
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

### 4. SSL证书问题

检查证书是否正确安装：

```bash
certbot certificates
```

如需更新证书：

```bash
certbot renew
```

---

按照本指南的步骤，您可以在各大云服务提供商的服务器上成功部署运动比赛竞赛系统，并通过互联网提供给其他用户访问。