const mongoose = require('mongoose');
const Participant = require('../models/Participant');
const Result = require('../models/Result');

const apply = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition_system');

  const absenceResults = await Result.find({ 'details.absentSource': 'check_in' })
    .select('participant updatedAt')
    .lean();
  const latestAbsentAt = new Map();
  absenceResults.forEach((result) => {
    const id = String(result.participant);
    const at = result.updatedAt || new Date();
    if (!latestAbsentAt.has(id) || latestAbsentAt.get(id) < at) latestAbsentAt.set(id, at);
  });

  const updates = [...latestAbsentAt].map(([id, absentAt]) => ({
    updateOne: {
      filter: { _id: id, isVirtualTeam: { $ne: true }, checkInStatus: { $ne: 'checked' } },
      update: { $set: { isCheckedIn: false, checkInStatus: 'absent', absentAt } }
    }
  }));

  if (apply && updates.length) {
    const outcome = await Participant.bulkWrite(updates);
    console.log(`已回填 ${outcome.modifiedCount} 名缺席参赛者。`);
  } else {
    console.log(`发现 ${updates.length} 名可回填的缺席参赛者。${apply ? '' : ' 未写入；使用 --apply 执行。'}`);
  }
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
