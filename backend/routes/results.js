const express = require('express');
const router = express.Router({ mergeParams: true });
const { check } = require('express-validator');
const resultController = require('../controllers/resultController');
const { protect: auth, authorize } = require('../middlewares/authMiddleware');

// @route   GET api/competitions/:competitionId/results
// @desc    获取比赛的所有成绩
// @access  私有/管理员、主裁或裁判
router.get(
  '/',
  [auth, authorize('admin', 'chief_referee', 'referee')],
  resultController.getResults
);

// @route   GET api/competitions/:competitionId/results/public
// @desc    获取比赛的公开成绩
// @access  私有/所有角色均可
router.get(
  '/public',
  [auth, authorize('admin', 'organization', 'chief_referee', 'referee', 'spectator')],
  resultController.getResults
);

// @route   GET api/competitions/:competitionId/results/:id
// @desc    获取单条成绩详情
// @access  私有/管理员、主裁或裁判
router.get(
  '/:id',
  [auth, authorize('admin', 'chief_referee', 'referee')],
  resultController.getResult
);

// @route   POST api/competitions/:competitionId/results
// @desc    创建成绩
// @access  私有/管理员、主裁或裁判
router.post(
  '/',
  [
    auth,
    authorize('admin', 'chief_referee', 'referee'),
    [
      check('schedule', '赛程ID是必填项').not().isEmpty(),
      check('participant', '参赛者ID是必填项').not().isEmpty(),
      check('score', '分数是必填项').not().isEmpty(),
    ]
  ],
  resultController.createResult
);


// @route   POST api/competitions/:competitionId/results/submit-diving
// @desc    Submit diving scores by action
router.post(
  '/submit-diving',
  [
    auth,
    authorize('admin', 'chief_referee', 'referee'),
    [
      check('scheduleId', 'Schedule ID is required').not().isEmpty(),
      check('participantId', 'Participant ID is required').not().isEmpty(),
      check('dives', 'Diving scores are required').isArray()
    ]
  ],
  resultController.submitDivingScore
);

// @route   POST api/competitions/:competitionId/results/submit
// @desc    提交成绩
// @access  私有/管理员、主裁或裁判
router.post(
  '/submit',
  [
    auth,
    authorize('admin', 'chief_referee', 'referee'),
    [
      check('scheduleId', '赛程ID是必填项').not().isEmpty(),
      check('participantId', '参赛者ID是必填项').not().isEmpty(),
      check('scores', '分数是必填项').not().isEmpty(),
    ]
  ],
  resultController.submitScore
);

// @route   PUT api/competitions/:competitionId/results/:id
// @desc    更新成绩
// @access  私有/管理员、主裁或裁判
router.put(
  '/:id',
  [
    auth,
    authorize('admin', 'chief_referee', 'referee'),
    [
      check('score', '分数是必填项').optional().not().isEmpty(),
    ]
  ],
  resultController.updateResult
);

// @route   DELETE api/competitions/:competitionId/results/:id
// @desc    删除成绩
// @access  私有/管理员、主裁
router.delete(
  '/:id',
  [auth, authorize('admin', 'chief_referee')],
  resultController.deleteResult
);

// @route   POST api/competitions/:competitionId/results/:id/dispute
// @desc    对成绩提出异议
// @access  私有/参赛单位
router.post(
  '/:id/dispute',
  [auth, authorize('admin', 'chief_referee', 'organization')],
  resultController.disputeResult
);

// @route   POST api/competitions/:competitionId/results/import
// @desc    导入成绩
// @access  私有/管理员、主裁
router.post(
  '/import',
  [auth, authorize('admin', 'chief_referee')],
  resultController.importResults
);

// @route   GET api/competitions/:competitionId/results/export
// @desc    导出成绩
// @access  私有/管理员、主裁
router.get(
  '/export',
  [auth, authorize('admin', 'chief_referee')],
  resultController.exportResults
);

module.exports = router;