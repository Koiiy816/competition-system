require('dotenv').config({ path: './config/.env' });
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

const debugAuth = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition-system');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZWJhZjE0YzkzZDk4NWEzN2ZhM2YwMiIsImlhdCI6MTc2MDI3NjI2MSwiZXhwIjoxNzYyODY4MjYxfQ.-bHq0zI3AtZhlMircshbe0i-bVe2UR90cFOtm3vhH-0';
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token解码结果:', decoded);
    
    const user = await User.findById(decoded.id).select('-password');
    console.log('超级管理员用户:', user);
    console.log('用户角色:', user.roles);
    console.log('角色类型:', typeof user.roles);
    console.log('是否为数组:', Array.isArray(user.roles));
    
    const allowedRoles = ['organizer', 'referee'];
    console.log('允许的角色:', allowedRoles);
    
    const hasRole = user.roles && user.roles.some(role => allowedRoles.includes(role));
    console.log('权限检查结果:', hasRole);
    
    user.roles.forEach((role, index) => {
      console.log(`角色${index}: ${role}, 是否在允许列表中: ${allowedRoles.includes(role)}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('调试失败:', error);
    await mongoose.disconnect();
  }
};

debugAuth();