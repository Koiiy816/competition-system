const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function debugUserPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // 获取所有用户（包括密码字段）
    const users = await User.find({}).select('+password');
    
    console.log(`找到 ${users.length} 个用户:\n`);
    
    for (const user of users) {
      console.log(`用户: ${user.name} (${user.email})`);
      console.log(`存储的密码哈希: ${user.password}`);
      
      // 测试密码验证
      const testPasswords = {
        'admin@system.com': 'admin123456',
        'test@organizer.com': 'password123',
        'participant@test.com': 'password123',
        'spectator@test.com': 'password123'
      };
      
      const expectedPassword = testPasswords[user.email];
      if (expectedPassword) {
        console.log(`预期密码: ${expectedPassword}`);
        
        // 直接使用bcrypt比较
        const directMatch = await bcrypt.compare(expectedPassword, user.password);
        console.log(`直接bcrypt比较结果: ${directMatch}`);
        
        // 使用模型方法比较
        const modelMatch = await user.matchPassword(expectedPassword);
        console.log(`模型方法比较结果: ${modelMatch}`);
        
        // 测试手动加密的密码是否匹配
        const manualHash = await bcrypt.hash(expectedPassword, 10);
        console.log(`手动加密的哈希: ${manualHash}`);
        const manualMatch = await bcrypt.compare(expectedPassword, manualHash);
        console.log(`手动加密验证: ${manualMatch}`);
      }
      
      console.log('---\n');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugUserPassword();