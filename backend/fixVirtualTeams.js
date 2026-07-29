const mongoose = require('mongoose');
const Schedule = require('./models/Schedule');
const Participant = require('./models/Participant');
const dotenv = require('dotenv');

dotenv.config();

async function fixVirtualTeams() {
  try {
    await mongoose.connect('mongodb://localhost:27017/competition-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');

    // 清除旧的虚拟队伍和相关赛程
    const deletedParticipants = await Participant.deleteMany({ isVirtualTeam: true });
    console.log(`Deleted ${deletedParticipants.deletedCount} old virtual team participants.`);

    // 提示用户去前台重新生成
    console.log('Cleanup completed! Please click "Generate Start List" in frontend to rebuild the schedules with the new virtual team logic.');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixVirtualTeams();
