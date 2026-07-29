import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Person as PersonIcon,
  Group as TeamIcon,
  Event as EventIcon,
  School as SchoolIcon,
  Block as BlockIcon,
  Info as InfoIcon,
  Visibility as ViewIcon,
  Edit as EditIcon
} from '@mui/icons-material';

// 报名限制类型
const LIMIT_TYPES = {
  MAX_EVENTS_PER_PARTICIPANT: {
    key: 'maxEventsPerParticipant',
    label: '每人最多报名项目数',
    description: '限制单个参赛者可报名的项目数量',
    icon: <PersonIcon />
  },
  MAX_PARTICIPANTS_PER_EVENT: {
    key: 'maxParticipantsPerEvent',
    label: '每项目最大参赛人数',
    description: '限制单个项目的参赛人数上限',
    icon: <EventIcon />
  },
  SCHOOL_QUOTA: {
    key: 'schoolQuota',
    label: '学校报名配额',
    description: '限制每个学校的报名人数',
    icon: <SchoolIcon />
  },
  TRADITIONAL_WEAPON_DUPLICATE: {
    key: 'allowTraditionalWeaponDuplicate',
    label: '传统器械重复报名',
    description: '是否允许重复报名传统器械项目',
    icon: <BlockIcon />
  },
  TEAM_SIZE_LIMITS: {
    key: 'teamSizeLimits',
    label: '团体项目人数限制',
    description: '设置团体项目的最小和最大人数',
    icon: <TeamIcon />
  }
};

const RegistrationLimits = ({ 
  competition, 
  participants = [], 
  onLimitViolation,
  showViolationsOnly = false 
}) => {
  const [violations, setViolations] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [loading, setLoading] = useState(false);

  // 获取报名限制规则
  const registrationRules = competition?.registrationRules || {};

  // 检查每人最多报名项目数限制
  const checkMaxEventsPerParticipant = () => {
    const violations = [];
    const maxEvents = registrationRules.maxEventsPerParticipant;
    
    if (!maxEvents) return violations;

    const participantEventCounts = {};
    
    participants.forEach(participant => {
      const participantId = participant.userId || participant.id;
      const participantName = participant.name || participant.user?.name;
      
      if (!participantEventCounts[participantId]) {
        participantEventCounts[participantId] = {
          name: participantName,
          events: []
        };
      }
      
      if (participant.events) {
        participantEventCounts[participantId].events.push(...participant.events);
      }
    });

    Object.entries(participantEventCounts).forEach(([participantId, data]) => {
      if (data.events.length > maxEvents) {
        violations.push({
          type: 'MAX_EVENTS_PER_PARTICIPANT',
          severity: 'error',
          participantId,
          participantName: data.name,
          message: `${data.name} 报名了 ${data.events.length} 个项目，超过限制 ${maxEvents} 个`,
          details: {
            currentCount: data.events.length,
            maxAllowed: maxEvents,
            events: data.events
          }
        });
      }
    });

    return violations;
  };

  // 检查传统器械重复报名
  const checkTraditionalWeaponDuplicate = () => {
    const violations = [];
    
    if (registrationRules.allowTraditionalWeaponDuplicate !== false) {
      return violations;
    }

    participants.forEach(participant => {
      const participantName = participant.name || participant.user?.name;
      const traditionalWeaponEvents = (participant.events || []).filter(event => 
        event.category === 'traditional_weapon' || 
        event.name?.includes('传统器械')
      );

      if (traditionalWeaponEvents.length > 1) {
        violations.push({
          type: 'TRADITIONAL_WEAPON_DUPLICATE',
          severity: 'error',
          participantId: participant.userId || participant.id,
          participantName,
          message: `${participantName} 重复报名了传统器械项目`,
          details: {
            events: traditionalWeaponEvents
          }
        });
      }
    });

    return violations;
  };

  // 检查学校报名配额
  const checkSchoolQuota = () => {
    const violations = [];
    const schoolQuota = registrationRules.schoolQuota;
    
    if (!schoolQuota) return violations;

    const schoolCounts = {};
    
    participants.forEach(participant => {
      const school = participant.school;
      if (school) {
        schoolCounts[school] = (schoolCounts[school] || 0) + 1;
      }
    });

    Object.entries(schoolCounts).forEach(([school, count]) => {
      if (count > schoolQuota) {
        violations.push({
          type: 'SCHOOL_QUOTA',
          severity: 'warning',
          school,
          message: `${school} 报名人数 ${count} 人，超过配额 ${schoolQuota} 人`,
          details: {
            currentCount: count,
            maxAllowed: schoolQuota
          }
        });
      }
    });

    return violations;
  };

  // 检查团体项目人数限制
  const checkTeamSizeLimits = () => {
    const violations = [];
    const teamLimits = registrationRules.teamSizeLimits;
    
    if (!teamLimits) return violations;

    const teamEvents = participants.filter(p => p.type === 'team');
    
    teamEvents.forEach(team => {
      const teamSize = team.members?.length || 0;
      const minSize = teamLimits.minSize || 0;
      const maxSize = teamLimits.maxSize || Infinity;

      if (teamSize < minSize) {
        violations.push({
          type: 'TEAM_SIZE_LIMITS',
          severity: 'error',
          participantId: team.id,
          participantName: team.teamName,
          message: `团队 ${team.teamName} 人数不足，当前 ${teamSize} 人，最少需要 ${minSize} 人`,
          details: {
            currentSize: teamSize,
            minRequired: minSize,
            maxAllowed: maxSize
          }
        });
      } else if (teamSize > maxSize) {
        violations.push({
          type: 'TEAM_SIZE_LIMITS',
          severity: 'error',
          participantId: team.id,
          participantName: team.teamName,
          message: `团队 ${team.teamName} 人数超限，当前 ${teamSize} 人，最多允许 ${maxSize} 人`,
          details: {
            currentSize: teamSize,
            minRequired: minSize,
            maxAllowed: maxSize
          }
        });
      }
    });

    return violations;
  };

  // 执行所有限制检查
  const performLimitChecks = () => {
    setLoading(true);
    
    try {
      const allViolations = [
        ...checkMaxEventsPerParticipant(),
        ...checkTraditionalWeaponDuplicate(),
        ...checkSchoolQuota(),
        ...checkTeamSizeLimits()
      ];

      setViolations(allViolations);
      
      if (onLimitViolation) {
        onLimitViolation(allViolations);
      }
      
    } catch (error) {
      console.error('限制检查失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时执行检查
  useEffect(() => {
    if (participants.length > 0) {
      performLimitChecks();
    }
  }, [participants, registrationRules]);

  // 获取违规严重程度图标
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  // 获取违规统计
  const getViolationStats = () => {
    const stats = {
      total: violations.length,
      errors: violations.filter(v => v.severity === 'error').length,
      warnings: violations.filter(v => v.severity === 'warning').length
    };
    return stats;
  };

  const stats = getViolationStats();

  // 如果只显示违规且无违规，则不显示组件
  if (showViolationsOnly && violations.length === 0) {
    return null;
  }

  return (
    <Box>
      {/* 限制检查概览 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h6" gutterBottom>
                报名限制检查
              </Typography>
              <Typography variant="body2" color="text.secondary">
                检查参赛报名是否符合比赛规则和限制条件
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1} justifyContent="flex-end" alignItems="center">
                {stats.errors > 0 && (
                  <Chip
                    label={`${stats.errors} 个错误`}
                    color="error"
                    size="small"
                    icon={<ErrorIcon />}
                  />
                )}
                {stats.warnings > 0 && (
                  <Chip
                    label={`${stats.warnings} 个警告`}
                    color="warning"
                    size="small"
                    icon={<WarningIcon />}
                  />
                )}
                {stats.total === 0 && (
                  <Chip
                    label="检查通过"
                    color="success"
                    size="small"
                    icon={<SuccessIcon />}
                  />
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={performLimitChecks}
                  disabled={loading}
                >
                  {loading ? '检查中...' : '重新检查'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 违规列表 */}
      {violations.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              违规详情 ({violations.length})
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>严重程度</TableCell>
                    <TableCell>类型</TableCell>
                    <TableCell>参赛者/团队</TableCell>
                    <TableCell>违规说明</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {violations.map((violation, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getSeverityIcon(violation.severity)}
                          <Typography variant="caption" color="text.secondary">
                            {violation.severity === 'error' ? '错误' : '警告'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {LIMIT_TYPES[violation.type]?.label || violation.type}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {violation.participantName || violation.school || '未知'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {violation.message}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="查看详情">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedViolation(violation);
                              setDetailsOpen(true);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* 无违规提示 */}
      {violations.length === 0 && !loading && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            所有参赛报名均符合比赛规则，未发现违规情况。
          </Typography>
        </Alert>
      )}

      {/* 违规详情对话框 */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>违规详情</DialogTitle>
        <DialogContent>
          {selectedViolation && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Alert severity={selectedViolation.severity}>
                    {selectedViolation.message}
                  </Alert>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    详细信息
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(selectedViolation.details, null, 2)}
                    </pre>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegistrationLimits;