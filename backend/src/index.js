require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDb = require('./config/db');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const workerRoutes = require('./routes/workers');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectDb();

    const port = Number(process.env.PORT || 5000);
    server.listen(port, () => {
      logger.info('Server running', { port });
    });
    // start recovery service after server and io ready
    try {
      const { startRecoveryService } = require('./services/recoveryService');
      startRecoveryService(io);
    } catch (e) {
      logger.error('Failed to start recovery service', { message: e.message });
    }
  } catch (error) {
    logger.error('Server startup error', { message: error.message });
    process.exit(1);
  }
}

startServer();

module.exports = {
  app,
  server,
  io
};
