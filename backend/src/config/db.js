const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDb() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is required.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error', { message: error.message });
    process.exit(1);
  }
}

module.exports = connectDb;
