const express = require('express');
const auth = require('../middleware/auth');
// Worker routes are internal and should not require JWT/worker secret
const workerController = require('../controllers/workerController');

const router = express.Router();

router.post('/register', workerController.registerWorker);
router.post('/heartbeat', workerController.heartbeat);
router.get('/', auth, workerController.getAllWorkers);
router.post('/complete', workerController.workerJobComplete);
router.post('/failed', workerController.workerJobFailed);

module.exports = router;
