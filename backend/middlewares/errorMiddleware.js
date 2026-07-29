/**
 * 处理404错误的中间件
 */
const notFound = (req, res, next) => {
  const error = new Error(`未找到 - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 如果状态码仍然是200，则设置为500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  console.error(err.stack); // 添加此行以在后端控制台打印错误堆栈

  res.status(statusCode);
  res.json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };