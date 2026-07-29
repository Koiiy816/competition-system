const mongoose = require('mongoose');
const Result = require('./models/Result');

// 连接到 MongoDB (在 docker 内部)
mongoose.connect('mongodb://mongo:27017/competition-system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('数据库连接成功，开始修复历史成绩...');
  
  try {
    const results = await Result.find({});
    let updatedCount = 0;
    
    for (const res of results) {
      if (!res.details || !res.details.scores || res.details.scores.length === 0) continue;
      
      const scores = res.details.scores;
      const deduction = res.details.deduction || 0;
      
      // 过滤掉 0 和 null
      const validScores = scores.filter(s => s && s > 0);
      
      if (validScores.length === 0) continue; // 没有有效打分则跳过

      let finalScore = 0;
      if (validScores.length >= 5) {
        // 5人以上打分：去最高最低，求平均
        const sorted = [...validScores].sort((a, b) => a - b);
        const middle = sorted.slice(1, validScores.length - 1);
        const sum = middle.reduce((a, b) => a + b, 0);
        finalScore = sum / middle.length + deduction;
      } else {
        // 3人打分（或不足5人）：直接求平均
        const sum = validScores.reduce((a, b) => a + b, 0);
        finalScore = sum / validScores.length + deduction;
      }
      
      finalScore = Math.round(finalScore * 100) / 100;

      // 如果计算出来的正确分数和数据库里存的不一样，就更新它
      if (res.score !== finalScore) {
        console.log(`[修复] 发现错误分数！ID: ${res._id} | 裁判打分: [${scores.join(', ')}] | 原错分: ${res.score} => 修正为: ${finalScore}`);
        res.score = finalScore;
        await res.save();
        updatedCount++;
      }
    }
    
    console.log(`\n修复完成！共自动纠正了 ${updatedCount} 个错误的历史成绩。`);
  } catch (err) {
    console.error('修复过程中发生错误:', err);
  } finally {
    process.exit(0);
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
  process.exit(1);
});
