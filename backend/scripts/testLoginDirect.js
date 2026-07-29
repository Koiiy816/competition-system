const mongoose = require('mongoose');
const User = require('../models/User');

async function testLoginDirect() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    const testUsers = [
      { email: 'admin@system.com', password: 'admin123456', name: '管理员' },
      { email: 'test@organizer.com', password: 'password123', name: '组织者' },
      { email: 'participant@test.com', password: 'password123', name: '参赛者' },
      { email: 'spectator@test.com', password: 'password123', name: '观众' }
    ];

    console.log('直接测试登录逻辑...\n');

    for (const testUser of testUsers) {
      console.log(`测试 ${testUser.name} (${testUser.email}):`);
      
      try {
        // 模拟登录控制器逻辑
        const { email, password } = testUser;

        // 检查用户是否存在
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
          console.log('❌ 用户不存在');
          continue;
        }

        console.log(`✅ 用户存在: ${user.name}`);
        console.log(`   角色: ${user.roles.join(', ')}`);

        // 检查密码是否匹配
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
          console.log('❌ 密码不匹配');
        } else {
          console.log('✅ 密码匹配');
          
          // 生成token
          const token = user.getSignedJwtToken();
          console.log(`✅ Token生成成功: ${token.substring(0, 20)}...`);
        }
        
      } catch (error) {
        console.log(`❌ 错误: ${error.message}`);
      }
      
      console.log('');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLoginDirect();