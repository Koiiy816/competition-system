const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });
const mongoose = require('mongoose');
const Competition = require('../models/Competition');

async function publishLatestCompetition() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const competitions = await Competition.find().sort({ createdAt: -1 });

    if (competitions.length === 0) {
      console.log('No competitions found.');
      return;
    }

    const latestCompetition = competitions[0];
    latestCompetition.status = 'registration';
    await latestCompetition.save();

    console.log(`Updated competition status to 'registration':`);
    console.log(`ID: ${latestCompetition._id}`);
    console.log(`Name: ${latestCompetition.name}`);
    console.log(`Status: ${latestCompetition.status}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

publishLatestCompetition();
