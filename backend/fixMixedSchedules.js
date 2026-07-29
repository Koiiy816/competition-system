const mongoose = require('mongoose');
const Schedule = require('./models/Schedule');

mongoose.connect('mongodb://localhost:27017/competition_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('MongoDB Connected');

  // Find all schedules that might be the old separated mixed ones
  const oldSchedules = await Schedule.find({
    name: { $regex: /混合.*(男子|女子)/ }
  });

  console.log(`Found ${oldSchedules.length} old mixed schedules to delete.`);
  
  for (const schedule of oldSchedules) {
    console.log(`Deleting: ${schedule.name}`);
    await Schedule.findByIdAndDelete(schedule._id);
  }

  console.log('Cleanup completed!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});