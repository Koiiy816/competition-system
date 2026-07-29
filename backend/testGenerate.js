const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { generateStartList } = require('./controllers/scheduleController');

dotenv.config({ path: path.join(__dirname, 'config/.env') });

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition_system').then(async () => {
  const req = {
    params: { competitionId: '6a0c98dde40d529362b64520' },
    user: { id: 'some-id', roles: ['admin'] }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => {
        const groupSchedules = data.data.filter(s => s.name.includes('混合'));
        console.log('Mixed Schedules generated:', groupSchedules.map(s => s.name));
        process.exit(0);
      }
    })
  };
  
  const next = (err) => {
    console.error('Error:', err);
    process.exit(1);
  };
  
  await generateStartList(req, res, next);
});