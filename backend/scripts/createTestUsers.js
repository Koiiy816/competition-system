const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../config/.env') });

// Connect to DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/competition-system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const createTestUsers = async () => {
  try {
    // Delete existing users with these emails to avoid duplicates
    const emails = [
      'admin@test.com',
      'chief@test.com',
      'referee1@test.com',
      'school1@test.com',
      'school2@test.com'
    ];
    await User.deleteMany({ email: { $in: emails } });

    const users = [
      {
        name: '系统管理员',
        email: 'admin@test.com',
        password: 'password123',
        roles: ['admin']
      },
      {
        name: '张三主裁',
        email: 'chief@test.com',
        password: 'password123',
        roles: ['chief_referee']
      },
      {
        name: '李四裁判',
        email: 'referee1@test.com',
        password: 'password123',
        roles: ['referee']
      },
      {
        name: '深圳第一小学',
        email: 'school1@test.com',
        password: 'password123',
        roles: ['organization'],
        profile: {
          organization: '深圳第一小学',
          contactPerson: '王老师',
          phone: '13800000001'
        }
      },
      {
        name: '飞龙武术馆',
        email: 'school2@test.com',
        password: 'password123',
        roles: ['organization'],
        profile: {
          organization: '飞龙武术馆',
          contactPerson: '赵教练',
          phone: '13800000002'
        }
      }
    ];

    for (const user of users) {
      const createdUser = await User.create(user);
      console.log(`Created user: ${createdUser.name} (${createdUser.email}) - Roles: ${createdUser.roles.join(', ')}`);
    }

    console.log('All test users created successfully!');
    process.exit();
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
};

createTestUsers();