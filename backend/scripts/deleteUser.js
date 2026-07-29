const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../config/.env' });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 连接错误: ${error.message}`);
    process.exit(1);
  }
};

const deleteUser = async (email) => {
  await connectDB();
  try {
    const user = await User.findOneAndDelete({ email });
    if (user) {
      console.log(`成功删除用户: ${email}`);
    } else {
      console.log(`未找到用户: ${email}`);
    }
  } catch (error) {
    console.error(`删除用户时出错: ${error.message}`);
  } finally {
    mongoose.connection.close();
  }
};

const email = process.argv[2];
if (!email) {
  console.log('请提供要删除的用户的电子邮件地址。');
  console.log('用法: node scripts/deleteUser.js <email>');
  process.exit(1);
}

deleteUser(email);