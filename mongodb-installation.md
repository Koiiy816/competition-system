# MongoDB 安装指南

## 检测结果

系统中未检测到MongoDB。要运行运动比赛竞赛系统，您需要安装MongoDB数据库。

## 下载MongoDB

1. 访问MongoDB官方网站：https://www.mongodb.com/try/download/community
2. 下载MongoDB Community Server
3. 选择适合您操作系统的安装包（Windows、macOS或Linux）

## Windows安装步骤

1. 运行下载的`.msi`安装文件
2. 接受许可协议并点击"Next"
3. 选择"Complete"安装类型，点击"Next"
4. 可以选择安装MongoDB Compass（图形化管理工具），建议安装
5. 点击"Install"开始安装
6. 安装完成后，点击"Finish"

## 配置MongoDB服务

安装完成后，MongoDB应该会自动配置为Windows服务并启动。您可以通过以下步骤验证：

1. 打开Windows服务管理器（按Win+R，输入`services.msc`，点击确定）
2. 查找名为"MongoDB Server"的服务
3. 确保该服务的状态为"Running"（运行中）

如果服务未运行，右键点击该服务，选择"Start"（启动）。

## 创建数据目录

如果MongoDB服务无法启动，可能需要手动创建数据目录：

1. 打开命令提示符（以管理员身份运行）
2. 创建数据目录：

```bash
mkdir C:\data\db
```

## 验证安装

安装完成后，打开命令提示符或PowerShell，输入以下命令验证安装：

```bash
mongod --version
```

如果显示版本信息，则表示安装成功。

## 连接到MongoDB

您可以使用MongoDB Compass图形界面工具连接到数据库，或者使用命令行：

```bash
mongo
```

这将打开MongoDB shell，您可以在其中执行数据库命令。

## 安装完成后

安装MongoDB后，请继续按照`installation-guide.md`中的步骤3-6完成系统的安装和配置。

## 注意事项

- 确保MongoDB服务已启动
- 默认情况下，MongoDB监听localhost:27017
- 如果您更改了默认端口或主机，请相应地更新项目的配置文件