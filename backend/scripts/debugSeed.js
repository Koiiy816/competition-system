const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Competition = require('../models/Competition');

// 加载环境变量
dotenv.config({ path: '../config/.env' });

const debugSeed = async () => {
  try {
    console.log('开始调试数据库连接...');
    
    // 直接连接数据库
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB 连接成功');
    console.log('连接状态:', mongoose.connection.readyState);
    console.log('数据库名称:', mongoose.connection.name);
    
    // 检查现有数据
    const userCount = await User.countDocuments();
    const competitionCount = await Competition.countDocuments();
    console.log('现有用户数量:', userCount);
    console.log('现有比赛数量:', competitionCount);
    
    // 尝试插入一个测试用户
    console.log('尝试插入测试用户...');
    const testUser = new User({
      name: '测试用户',
      email: 'test@example.com',
      password: '123456',
      roles: ['admin']
    });
    
    const savedUser = await testUser.save();
    console.log('测试用户保存成功:', savedUser._id);
    
    // 再次检查数据
    const newUserCount = await User.countDocuments();
    console.log('插入后用户数量:', newUserCount);
    
    // 查询所有用户
    const allUsers = await User.find({});
    console.log('所有用户:', allUsers.map(u => ({ name: u.name, email: u.email, roles: u.roles })));
    
    await mongoose.disconnect();
    console.log('调试完成');
    
  } catch (error) {
    console.error('调试错误:', error);
    process.exit(1);
  }
};

debugSeed();