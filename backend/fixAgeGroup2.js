const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/competition_system');
const Participant = require('./models/Participant');

async function fix() {
  const result = await Participant.updateMany(
    { ageGroup: /14-16岁/ },
    { $set: { ageGroup: '男子U16组', grade: '男子U16组' } }
  );
  console.log('Fixed ageGroup:', result);
  process.exit();
}
fix();