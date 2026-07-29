# Node.js 安装指南

## 检测结果

系统中未检测到Node.js。要运行运动比赛竞赛系统，您需要安装Node.js环境。

## 下载Node.js

1. 访问Node.js官方网站：https://nodejs.org/
2. 下载LTS（长期支持）版本，这是推荐的稳定版本
3. 选择适合您操作系统的安装包（Windows、macOS或Linux）

## Windows安装步骤

1. 运行下载的`.msi`安装文件
2. 接受许可协议并点击"Next"
3. 选择安装位置，或保留默认位置，点击"Next"
4. 在"Custom Setup"页面，确保选中"npm package manager"，点击"Next"
5. 选择是否安装额外的工具（可选），点击"Next"
6. 点击"Install"开始安装
7. 安装完成后，点击"Finish"

## 验证安装

安装完成后，重新打开命令提示符或PowerShell，输入以下命令验证安装：

```bash
node -v
npm -v
```

如果显示版本号（例如`v16.15.0`和`8.5.5`），则表示安装成功。

## 安装完成后

安装Node.js后，请继续按照`installation-guide.md`中的步骤2-6完成系统的安装和配置。