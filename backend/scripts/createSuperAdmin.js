const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../config/.env' });

const createSuperAdmin = async () => {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition-system');
    console.log('MongoDB 连接成功');

    // 检查是否已存在超级管理员
    const existingAdmin = await User.findOne({ email: 'admin@system.com' });
    if (existingAdmin) {
      console.log('超级管理员已存在');
      await mongoose.disconnect();
      return;
    }

    // 创建超级管理员用户
    const adminUser = new User({
      name: 'SuperAdmin',
      email: 'admin@system.com',
      password: 'admin123456',
      roles: ['admin', 'organizer', 'referee'] // 拥有所有权限
    });

    await adminUser.save();
    console.log('超级管理员创建成功！');
    console.log('邮箱: admin@system.com');
    console.log('密码: admin123456');
    console.log('角色: admin, organizer, referee');

    await mongoose.disconnect();
  } catch (error) {
    console.error('创建超级管理员失败:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

createSuperAdmin();