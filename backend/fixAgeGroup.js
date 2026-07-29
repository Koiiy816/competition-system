const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/competition_system');
const Participant = require('./models/Participant');
Participant.updateMany(
  { ageGroup: 'U16组（14-16岁）' },
  { $set: { ageGroup: '男子U16组', grade: '男子U16组' } }
).then(res => {
  console.log('Fixed ageGroup:', res);
  process.exit();
});