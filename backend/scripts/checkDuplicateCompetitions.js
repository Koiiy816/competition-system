const mongoose = require('mongoose');
const Competition = require('../models/Competition');

async function checkDuplicateCompetitions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition_system');
    console.log('Connected to MongoDB');

    const competitions = await Competition.find({}).sort({ createdAt: 1 });
    console.log(`Total competitions found: ${competitions.length}\n`);

    // 按名称分组查找重复
    const competitionsByName = {};
    competitions.forEach(comp => {
      if (!competitionsByName[comp.name]) {
        competitionsByName[comp.name] = [];
      }
      competitionsByName[comp.name].push(comp);
    });

    // 显示所有比赛信息
    console.log('All competitions:');
    competitions.forEach((comp, index) => {
      console.log(`${index + 1}. ID: ${comp._id}`);
      console.log(`   Name: ${comp.name}`);
      console.log(`   Type: ${comp.type || 'N/A'}`);
      console.log(`   Created: ${comp.createdAt}`);
      console.log(`   Updated: ${comp.updatedAt}`);
      console.log(`   Status: ${comp.status}`);
      console.log('---');
    });

    // 查找重复的比赛
    console.log('\nDuplicate competitions:');
    let duplicatesFound = false;
    for (const [name, comps] of Object.entries(competitionsByName)) {
      if (comps.length > 1) {
        duplicatesFound = true;
        console.log(`\nDuplicate found for: "${name}"`);
        comps.forEach((comp, index) => {
          console.log(`  ${index + 1}. ID: ${comp._id}`);
          console.log(`     Created: ${comp.createdAt}`);
          console.log(`     Updated: ${comp.updatedAt}`);
          console.log(`     Status: ${comp.status}`);
        });
        
        // 找到最新的比赛（按updatedAt排序）
        const latest = comps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
        const toDelete = comps.filter(comp => comp._id.toString() !== latest._id.toString());
        
        console.log(`     Latest (keep): ${latest._id} (updated: ${latest.updatedAt})`);
        console.log(`     To delete: ${toDelete.map(c => c._id).join(', ')}`);
      }
    }

    if (!duplicatesFound) {
      console.log('No duplicate competitions found.');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDuplicateCompetitions();