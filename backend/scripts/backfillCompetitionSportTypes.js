require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const { normalizeSportType } = require('../utils/competitionType');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/competition-system');
  const competitions = await Competition.find({});
  const updated = [];
  const unresolved = [];

  for (const competition of competitions) {
    const sportType = normalizeSportType(competition.sportType) || normalizeSportType(competition.type);
    if (!sportType || sportType === 'other') {
      unresolved.push(competition.name);
      continue;
    }
    if (competition.sportType !== sportType) {
      competition.sportType = sportType;
      await competition.save();
      updated.push(`${competition.name} → ${sportType}`);
    }
  }

  console.log(`已补齐 ${updated.length} 场赛事类型。`);
  updated.forEach((item) => console.log(item));
  if (unresolved.length) {
    console.log(`以下 ${unresolved.length} 场赛事无法从旧类型识别，未作修改：`);
    unresolved.forEach((name) => console.log(name));
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
