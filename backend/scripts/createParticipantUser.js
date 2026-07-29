require('dotenv').config({ path: '../config/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

// 连接到数据库
connectDB();

const createParticipantUser = async () => {
  try {
    // 检查用户是否已存在
    let user = await User.findOne({ email: 'participant@test.com' });
    if (user) {
      console.log('参赛者用户已存在');
      return;
    }

    // 创建参赛者用户
    user = new User({
      name: '测试参赛者',
      email: 'participant@test.com',
      password: 'password123',
      roles: ['participant'],
    });

    await user.save();
    console.log('成功创建参赛者用户：participant@test.com / password123');

    // 创建观众用户
    let spectatorUser = await User.findOne({ email: 'spectator@test.com' });
    if (!spectatorUser) {
      spectatorUser = new User({
        name: '测试观众',
        email: 'spectator@test.com',
        password: 'password123',
        roles: ['spectator'],
      });

      await spectatorUser.save();
      console.log('成功创建观众用户：spectator@test.com / password123');
    } else {
      console.log('观众用户已存在');
    }

  } catch (error) {
    console.error('创建用户时出错：', error.message);
  } finally {
    mongoose.connection.close();
  }
};

createParticipantUser();