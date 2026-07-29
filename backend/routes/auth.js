const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { protect: auth } = require('../middlewares/authMiddleware');

// @route   POST api/auth/register
// @desc    注册用户
// @access  公开
router.post(
  '/register',
  [
    check('username', '用户名是必填项').not().isEmpty(),
    check('email', '请输入有效的邮箱地址').isEmail(),
    check('password', '请输入6个或更多字符的密码').isLength({ min: 6 }),
    check('role', '角色是必填项').not().isEmpty(),
    check('invitationCode', '邀请码是必填项').not().isEmpty(),
  ],
  authController.register
);

// @route   POST api/auth/login
// @desc    认证用户并获取令牌
// @access  公开
router.post(
  '/login',
  [
    check('email', '请输入有效的邮箱地址').isEmail(),
    check('password', '密码是必填项').exists(),
  ],
  authController.login
);

// @route   GET api/auth
// @desc    获取登录用户信息
// @access  私有
router.get('/me', auth, authController.getMe);

// @route   POST api/auth/logout
// @desc    注销用户
// @access  私有
router.post('/logout', auth, authController.logout);

// @route   PUT api/auth/password
// @desc    更新用户密码
// @access  私有
router.put(
  '/password',
  [
    auth,
    [
      check('currentPassword', '当前密码是必填项').not().isEmpty(),
      check('newPassword', '请输入6个或更多字符的新密码').isLength({ min: 6 }),
    ],
  ],
  authController.updatePassword
);

// @route   POST api/auth/reset-password
// @desc    请求密码重置
// @access  公开
router.post(
  '/reset-password',
  [check('email', '请输入有效的邮箱地址').isEmail()],
  authController.forgotPassword
);

// @route   PUT api/auth/reset-password/:token
// @desc    通过令牌重置密码
// @access  公开
router.put(
  '/reset-password/:token',
  [check('newPassword', '请输入6个或更多字符的新密码').isLength({ min: 6 })],
  authController.resetPassword
);

// @route   POST api/auth/validate-invitation
// @desc    验证邀请码
// @access  公开
router.post(
  '/validate-invitation',
  authController.validateInvitationCode
);

module.exports = router;