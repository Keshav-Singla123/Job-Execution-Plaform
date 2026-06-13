function workerAuth(req, res, next) {
  try {
    const sharedSecret = process.env.WORKER_API_KEY;
    const requestSecret = req.headers['x-worker-secret'];

    if (sharedSecret && requestSecret === sharedSecret) {
      req.workerAuth = true;
      next();
      return;
    }

    res.status(401).json({ success: false, message: 'Worker authorization is required' });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Worker authorization failed' });
  }
}

module.exports = workerAuth;