const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });
const mongoose = require('mongoose');
const Competition = require('../models/Competition');

async function listCompetitions() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const competitions = await Competition.find().sort({ createdAt: -1 });

    console.log(`Found ${competitions.length} competitions:`);
    competitions.forEach((comp, index) => {
      console.log(`${index + 1}. ID: ${comp._id}`);
      console.log(`   Name: ${comp.name}`);
      console.log(`   Status: ${comp.status}`); // Added status
      console.log(`   Created At: ${comp.createdAt}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

listCompetitions();



