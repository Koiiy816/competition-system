require('dotenv').config({ path: '../config/.env' });
const mongoose = require('mongoose');
const crypto = require('crypto');
const connectDB = require('../config/db');
const InvitationCode = require('../models/InvitationCode');

// 连接到数据库
connectDB();

const generateCodes = async (role, count) => {
  if (!['organizer', 'referee'].includes(role)) {
    console.error('错误：无效的角色。必须是 “organizer” 或 “referee”。');
    process.exit(1);
  }

  if (isNaN(count) || count < 1) {
    console.error('错误：无效的数量。必须是大于0的数字。');
    process.exit(1);
  }

  try {
    const codes = [];
    for (let i = 0; i < count; i++) {
      let code;
      let isUnique = false;
      // 生成一个唯一的6位代码
      while (!isUnique) {
        // crypto.randomInt 在 Node.js v14.10.0+ 中可用，比 Math.random() 更安全
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const existingCode = await InvitationCode.findOne({ code });
        if (!existingCode) {
          isUnique = true;
        }
      }
      const newCode = new InvitationCode({
        code,
        role,
      });
      await newCode.save();
      codes.push(code);
    }
    console.log(`成功为角色 “${role}” 生成了 ${count} 个邀请码：`);
    codes.forEach(code => console.log(code));
  } catch (error) {
    console.error('生成邀请码时出错：', error.message);
  } finally {
    mongoose.connection.close();
  }
};

// 从命令行参数获取角色和数量
const role = process.argv[2];
const count = parseInt(process.argv[3], 10) || 1;

if (!role) {
  console.log('用法：node generateInvitationCode.js <角色> [数量]');
  console.log('示例：node generateInvitationCode.js organizer 5');
  process.exit(1);
}

generateCodes(role, count);