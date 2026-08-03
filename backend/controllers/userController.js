const User = require('../models/User');

/**
 * @desc    获取所有用户
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取单个用户
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的用户`
      });
    }

  // 检查权限：只有管理员、主裁或用户本人可以访问
  if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('chief_referee') && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限查看此用户信息'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    创建用户
 * @route   POST /api/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新用户
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的用户`
      });
    }

    // 手动更新字段以确保 pre-save 钩子(用于密码加密)生效
    const { name, email, roles, password, phone } = req.body;
    
    if (name) user.name = name;
    if (email) user.email = email;
    if (roles) user.roles = roles;
    if (typeof phone === 'string') {
      user.profile = { ...(user.profile || {}), phone: phone.trim() };
    }
    
    // 如果管理员填写了新密码，则更新密码
    if (password && password.trim().length > 0) {
      user.password = password;
    }

    await user.save();

    // 重新获取用户以去除密码字段等（可选，不过直接返回保存后的即可，因为select: false）
    const updatedUser = await User.findById(req.params.id);

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    删除用户
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的用户`
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新个人资料
 * @route   PUT /api/users/profile/update
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    // 不允许通过此路由更新密码和角色
    const { password, role, ...updateData } = req.body;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};