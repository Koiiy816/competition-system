const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const User = require('../models/User');

async function createWushuCompetition() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system');
    console.log('Connected to MongoDB');

    // 查找管理员用户作为组织者
    const admin = await User.findOne({ roles: { $in: ['admin'] } });
    if (!admin) {
      console.log('未找到管理员用户，请先创建管理员');
      process.exit(1);
    }

    // 检查是否已存在武术比赛
    const existingCompetition = await Competition.findOne({
      name: '2025年深圳市中小学生武术比赛'
    });

    if (existingCompetition) {
      console.log('武术比赛已存在，ID:', existingCompetition._id);
      await mongoose.disconnect();
      return;
    }

    // 创建武术比赛基本信息
    const wushuCompetition = await Competition.create({
      name: '2025年深圳市中小学生武术比赛',
      description: '面向深圳市中小学生的武术比赛，旨在推广传统武术文化，提高学生身体素质。',
      type: 'martial_arts',
      rules: '比赛分为套路和散打两个项目，按年龄组别进行分组比赛。',
      startDate: new Date('2025-06-01T09:00:00Z'),
      endDate: new Date('2025-06-03T17:00:00Z'),
      registrationDeadline: new Date('2025-05-15T23:59:59Z'),
      location: '深圳市体育中心',
      maxParticipants: 500,
      status: 'registration',
      organizer: admin._id,
      requirements: '面向全市所有中小学校，深圳市武术传统项目学校及各区武术传统项目学校必须参加'
    });

    console.log('武术比赛创建成功！');
    console.log('比赛ID:', wushuCompetition._id);
    console.log('比赛名称:', wushuCompetition.name);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createWushuCompetition();