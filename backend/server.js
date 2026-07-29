const dotenv = require('dotenv');
dotenv.config({ path: './config/.env' });

const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const errorHandler = require('./middlewares/errorMiddleware').errorHandler;
const app = require('./app');
const connectDB = require('./config/db');

// 连接到数据库
connectDB();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(
    `服务器在 ${process.env.NODE_ENV} 模式下运行于端口 ${PORT}`
  );
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (err, promise) => {
  console.log(`错误: ${err.message}`);
  // 关闭服务器并退出进程
  server.close(() => process.exit(1));
});