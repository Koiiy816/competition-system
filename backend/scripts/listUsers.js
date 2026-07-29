const mongoose = require('mongoose');
const User = require('../models/User');

async function listUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    const users = await User.find({});
    
    console.log(`找到 ${users.length} 个用户:`);
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   邮箱: ${user.email}`);
      console.log(`   角色: ${user.roles.join(', ')}`);
      console.log(`   创建时间: ${user.createdAt}`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listUsers();