const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const Schedule = require('../models/Schedule');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: '../config/.env' });

// 连接数据库
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition-system');
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
};

// 生成赛程数据
const generateScheduleData = async () => {
  try {
    await connectDB();

    // 获取所有比赛
    const competitions = await Competition.find({});
    console.log(`找到 ${competitions.length} 个比赛`);

    if (competitions.length === 0) {
      console.log('没有找到比赛，请先创建比赛');
      process.exit(0);
    }

    // 为每个比赛生成赛程
    for (const competition of competitions) {
      console.log(`为比赛 "${competition.name}" 生成赛程...`);

      // 检查是否已有赛程
      const existingSchedules = await Schedule.find({ competition: competition._id });
      if (existingSchedules.length > 0) {
        console.log(`比赛 "${competition.name}" 已有 ${existingSchedules.length} 个赛程，跳过`);
        continue;
      }

      // 生成示例赛程数据
      const schedules = [];
      const startDate = new Date(competition.startDate);
      const endDate = new Date(competition.endDate);
      
      // 计算比赛天数
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const totalDays = Math.max(1, daysDiff);

      // 根据比赛类型生成不同的赛程
      const competitionType = competition.type || 'sports';
      
      if (competitionType === 'sports') {
        // 体育比赛赛程
        const events = [
          '男子100米预赛',
          '女子100米预赛', 
          '男子200米预赛',
          '女子200米预赛',
          '男子100米决赛',
          '女子100米决赛',
          '男子200米决赛',
          '女子200米决赛',
          '男子4x100米接力',
          '女子4x100米接力'
        ];

        for (let day = 0; day < totalDays; day++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + day);
          
          // 每天安排3-4个项目
          const eventsPerDay = Math.min(4, Math.ceil(events.length / totalDays));
          const startIndex = day * eventsPerDay;
          const dayEvents = events.slice(startIndex, startIndex + eventsPerDay);

          for (let i = 0; i < dayEvents.length; i++) {
            const eventTime = new Date(currentDate);
            eventTime.setHours(9 + i * 2, 0, 0, 0); // 每2小时一个项目

            schedules.push({
              competition: competition._id,
              name: dayEvents[i],
              startTime: eventTime,
              endTime: new Date(eventTime.getTime() + 90 * 60 * 1000), // 1.5小时
              location: competition.location || '主体育场',
              description: `${dayEvents[i]} - 第${day + 1}天`,
              status: day === 0 ? 'ongoing' : 'scheduled',
              type: dayEvents[i].includes('决赛') ? 'final' : (dayEvents[i].includes('预赛') ? 'preliminary' : 'other')
            });
          }
        }
      } else if (competitionType === 'academic') {
        // 学术竞赛赛程
        const rounds = ['初赛', '复赛', '半决赛', '决赛'];
        
        for (let i = 0; i < rounds.length && i < totalDays; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          currentDate.setHours(14, 0, 0, 0); // 下午2点开始

          schedules.push({
            competition: competition._id,
            name: rounds[i],
            startTime: currentDate,
            endTime: new Date(currentDate.getTime() + 3 * 60 * 60 * 1000), // 3小时
            location: competition.location || '学术报告厅',
            description: `${competition.name} - ${rounds[i]}`,
            status: i === 0 ? 'ongoing' : 'scheduled',
            type: rounds[i] === '决赛' ? 'final' : (rounds[i] === '半决赛' ? 'semifinal' : (rounds[i] === '复赛' ? 'quarterfinal' : 'preliminary'))
          });
        }
      } else {
        // 默认赛程
        const defaultEvents = ['开幕式', '预赛', '半决赛', '决赛', '闭幕式'];
        
        for (let i = 0; i < Math.min(defaultEvents.length, totalDays); i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          currentDate.setHours(10, 0, 0, 0);

          schedules.push({
            competition: competition._id,
            name: defaultEvents[i],
            startTime: currentDate,
            endTime: new Date(currentDate.getTime() + 2 * 60 * 60 * 1000), // 2小时
            location: competition.location || '比赛场地',
            description: `${competition.name} - ${defaultEvents[i]}`,
            status: i === 0 ? 'ongoing' : 'scheduled',
            type: defaultEvents[i] === '决赛' ? 'final' : (defaultEvents[i] === '半决赛' ? 'semifinal' : 'other')
          });
        }
      }

      // 批量插入赛程
      if (schedules.length > 0) {
        await Schedule.insertMany(schedules);
        console.log(`为比赛 "${competition.name}" 生成了 ${schedules.length} 个赛程项目`);
      }
    }

    console.log('赛程生成完成！');
    
    // 显示生成的赛程统计
    const totalSchedules = await Schedule.countDocuments();
    console.log(`\n总共生成了 ${totalSchedules} 个赛程项目`);
    
    // 显示每个比赛的赛程数量
    for (const competition of competitions) {
      const count = await Schedule.countDocuments({ competition: competition._id });
      console.log(`- ${competition.name}: ${count} 个赛程项目`);
    }

  } catch (error) {
    console.error('生成赛程时出错:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

// 运行脚本
generateScheduleData();