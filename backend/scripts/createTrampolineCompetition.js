const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const User = require('../models/User');
const { buildTrampolineCompetition } = require('../data/trampoline2026');

async function main() {
  // 此脚本只创建本地赛事，防止误操作远端数据库。
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/competition_system';
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri)) throw new Error('只允许在本地数据库创建示例赛事');
  await mongoose.connect(uri);
  try {
    const admin = await User.findOne({ roles: 'admin' });
    if (!admin) throw new Error('未找到管理员，请先完成本地管理员初始化');
    const data = buildTrampolineCompetition(admin._id);
    const existing = await Competition.findOne({ name: data.name, sportType: 'trampoline' });
    const competition = existing || await Competition.create(data);
    console.log(JSON.stringify({ created: !existing, id: competition.id, name: competition.name, events: competition.events.length }));
  } finally { await mongoose.disconnect(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
