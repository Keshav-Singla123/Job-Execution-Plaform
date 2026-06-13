const express = require('express');
const auth = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

router.use(auth);

router.post('/', jobController.submitJob);
router.get('/', jobController.getAllJobs);
router.get('/stats', jobController.getJobStats);
router.get('/:id', jobController.getJobById);
router.delete('/:id', jobController.deleteJob);
router.put('/:id/cancel', jobController.cancelJob);
router.put('/:id/retry', jobController.retryJob);

module.exports = router;
