const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'config/.env') });
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition_system').then(async () => {
  const Schedule = require('./models/Schedule');
  const Participant = require('./models/Participant');
  const schedule = await Schedule.findOne({ name: '混合U10-U16集体 集体基本功' });
  const pIds = schedule.participants;
  const ps = await Participant.find({ _id: { $in: pIds } });
  console.log('Teams for this schedule:');
  console.log(ps.map(p => p.name + ' - ' + p.schoolName));
  process.exit(0);
});