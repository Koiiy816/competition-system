const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Participant = require('./models/Participant');
const User = require('./models/User');
const Competition = require('./models/Competition');

// 加载环境变量
dotenv.config({ path: './config/.env' });

const mockParticipants = async () => {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected.');

    // 找到深圳第一小学 (school1@test.com)
    const orgUser = await User.findOne({ email: 'school1@test.com' });
    if (!orgUser) {
      console.error('Organization user not found!');
      process.exit(1);
    }
    
    // 找到 2025年深圳市中小学生武术比赛
    const competition = await Competition.findOne({ name: /2025年深圳市中小学生武术比赛/i });
    if (!competition) {
       console.error('Competition not found!');
       process.exit(1);
    }

    const testData = [
      {
        user: orgUser._id,
        competition: competition._id,
        name: '张小明',
        schoolName: '深圳第一小学',
        grade: '三年级',
        ageGroup: 'U9组',
        event: '初级长拳第三路',
        gender: 'male',
        idCard: '440301201701011234',
        phone: '13800000001',
        coach: '李教练',
        insuranceConfirmed: true,
        type: 'individual',
        status: 'pending',
        registrationNumber: '20250001',
        additionalInfo: { notes: '第一次参加比赛' }
      },
      {
        user: orgUser._id,
        competition: competition._id,
        name: '王小红',
        schoolName: '深圳第一小学',
        grade: '五年级',
        ageGroup: 'U11组',
        event: '初级剑术',
        gender: 'female',
        idCard: '440301201502022345',
        phone: '13800000002',
        coach: '李教练',
        insuranceConfirmed: true,
        type: 'individual',
        status: 'approved',
        registrationNumber: '20250002',
        additionalInfo: { notes: '有剑术基础' }
      },
      {
        user: orgUser._id,
        competition: competition._id,
        name: '深圳第一小学武术一队',
        schoolName: '深圳第一小学',
        event: '集体基本功',
        gender: 'male', 
        idCard: '000000000000000000', 
        phone: '13800000003',
        coach: '王教练',
        insuranceConfirmed: true,
        type: 'team',
        teamName: '深圳第一小学武术一队',
        status: 'pending',
        registrationNumber: '20250003',
        members: [
           { name: '李雷', idCard: '440301201603033456', gender: 'male', role: 'leader' },
           { name: '韩梅梅', idCard: '440301201604044567', gender: 'female', role: 'member' }
        ],
        additionalInfo: { notes: '集体项目队伍' }
      }
    ];

    // 清除该组织者在此比赛下的旧测试数据 (可选，避免重复运行堆积)
    await Participant.deleteMany({ user: orgUser._id, competition: competition._id });

    // 插入新数据
    await Participant.insertMany(testData);
    
    console.log('Successfully inserted 3 mock participants for 深圳第一小学');
    process.exit(0);
  } catch (error) {
    console.error('Error inserting mock data:', error);
    process.exit(1);
  }
};

mockParticipants();