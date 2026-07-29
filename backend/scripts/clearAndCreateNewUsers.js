const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function clearAndCreateNewUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // 删除所有现有用户
    const deleteResult = await User.deleteMany({});
    console.log(`已删除 ${deleteResult.deletedCount} 个现有用户`);
    
    // 创建新用户数据
    const newUsers = [
      {
        name: '管理员',
        email: 'admin@system.com',
        password: await bcrypt.hash('admin123456', 10),
        roles: ['admin']
      },
      {
        name: '组织者',
        email: 'test@organizer.com',
        password: await bcrypt.hash('password123', 10),
        roles: ['organizer']
      },
      {
        name: '参赛者',
        email: 'participant@test.com',
        password: await bcrypt.hash('password123', 10),
        roles: ['participant']
      },
      {
        name: '观众',
        email: 'spectator@test.com',
        password: await bcrypt.hash('password123', 10),
        roles: ['spectator']
      }
    ];
    
    // 批量创建新用户
    const createdUsers = await User.insertMany(newUsers);
    console.log(`已创建 ${createdUsers.length} 个新用户:`);
    
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.roles.join(', ')}`);
    });
    
    console.log('\n用户账户信息:');
    console.log('1. 管理员: admin@system.com / admin123456');
    console.log('2. 组织者: test@organizer.com / password123');
    console.log('3. 参赛者: participant@test.com / password123');
    console.log('4. 观众: spectator@test.com / password123');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearAndCreateNewUsers();