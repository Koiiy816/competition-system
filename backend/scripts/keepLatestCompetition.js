const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });
const mongoose = require('mongoose');
const Competition = require('../models/Competition');

async function keepLatestCompetition() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all competitions sorted by creation date (newest first)
    const competitions = await Competition.find().sort({ createdAt: -1 });

    if (competitions.length === 0) {
      console.log('No competitions found.');
      return;
    }

    if (competitions.length === 1) {
      console.log('Only one competition exists. Nothing to delete.');
      return;
    }

    const latestCompetition = competitions[0];
    const competitionsToDelete = competitions.slice(1);

    console.log(`Keeping latest competition:`);
    console.log(`ID: ${latestCompetition._id}`);
    console.log(`Name: ${latestCompetition.name}`);
    console.log(`Created At: ${latestCompetition.createdAt}`);
    console.log('---');

    console.log(`Deleting ${competitionsToDelete.length} older competitions...`);

    for (const comp of competitionsToDelete) {
      await Competition.findByIdAndDelete(comp._id);
      console.log(`Deleted competition: ${comp._id} (${comp.name})`);
    }

    console.log('Cleanup completed successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

keepLatestCompetition();
