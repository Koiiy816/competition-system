const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const userController = require('../controllers/userController');
const { protect: auth, authorize } = require('../middlewares/authMiddleware');

// @route   GET api/users
// @desc    获取所有用户
// @access  私有/管理员、主裁
router.get('/', [auth, authorize('admin', 'chief_referee')], userController.getUsers);

// @route   GET api/users/:id
// @desc    通过ID获取用户
// @access  私有/管理员、主裁
router.get('/:id', [auth, authorize('admin', 'chief_referee')], userController.getUser);

// @route   POST api/users
// @desc    创建用户
// @access  私有/管理员、主裁
router.post(
  '/',
  [
    auth,
    authorize('admin', 'chief_referee'),
    [
      check('username', '用户名是必填项').not().isEmpty(),
      check('email', '请输入有效的邮箱地址').isEmail(),
      check('password', '请输入6个或更多字符的密码').isLength({ min: 6 }),
      check('role', '角色是必填项').not().isEmpty(),
    ],
  ],
  userController.createUser
);

// @route   PUT api/users/:id
// @desc    更新用户
// @access  私有/管理员、主裁
router.put(
  '/:id',
  [
    auth,
    authorize('admin', 'chief_referee'),
    [
      check('username', '用户名是必填项').optional().not().isEmpty(),
      check('email', '请输入有效的邮箱地址').optional().isEmail(),
      check('role', '角色是必填项').optional().not().isEmpty(),
      check('password', '请输入6个或更多字符的密码').optional().isLength({ min: 6 }),
    ],
  ],
  userController.updateUser
);

// @route   DELETE api/users/:id
// @desc    删除用户
// @access  私有/管理员、主裁
router.delete('/:id', [auth, authorize('admin', 'chief_referee')], userController.deleteUser);

module.exports = router;