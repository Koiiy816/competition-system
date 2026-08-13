const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/awardController');
const { protect: auth, authorize } = require('../middlewares/authMiddleware');

router.get('/', [auth, authorize('admin', 'chief_referee')], controller.getAwards);
router.put('/confirmation', [auth, authorize('admin', 'chief_referee')], controller.updateAwardConfirmation);

module.exports = router;
