import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  CheckCircle as CompleteIcon,
  Schedule as ScheduleIcon,
  Group as ParticipantsIcon,
  EmojiEvents as ResultsIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

// 比赛状态定义
const COMPETITION_STATES = {
  DRAFT: {
    key: 'draft',
    label: '草稿',
    color: 'default',
    description: '比赛正在创建中，尚未发布',
    allowedActions: ['edit', 'publish', 'delete'],
    nextStates: ['registration_open']
  },
  REGISTRATION_OPEN: {
    key: 'registration_open',
    label: '报名中',
    color: 'primary',
    description: '比赛已发布，接受参赛报名',
    allowedActions: ['edit', 'close_registration', 'view_participants'],
    nextStates: ['registration_closed', 'cancelled']
  },
  REGISTRATION_CLOSED: {
    key: 'registration_closed',
    label: '报名截止',
    color: 'warning',
    description: '报名已截止，准备开始比赛',
    allowedActions: ['start_competition', 'reopen_registration', 'view_participants'],
    nextStates: ['in_progress', 'registration_open']
  },
  IN_PROGRESS: {
    key: 'in_progress',
    label: '进行中',
    color: 'success',
    description: '比赛正在进行',
    allowedActions: ['pause', 'view_results', 'manage_schedules'],
    nextStates: ['paused', 'completed']
  },
  PAUSED: {
    key: 'paused',
    label: '暂停',
    color: 'warning',
    description: '比赛暂时暂停',
    allowedActions: ['resume', 'complete'],
    nextStates: ['in_progress', 'completed']
  },
  COMPLETED: {
    key: 'completed',
    label: '已结束',
    color: 'success',
    description: '比赛已完成',
    allowedActions: ['view_results', 'export_results'],
    nextStates: []
  },
  CANCELLED: {
    key: 'cancelled',
    label: '已取消',
    color: 'error',
    description: '比赛已取消',
    allowedActions: ['view_details'],
    nextStates: []
  }
};

// 状态流程步骤
const STATUS_STEPS = [
  { key: 'draft', label: '创建比赛' },
  { key: 'registration_open', label: '开放报名' },
  { key: 'registration_closed', label: '报名截止' },
  { key: 'in_progress', label: '比赛进行' },
  { key: 'completed', label: '比赛结束' }
];

const CompetitionStatusManager = ({ 
  competition, 
  onStatusChange, 
  userRole = 'admin',
  disabled = false 
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [loading, setLoading] = useState(false);

  const currentState = COMPETITION_STATES[competition?.status?.toUpperCase()] || COMPETITION_STATES.DRAFT;
  const currentStepIndex = STATUS_STEPS.findIndex(step => step.key === currentState.key);

  // 检查用户权限
  const hasPermission = (action) => {
    if (disabled) return false;
    
    const rolePermissions = {
      admin: ['edit', 'publish', 'delete', 'close_registration', 'start_competition', 'pause', 'resume', 'complete'],
      chief_referee: ['view_results', 'manage_schedules', 'edit_scores'],
      referee: ['view_results'],
      organization: ['view_details']
    };
    
    return rolePermissions[userRole]?.includes(action) || false;
  };

  // 获取可执行的操作
  const getAvailableActions = () => {
    return currentState.allowedActions.filter(action => hasPermission(action));
  };

  // 处理状态变更
  const handleStatusChange = async (newStatus, reason = '') => {
    setLoading(true);
    try {
      await onStatusChange(newStatus, reason);
      setDialogOpen(false);
      setSelectedAction(null);
      setActionReason('');
    } catch (error) {
      console.error('状态变更失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 打开确认对话框
  const openConfirmDialog = (action) => {
    setSelectedAction(action);
    setDialogOpen(true);
  };

  // 获取操作按钮配置
  const getActionButton = (action) => {
    const actionConfigs = {
      edit: { label: '编辑比赛', icon: <EditIcon />, color: 'primary' },
      publish: { label: '发布比赛', icon: <StartIcon />, color: 'success' },
      close_registration: { label: '截止报名', icon: <StopIcon />, color: 'warning' },
      start_competition: { label: '开始比赛', icon: <PlayArrow />, color: 'success' },
      pause: { label: '暂停比赛', icon: <PauseIcon />, color: 'warning' },
      resume: { label: '恢复比赛', icon: <StartIcon />, color: 'success' },
      complete: { label: '结束比赛', icon: <CompleteIcon />, color: 'success' },
      view_participants: { label: '查看参赛者', icon: <ParticipantsIcon />, color: 'info' },
      view_results: { label: '查看结果', icon: <ResultsIcon />, color: 'info' },
      manage_schedules: { label: '管理赛程', icon: <ScheduleIcon />, color: 'info' }
    };

    return actionConfigs[action] || { label: action, icon: <ViewIcon />, color: 'default' };
  };

  // 获取下一个状态的标签
  const getNextStateLabel = (action) => {
    const stateMapping = {
      publish: 'registration_open',
      close_registration: 'registration_closed',
      start_competition: 'in_progress',
      pause: 'paused',
      resume: 'in_progress',
      complete: 'completed'
    };

    const nextStateKey = stateMapping[action];
    return nextStateKey ? COMPETITION_STATES[nextStateKey.toUpperCase()]?.label : '';
  };

  return (
    <Box>
      {/* 状态概览卡片 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="h6">比赛状态</Typography>
                <Chip 
                  label={currentState.label}
                  color={currentState.color}
                  size="medium"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {currentState.description}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
                {getAvailableActions().map(action => {
                  const config = getActionButton(action);
                  return (
                    <Button
                      key={action}
                      variant="outlined"
                      color={config.color}
                      startIcon={config.icon}
                      onClick={() => openConfirmDialog(action)}
                      size="small"
                    >
                      {config.label}
                    </Button>
                  );
                })}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 状态流程图 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>比赛流程</Typography>
          <Stepper activeStep={currentStepIndex} orientation="vertical">
            {STATUS_STEPS.map((step, index) => {
              const stepState = COMPETITION_STATES[step.key.toUpperCase()];
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <Step key={step.key} completed={isCompleted}>
                  <StepLabel>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2">{step.label}</Typography>
                      {isCurrent && (
                        <Chip 
                          label={stepState.label}
                          color={stepState.color}
                          size="small"
                        />
                      )}
                    </Box>
                  </StepLabel>
                  {isCurrent && (
                    <StepContent>
                      <Typography variant="body2" color="text.secondary">
                        {stepState.description}
                      </Typography>
                    </StepContent>
                  )}
                </Step>
              );
            })}
          </Stepper>
        </CardContent>
      </Card>

      {/* 状态变更确认对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          确认操作：{selectedAction && getActionButton(selectedAction).label}
        </DialogTitle>
        <DialogContent>
          {selectedAction && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                {getNextStateLabel(selectedAction) && (
                  <>比赛状态将变更为：<strong>{getNextStateLabel(selectedAction)}</strong></>
                )}
              </Alert>
              
              <TextField
                fullWidth
                multiline
                rows={3}
                label="操作说明（可选）"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="请输入此次操作的原因或说明..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button 
            onClick={() => {
              const nextState = getNextStateLabel(selectedAction);
              if (nextState) {
                const nextStateKey = Object.keys(COMPETITION_STATES).find(
                  key => COMPETITION_STATES[key].label === nextState
                );
                handleStatusChange(nextStateKey?.toLowerCase(), actionReason);
              }
            }}
            variant="contained"
            disabled={loading}
          >
            {loading ? '处理中...' : '确认'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CompetitionStatusManager;