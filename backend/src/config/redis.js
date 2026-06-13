const IORedis = require('ioredis');
const logger = require('../utils/logger');

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null
});

redisConnection.on('error', (error) => {
  logger.warn('Redis connection error', { message: error.message });
});

module.exports = redisConnection;
