const mongoose = require('mongoose');
const User = require('../models/User');

async function deleteYuchifungUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // 删除 yuchifung31@gmail.com 用户
    const result = await User.deleteOne({ email: 'yuchifung31@gmail.com' });
    
    if (result.deletedCount > 0) {
      console.log('用户 yuchifung31@gmail.com (Yu Chi Fung) 已删除');
    } else {
      console.log('未找到用户 yuchifung31@gmail.com');
    }
    
    // 显示剩余的用户
    const remainingUsers = await User.find({});
    console.log(`\n剩余用户数量: ${remainingUsers.length}`);
    
    remainingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.roles.join(', ')}`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteYuchifungUser();