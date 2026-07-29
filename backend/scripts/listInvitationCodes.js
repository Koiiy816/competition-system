const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const InvitationCode = require('../models/InvitationCode');

dotenv.config({ path: './config/.env' });

connectDB();

const listCodes = async () => {
  try {
    const codes = await InvitationCode.find({});
    if (codes.length === 0) {
      console.log('No invitation codes found.');
    } else {
      console.log('Invitation Codes:');
      codes.forEach(code => {
        console.log(`- Code: ${code.code}, Role: ${code.role}, Is Used: ${code.isUsed}, Used By: ${code.usedBy || 'N/A'}`);
      });
    }
    process.exit();
  } catch (error) {
    console.error('Error listing invitation codes:', error);
    process.exit(1);
  }
};

listCodes();