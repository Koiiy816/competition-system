const express = require('express');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: './config/.env' });

const connectDB = require('./config/db');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Import middleware
const { errorHandler } = require('./middlewares/errorMiddleware');
const { notFound } = require('./middlewares/errorMiddleware');

// Import controllers
const { getResultStatuses } = require('./controllers/resultController');

// Create Express app
const app = express();

// Middleware
app.use(cors());
// 增加请求体大小限制，避免保存大型比赛配置时出现 "request entity too large" 错误
// 500mb 足够支持任何极端的纯文本 JSON 配置（相当于几百万字的纯文本）
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/competitions', require('./routes/competitions'));
app.use('/api/participants', require('./routes/participants'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/results', require('./routes/results'));
app.use('/api', require('./routes/templates')); // 添加模板路由
app.use('/api/settings', require('./routes/settings')); // 添加设置路由

// Additional API endpoints
app.get('/api/result-statuses', getResultStatuses);

// Basic route for API health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API服务运行正常' });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  // Any route that is not an API route will be served the React app
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;