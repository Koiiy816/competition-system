const express = require('express');
const router = express.Router({ mergeParams: true });
const { check } = require('express-validator');
const participantController = require('../controllers/participantController');
const { protect: auth, authorize } = require('../middlewares/authMiddleware');
const { uploadParticipantPhoto } = require('../middlewares/uploadMiddleware');

// @route   GET api/competitions/all/participants/me
// @desc    获取当前用户的所有参赛记录（不区分比赛）
// @access  私有/所有已登录用户
router.get(
  '/all/me',
  auth,
  participantController.getMyParticipations
);

// @route   GET api/competitions/:competitionId/participants
// @desc    获取比赛的所有参赛者
// @access  私有/管理员、参赛单位或裁判
router.get(
  '/',
  auth, authorize('admin', 'organization', 'referee', 'chief_referee', 'checkin_clerk'),
  participantController.getParticipants
);

// @route   GET api/competitions/:competitionId/participants/public
// @desc    获取比赛的所有参赛者（公开信息，参赛者和观众可查看）
// @access  私有/所有角色均可
router.get(
  '/public',
  auth, authorize('admin', 'organization', 'referee', 'chief_referee', 'checkin_clerk'),
  participantController.getParticipants
);

// @route   GET api/competitions/:competitionId/participants/me
// @desc    获取当前用户的所有参赛记录
// @access  私有/所有已登录用户
router.get(
  '/me',
  auth,
  participantController.getMyParticipations
);

router.put(
  '/:id/diving-plan',
  auth,
  authorize('admin', 'chief_referee', 'organization'),
  participantController.saveDivingPlan
);

// @route   GET api/competitions/:competitionId/participants/export-photos
router.get('/export-photos', auth, authorize('admin', 'chief_referee'), participantController.exportParticipantsWithPhotos);

// @route   GET api/competitions/:competitionId/participants/:id/photo
router.get('/:id/photo', auth, authorize('admin', 'chief_referee'), participantController.getParticipantPhoto);

// @route   POST api/competitions/:competitionId/participants/import
// @desc    导入参赛者
// @access  私有/管理员、主裁
router.post(
  '/import',
  auth, authorize('admin', 'chief_referee'),
  participantController.importParticipants
);

// @route   GET api/competitions/:competitionId/participants/export-school
// @desc    按单位导出参赛者
// @access  私有/管理员、主裁
router.get(
  '/export-school',
  auth, authorize('admin', 'chief_referee'),
  participantController.exportParticipantsBySchool
);

// @route   GET api/competitions/:competitionId/participants/export
// @desc    导出参赛者
// @access  私有/管理员、主裁
router.get(
  '/export',
  auth, authorize('admin', 'chief_referee'),
  participantController.exportParticipants
);

// @route   POST api/competitions/:competitionId/participants
// @desc    创建新的参赛者
// @access  私有/管理员、参赛单位可以自己报名
router.post(
  '/',
  [
    auth,
    authorize('admin', 'chief_referee', 'organization'), // 允许管理员、主裁和参赛单位报名
    uploadParticipantPhoto, // 添加文件上传中间件
    [
      check('name', '姓名是必填项').not().isEmpty(),
      // 身份证改为非强制，在 Model 层面控制 (虚拟队伍/测试人员不需要)
      check('idCard').optional(),
    ],
  ],
  participantController.createParticipant
);

// @route   PUT api/competitions/:competitionId/participants/approve-all
// @desc    批量通过指定比赛的所有待审核参赛者 (一键通过)
// @access  私有/管理员、主裁
router.put(
  '/approve-all',
  auth, authorize('admin', 'chief_referee'),
  participantController.bulkApproveParticipants
);

// @route   PUT api/competitions/:competitionId/participants/:id
// @desc    更新参赛者
// @access  私有/管理员、主裁
router.put(
  '/:id',
  [
    auth,
    authorize('admin', 'chief_referee'),
    uploadParticipantPhoto,
    [
      check('name', '姓名是必填项').optional().not().isEmpty(),
      check('idCard', '身份证号是必填项').optional().not().isEmpty(),
    ],
  ],
  participantController.updateParticipant
);

// @route   PUT api/competitions/:competitionId/participants/:id/check-in
// @desc    更新参赛者检录状态
// @access  私有/管理员、主裁、检录员
router.put(
  '/:id/check-in',
  auth, authorize('admin', 'chief_referee', 'checkin_clerk'),
  participantController.updateParticipantCheckInStatus
);

// @route   PUT api/competitions/:competitionId/participants/:id/approve
// @desc    审核通过参赛者
// @access  私有/管理员、主裁
router.put(
  '/:id/approve',
  auth, authorize('admin', 'chief_referee'),
  participantController.approveParticipant
);

// @route   PUT api/competitions/:competitionId/participants/:id/reject
// @desc    拒绝参赛者
// @access  私有/管理员、主裁
router.put(
  '/:id/reject',
  auth, authorize('admin', 'chief_referee'),
  participantController.rejectParticipant
);

// @route   DELETE api/competitions/:competitionId/participants/:id
// @desc    删除参赛者
// @access  私有/管理员、主裁、参赛单位(仅限自己的)
router.delete(
  '/:id',
  auth, authorize('admin', 'chief_referee', 'organization'),
  participantController.deleteParticipant
);

// @route   GET api/competitions/:competitionId/participants/:id/download-form
// @desc    下载参赛者报名表
// @access  私有/管理员、主裁、参赛单位
router.get(
  '/:id/download-form',
  auth, authorize('admin', 'chief_referee', 'organization'),
  participantController.downloadRegistrationForm
);

// @route   GET api/competitions/:competitionId/participants/:id
// @desc    通过ID获取单个参赛者
// @access  私有/管理员、参赛单位或裁判
router.get(
  '/:id',
  auth, authorize('admin', 'organization', 'referee', 'chief_referee', 'checkin_clerk'),
  participantController.getParticipant
);

// @route   DELETE api/competitions/:competitionId/participants
// @desc    批量删除指定比赛的参赛者 (一键清空)
// @access  私有/管理员、主裁
router.delete(
  '/',
  auth, authorize('admin', 'chief_referee'),
  participantController.bulkDeleteParticipants
);

module.exports = router;
