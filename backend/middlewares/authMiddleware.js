const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');

/**
 * 保护路由的中间件，验证用户是否已登录
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ success: false, message: '未授权，用户不存在' });
      }
      
      // 实时拦截：如果当前用户是裁判，且系统关闭了裁判登录，直接将其拦截（踢出）
      if (user.roles && (user.roles.includes('referee') || user.roles.includes('chief_referee'))) {
        if (!user.roles.includes('admin')) {
          const setting = await SystemSetting.findOne({ key: 'referee_login_enabled' });
          if (setting && setting.value === false) {
            return res.status(403).json({
              success: false,
              message: '系统当前已关闭裁判访问权限。'
            });
          }
        }
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      return next(new Error('未授权，token无效'));
    }
  }

  if (!token) {
    res.status(401);
    return next(new Error('未授权，没有token'));
  }
};

/**
 * 检查用户角色的中间件
 * @param {...String} roles - 允许访问的角色列表
 */
const authorize = (...roles) => {
  const flatRoles = roles.flat();
  return (req, res, next) => {
    console.log('--- Authorize Middleware ---');
    console.log('Path:', req.path);
    console.log('Allowed roles:', flatRoles);
    if (!req.user) {
      console.log('Authorization failed: req.user is not defined.');
      res.status(401);
      return next(new Error('未授权，请先登录'));
    }

    console.log('User roles:', req.user.roles);
    const hasRole = req.user.roles && req.user.roles.some(role => flatRoles.includes(role));
    console.log('Has required role:', hasRole);
    
    if (!hasRole) {
      console.log('Authorization failed: User does not have the required role.');
      res.status(403);
      return next(new Error('您没有权限执行此操作'));
    }

    console.log('Authorization successful.');
    console.log('--- End Authorize Middleware ---');
    next();
  };
};

module.exports = { protect, authorize };