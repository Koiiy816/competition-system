const mongoose = require('mongoose');
const Competition = require('../models/Competition');

async function deleteCompetition() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // 删除春季编程大赛
    const result = await Competition.deleteOne({ name: '春季编程大赛' });
    
    if (result.deletedCount > 0) {
      console.log('春季编程大赛已删除');
    } else {
      console.log('未找到春季编程大赛');
    }
    
    // 显示剩余的比赛
    const remainingCompetitions = await Competition.find({});
    console.log(`\n剩余比赛数量: ${remainingCompetitions.length}`);
    
    remainingCompetitions.forEach((comp, index) => {
      console.log(`${index + 1}. ${comp.name} (${comp.type})`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteCompetition();