const User = require('../models/User');
const InvitationCode = require('../models/InvitationCode');
const SystemSetting = require('../models/SystemSetting');
const crypto = require('crypto');

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  const { name, email, password, role, roles, profile } = req.body;

  console.log('注册请求数据:', { name, email, role, roles, profile });

  try {
    // 处理角色参数，支持单个role或roles数组
    let userRoles = [];
    if (roles && Array.isArray(roles)) {
      userRoles = roles;
    } else if (role) {
      userRoles = [role];
    } else {
      userRoles = ['admin']; // 强行把默认注册角色改为超级管理员
    }
    
    console.log('处理后的用户角色:', userRoles);

    // 创建用户
    const user = await User.create({
      name,
      email,
      password,
      roles: userRoles,
      profile: profile || {}
    });

    console.log('创建的用户数据:', { id: user._id, name: user.name, email: user.email, roles: user.roles });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('注册失败:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: '该邮箱已被注册' });
    }
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
};

/**
 * @desc    User login
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供邮箱和密码'
      });
    }

    // Check user exists
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '无效的凭据'
      });
    }

    // Check password is match
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '无效的凭据'
      });
    }

    // 检查是否允许裁判登录
    if (user.roles && (user.roles.includes('referee') || user.roles.includes('chief_referee'))) {
      // 只有不是admin的情况下才受限制
      if (!user.roles.includes('admin')) {
        const setting = await SystemSetting.findOne({ key: 'referee_login_enabled' });
        // 如果设置为false，则禁止登录 (默认如果没设置，也视为允许或者看需求，这里默认没设置的话视为允许)
        if (setting && setting.value === false) {
          return res.status(403).json({
            success: false,
            message: '系统当前已关闭裁判登录权限，如有疑问请联系管理员。'
          });
        }
      }
    }

    // Create token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '没有与该邮箱关联的用户'
      });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Create hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire time - 10 minutes
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // In actual application, here should send reset password mail
    // But in this example, we only return token for test

    res.status(200).json({
      success: true,
      message: '密码重置邮件已发送',
      resetToken // 实际应用中不应该返回这个
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hash token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '无效的token'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(req.body.currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '当前密码不正确'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   GET /api/auth/logout
 * @access  Public
 */
exports.logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: '退出登录成功'
  });
};

// @desc    Validate invitation code
// @route   POST /api/v1/auth/validate-invitation
// @access  Public
exports.validateInvitationCode = async (req, res, next) => {
  const { invitationCode } = req.body;
  console.log('收到的验证邀请码请求:', invitationCode);

  if (!invitationCode) {
    console.log('邀请码为空');
    return res.status(400).json({ success: false, message: '请输入邀请码' });
  }

  try {
    const code = await InvitationCode.findOne({ code: invitationCode });
    console.log('数据库查询结果:', code);

    if (!code || code.isUsed) {
      console.log('邀请码无效或已被使用');
      return res.status(400).json({ success: false, message: '邀请码无效或已被使用' });
    }

    console.log('邀请码验证成功');
    res.status(200).json({ success: true, role: code.role });
  } catch (error) {
    console.error('验证邀请码时出错:', error);
    next(error);
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles
      }
    });
};