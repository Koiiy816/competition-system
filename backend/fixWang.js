const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/competition_system');
const Participant = require('./models/Participant');

async function fixWang() {
  const result = await Participant.updateMany(
    { name: '王泽铭' },
    { $set: { ageGroup: '男子U16组', grade: '男子U16组' } }
  );
  console.log('Fixed Wang:', result);
  process.exit();
}
fixWang();