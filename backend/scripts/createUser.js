require('dotenv').config({ path: '../config/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

// 连接到数据库
connectDB();

const createUser = async (username, email, password, role) => {
  if (!username || !email || !password || !role) {
    console.error('错误：用户名、邮箱、密码和角色都是必填项。');
    process.exit(1);
  }

  if (!['admin', 'organizer', 'referee'].includes(role)) {
    console.error('错误：无效的角色。必须是 “admin”、“organizer” 或 “referee”。');
    process.exit(1);
  }

  try {
    // 检查用户是否已存在
    let user = await User.findOne({ email });
    if (user) {
      console.error('错误：用户已存在。');
      process.exit(1);
    }

    // 创建新用户
    user = new User({
      name: username,
      email,
      password,
      roles: [role],
    });

    // 保存用户（密码会在User模型的pre('save')中间件中自动加密）
    await user.save();

    console.log(`成功创建用户：${username} (${email})，角色：${role}`);
  } catch (error) {
    console.error('创建用户时出错：', error.message);
  } finally {
    mongoose.connection.close();
  }
};

// 从命令行参数获取用户信息
const username = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];
const role = process.argv[5];

if (!username || !email || !password || !role) {
  console.log('用法：node createUser.js <用户名> <邮箱> <密码> <角色>');
  console.log('示例：node createUser.js admin admin@example.com password123 admin');
  process.exit(1);
}

createUser(username, email, password, role);