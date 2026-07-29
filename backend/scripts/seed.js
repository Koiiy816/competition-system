const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');
const Schedule = require('../models/Schedule');
const Result = require('../models/Result');

// 加载环境变量
dotenv.config({ path: '../config/.env' });

const importData = async () => {
  try {
    // 直接连接数据库
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB 连接成功');

    // 等待数据库连接完成
    await new Promise(resolve => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('open', resolve);
      }
    });

    // 清除现有数据
    await User.deleteMany();
    await Competition.deleteMany();
    await Participant.deleteMany();
    await Schedule.deleteMany();
    await Result.deleteMany();

    console.log('数据已清除！');

    // 插入用户
    const users = await User.insertMany([
      { name: '管理员', email: 'admin@example.com', password: '123456', roles: ['admin'] },
      { name: '组织者', email: 'organizer@example.com', password: '123456', roles: ['organizer'] },
      { name: '裁判', email: 'referee@example.com', password: '123456', roles: ['referee'] },
    ]);

    console.log('用户已导入！');

    // 插入比赛
    const competitions = await Competition.insertMany([
      {
        name: '春季编程大赛',
        description: '一场面向所有编程爱好者的比赛。',
        type: 'programming',
        rules: '参赛者需要在规定时间内完成编程任务，按照代码质量和完成时间进行评分。',
        startDate: new Date('2024-05-01T09:00:00Z'),
        endDate: new Date('2024-05-01T17:00:00Z'),
        registrationDeadline: new Date('2024-04-25T23:59:59Z'),
        location: '线上',
        status: 'registration',
        organizer: users[1]._id,
      },
    ]);

    console.log('比赛已导入！');

    // 插入参赛者
    const participant1 = new Participant({
      user: users[0]._id,
      competition: competitions[0]._id,
      type: 'individual',
      registrationDate: new Date(),
      status: 'approved',
    });
    await participant1.save();

    const participant2 = new Participant({
      user: users[1]._id,
      competition: competitions[0]._id,
      type: 'individual',
      registrationDate: new Date(),
      status: 'approved',
    });
    await participant2.save();

    console.log('参赛者已导入！');

    process.exit();
  } catch (error) {
    console.error(`错误：${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    // 清除所有数据
    await User.deleteMany();
    await Competition.deleteMany();
    await Participant.deleteMany();
    await Schedule.deleteMany();
    await Result.deleteMany();

    console.log('数据已销毁！');
    process.exit();
  } catch (error) {
    console.error(`错误：${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}