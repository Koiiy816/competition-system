const dotenv = require('dotenv');
const mongoose = require('mongoose');

// 加载环境变量
dotenv.config({ path: '../config/.env' });

async function checkDatabaseConnection() {
  try {
    console.log('环境变量 MONGO_URI:', process.env.MONGO_URI);
    
    // 连接到数据库
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
    console.log(`数据库名称: ${conn.connection.name}`);
    
    // 列出所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n数据库中的集合:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // 检查用户集合
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    console.log(`\n用户集合中的文档数量: ${userCount}`);
    
    if (userCount > 0) {
      const users = await User.find({}, 'name email roles');
      console.log('\n用户列表:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.roles.join(', ')}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n数据库连接已关闭');
    
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkDatabaseConnection();