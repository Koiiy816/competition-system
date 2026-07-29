const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const User = require('../models/User');

async function listCompetitions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    const competitions = await Competition.find({}).populate('organizer', 'name email');
    
    console.log(`找到 ${competitions.length} 个比赛:`);
    
    competitions.forEach((comp, index) => {
      console.log(`\n${index + 1}. ${comp.name}`);
      console.log(`   ID: ${comp._id}`);
      console.log(`   描述: ${comp.description}`);
      console.log(`   类型: ${comp.type}`);
      console.log(`   状态: ${comp.status}`);
      console.log(`   开始时间: ${comp.startDate}`);
      console.log(`   结束时间: ${comp.endDate}`);
      console.log(`   报名截止: ${comp.registrationDeadline}`);
      console.log(`   地点: ${comp.location}`);
      console.log(`   组织者: ${comp.organizer ? comp.organizer.name : '未知'}`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listCompetitions();