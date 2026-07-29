# 运动比赛竞赛系统安装指南

本指南将帮助您完成运动比赛竞赛系统的安装和运行。

## 1. 安装Node.js环境

### Windows系统

1. 访问Node.js官方网站：https://nodejs.org/
2. 下载LTS（长期支持）版本（推荐使用14.x或更高版本）
3. 运行下载的安装程序，按照向导完成安装
4. 安装完成后，打开命令提示符或PowerShell，输入以下命令验证安装：

```bash
node -v
npm -v
```

如果显示版本号，则表示安装成功。

### macOS系统

1. 访问Node.js官方网站：https://nodejs.org/
2. 下载LTS（长期支持）版本
3. 运行下载的安装程序，按照向导完成安装
4. 或者使用Homebrew安装：

```bash
brew install node
```

5. 安装完成后，打开终端，输入以下命令验证安装：

```bash
node -v
npm -v
```

### Linux系统

使用包管理器安装：

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install nodejs npm
```

#### CentOS/RHEL/Fedora

```bash
sudo dnf install nodejs
```

验证安装：

```bash
node -v
npm -v
```

## 2. 安装MongoDB数据库

### Windows系统

1. 访问MongoDB官方网站：https://www.mongodb.com/try/download/community
2. 下载MongoDB Community Server
3. 运行安装程序，选择"Complete"安装类型
4. 可以选择安装MongoDB Compass（图形化管理工具）
5. 完成安装后，MongoDB服务应该会自动启动

### macOS系统

使用Homebrew安装：

```bash
brew tap mongodb/brew
brew install mongodb-community
```

启动MongoDB服务：

```bash
brew services start mongodb-community
```

### Linux系统

#### Ubuntu/Debian

```bash
# 导入公钥
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# 创建源列表文件
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# 更新包数据库
sudo apt update

# 安装MongoDB
sudo apt install -y mongodb-org

# 启动MongoDB服务
sudo systemctl start mongod

# 设置开机自启
sudo systemctl enable mongod
```

## 3. 安装项目依赖

在项目根目录下，分别为前端和后端安装依赖：

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

## 4. 配置环境变量

1. 在后端目录中，找到`config/.env`文件
2. 如果该文件不存在，创建一个新文件
3. 添加以下配置（根据您的环境修改）：

```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/competition-system
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
```

注意：将`your_jwt_secret_key_here`替换为一个复杂的随机字符串，作为JWT密钥。

## 5. 启动后端服务器

```bash
cd backend
npm run dev
```

如果一切正常，您应该看到类似以下的输出：

```
服务器运行在端口 5000
MongoDB 连接成功: localhost
```

## 6. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

启动成功后，您应该看到类似以下的输出：

```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

现在，您可以在浏览器中访问 http://localhost:3000/ 来使用运动比赛竞赛系统。

## 常见问题解决

### 1. MongoDB连接失败

- 确保MongoDB服务正在运行
- 检查MongoDB连接字符串是否正确
- 检查防火墙设置是否允许MongoDB连接

### 2. 端口冲突

如果端口被占用，可以在配置文件中修改端口号：

- 后端：修改`config/.env`中的`PORT`值
- 前端：修改`vite.config.js`中的`server.port`值

### 3. 依赖安装失败

尝试使用以下命令清除npm缓存后重新安装：

```bash
npm cache clean --force
npm install
```

### 4. 其他问题

如果遇到其他问题，请检查控制台错误信息，或参考项目文档。