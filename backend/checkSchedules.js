const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'config/.env') });
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition_system').then(async () => {
  const Schedule = require('./models/Schedule');
  const schedules = await Schedule.find({ name: /集体/ });
  console.log('Schedules with 集体:', schedules.map(s => s.name));
  
  const Participant = require('./models/Participant');
  const participants = await Participant.find({ event: /集体/ });
  console.log('Participants with 集体:', participants.length);
  
  process.exit(0);
});