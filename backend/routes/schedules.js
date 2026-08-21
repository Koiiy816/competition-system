const express = require('express');
const router = express.Router({ mergeParams: true });
const { check } = require('express-validator');
const scheduleController = require('../controllers/scheduleController');
const { protect: auth, authorize } = require('../middlewares/authMiddleware');

// @route   GET api/competitions/:competitionId/schedules
// @desc    获取比赛的所有赛程
// @access  私有/管理员、参赛单位或裁判
router.get(
  '/',
  auth, authorize('admin', 'organization', 'referee', 'chief_referee', 'checkin_clerk'),
  scheduleController.getSchedules
);

// @route   GET api/competitions/:competitionId/schedules/public
// @desc    获取比赛的所有赛程（公开信息，所有人可查看）
// @access  私有/所有角色均可
router.get(
  '/public',
  auth, authorize('admin', 'organization', 'referee', 'chief_referee', 'spectator', 'checkin_clerk'),
  scheduleController.getSchedules
);

// @route   GET api/competitions/:competitionId/schedules/group-preview
// @desc    预览人工项目分组（不创建赛程）
router.get(
  '/group-preview',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.previewGroups
);

// Excel 日程先预览匹配结果，管理员确认后才会创建赛程。
router.post('/excel-preview', auth, authorize('admin', 'chief_referee'), scheduleController.previewExcelScheduleImport);
router.post('/import-excel', auth, authorize('admin', 'chief_referee'), scheduleController.importExcelSchedule);

// @route   PUT api/competitions/:competitionId/schedules/bulk/order
// @desc    批量更新赛程排序
// @access  私有/管理员、主裁
router.put(
  '/bulk/order',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.updateSchedulesOrder
);

// @route   GET api/competitions/:competitionId/schedules/:id
// @desc    通过ID获取单个赛程
// @access  私有/管理员、参赛单位或裁判
router.get(
  '/:id',
  auth, authorize('admin', 'organization', 'referee', 'chief_referee', 'checkin_clerk'),
  scheduleController.getSchedule
);

// @route   POST api/competitions/:competitionId/schedules/generate-start-list
// @desc    自动生成赛程（出场顺序）
// @access  私有/管理员、主裁
router.post(
  '/generate-start-list',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.generateStartList
);

// @route   POST api/competitions/:competitionId/schedules/sync-new
// @desc    一键同步新参赛者到现有赛程
// @access  私有/管理员、主裁
router.post(
  '/sync-new',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.syncNewParticipants
);

// @route   POST api/competitions/:competitionId/schedules
// @desc    创建赛程
// @access  私有/管理员、主裁
router.post(
  '/',
  [
    auth,
    authorize('admin', 'chief_referee'),
    [
      check('name', '赛程名称是必填项').not().isEmpty(),
      check('startTime', '开始时间是必填项').isISO8601().toDate(),
    ],
  ],
  scheduleController.createSchedule
);

// @route   PUT api/competitions/:competitionId/schedules/:id
// @desc    更新赛程
// @access  私有/管理员、主裁
router.put(
  '/:id',
  [
    auth,
    authorize('admin', 'chief_referee'),
    [
      check('name', '赛程名称是必填项').optional().not().isEmpty(),
      check('startTime', '开始时间必须是有效日期').optional().isISO8601().toDate(),
    ],
  ],
  scheduleController.updateSchedule
);

// @route   DELETE api/competitions/:competitionId/schedules
// @desc    清空比赛的所有赛程
// @access  私有/管理员、主裁
router.delete(
  '/',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.clearAllSchedules
);

// @route   DELETE api/competitions/:competitionId/schedules/:id
// @desc    删除赛程
// @access  私有/管理员、主裁
router.delete(
  '/:id',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.deleteSchedule
);

// @route   PUT api/competitions/:competitionId/schedules/:id/status
// @desc    更新赛程状态
// @access  私有/管理员、主裁或裁判
router.put(
  '/:id/status',
  auth, authorize('admin', 'chief_referee', 'referee'),
  scheduleController.updateScheduleStatus
);

// @route   POST api/competitions/:competitionId/schedules/:id/randomize
// @desc    随机排序参赛者
// @access  私有/管理员、主裁
router.post(
  '/:id/randomize',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.randomizeParticipants
);

// @route   POST api/competitions/:competitionId/schedules/:id/append-new
// @desc    追加新参赛者到赛程
// @access  私有/管理员、主裁
router.post(
  '/:id/append-new',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.appendNewParticipants
);

// @route   GET api/competitions/:competitionId/schedules/:id/available-participants
// @desc    获取可手动加入当前赛程的已报名选手
// @access  私有/管理员、主裁
router.get(
  '/:id/available-participants',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.getAvailableParticipants
);

// @route   POST api/competitions/:competitionId/schedules/:id/participants
// @desc    手动把已报名选手加入当前赛程
// @access  私有/管理员、主裁
router.post(
  '/:id/participants',
  auth, authorize('admin', 'chief_referee'),
  scheduleController.addParticipantsToSchedule
);
module.exports = router;
