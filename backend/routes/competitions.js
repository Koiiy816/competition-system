const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const competitionController = require('../controllers/competitionController');
const { protect: auth, optionalAuth, authorize } = require('../middlewares/authMiddleware');
const { uploadRegistrationForm } = require('../middlewares/uploadMiddleware');

// 重新导入嵌套路由
const scheduleRoutes = require('./schedules');
const resultRoutes = require('./results');
const participantRoutes = require('./participants');
const templateRoutes = require('./templates');
const awardRoutes = require('./awards');

// 使用嵌套路由
router.use('/:competitionId/schedules', scheduleRoutes);
router.use('/:competitionId/results', resultRoutes);
router.use('/:competitionId/participants', participantRoutes);
router.use('/:competitionId/templates', templateRoutes);
router.use('/:competitionId/awards', awardRoutes);

// @route   GET api/competitions
// @desc    获取所有比赛
// @access  公开
router.get('/', optionalAuth, competitionController.getCompetitions);

// @route   GET api/competitions/statuses
// @desc    获取比赛状态列表
// @access  公开
router.get('/statuses', competitionController.getCompetitionStatuses);

// @route   GET api/competitions/:id
// @desc    通过ID获取单个比赛
// @access  公开
// @route   GET api/competitions/my-competitions
// @desc    获取当前用户参加的比赛
// @access  私有
router.get('/my-competitions', auth, competitionController.getUserCompetitions);

// @route   GET api/competitions/:id
// @desc    通过ID获取单个比赛
// @access  公开
router.get('/:id', optionalAuth, competitionController.getCompetition);

// @route   GET api/competitions/:id/public-details
// @desc    获取比赛详细信息（公开，所有人可见）
// @access  私有/所有角色均可
router.get('/:id/public-details', auth, authorize('admin', 'organization', 'chief_referee', 'referee', 'spectator', 'checkin_clerk'), competitionController.getCompetition);

// @route   POST api/competitions
// @desc    创建比赛
// @access  私有/管理员
router.post(
  '/',
  [
    auth,
    authorize(['admin']),
    uploadRegistrationForm, // 添加文件上传中间件
    [
      check('name', '比赛名称是必填项').not().isEmpty(),
      check('description', '比赛描述是必填项').not().isEmpty(),
      check('startTime', '开始时间是必填项').isISO8601().toDate(),
      check('endTime', '结束时间是必填项').isISO8601().toDate(),
      check('location', '比赛地点是必填项').not().isEmpty(),
    ],
  ],
  competitionController.createCompetition
);

// @route   PUT api/competitions/:id
// @desc    更新比赛信息
// @access  私有/管理员
router.put(
  '/:id',
  [
    auth,
    authorize(['admin']),
    uploadRegistrationForm, // 添加文件上传中间件以解析 FormData
    [
      check('name', '比赛名称是必填项').optional().not().isEmpty(),
      check('description', '比赛描述是必填项').optional().not().isEmpty(),
      check('startTime', '开始时间必须是有效日期').optional().isISO8601().toDate(),
      check('endTime', '结束时间必须是有效日期').optional().isISO8601().toDate(),
      check('location', '比赛地点是必填项').optional().not().isEmpty(),
    ],
  ],
  competitionController.updateCompetition
);

// @route   DELETE api/competitions/:id
// @desc    删除比赛
// @access  私有/管理员
router.delete(
  '/:id',
  [auth, authorize(['admin'])],
  competitionController.deleteCompetition
);

// @route   POST api/competitions/:id/register
// @desc    报名参加比赛
// @access  私有
router.post(
  '/:id/register',
  [
    auth,
    [
      check('type', '参赛类型是必填项').isIn(['individual', 'team']),
      check('gender', '性别是必填项').isIn(['male', 'female']),
      check('idCard', '证件号码是必填项').not().isEmpty(),
      check('phone', '联系电话是必填项').not().isEmpty(),
      check('insuranceConfirmed', '必须确认已办理保险').equals('true').toBoolean(),
    ],
  ],
  competitionController.registerCompetition
);

// @route   GET api/competitions/:id/registration-form
// @desc    下载比赛报名表文件
// @access  公开
router.get('/:id/registration-form', competitionController.downloadRegistrationForm);

// @route   PUT api/competitions/:id/status
// @desc    更新比赛状态
// @access  私有/管理员
router.put(
  '/:id/status',
  [
    auth,
    authorize(['admin']),
    [
      check('status', '状态是必填项').isIn(['draft', 'published', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled']),
      check('reason', '状态变更原因').optional().isLength({ min: 1, max: 500 })
    ]
  ],
  competitionController.updateCompetitionStatus
);

// @route   PUT api/competitions/:id/scoring-rules
// @desc    更新比赛评分规则
// @access  私有/管理员、组织者
router.put(
  '/:id/scoring-rules',
  [
    auth,
    authorize(['admin', 'organizer'])
  ],
  competitionController.updateScoringRules
);

// @route   PUT api/competitions/:id/registration-rules
// @desc    更新比赛报名规则
// @access  私有/管理员、组织者
router.put(
  '/:id/registration-rules',
  [
    auth,
    authorize(['admin', 'organizer'])
  ],
  competitionController.updateRegistrationRules
);

module.exports = router;
