import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  DateRange as AgeIcon,
  Assignment as DocumentIcon,
  Group as TeamIcon
} from '@mui/icons-material';

// 年龄组别定义
const AGE_GROUPS = {
  HIGH_SCHOOL: {
    key: 'high_school',
    label: '高中组',
    minAge: 15,
    maxAge: 18,
    description: '15-18岁学生'
  },
  MIDDLE_SCHOOL: {
    key: 'middle_school', 
    label: '初中组',
    minAge: 12,
    maxAge: 15,
    description: '12-15岁学生'
  },
  PRIMARY_A: {
    key: 'primary_a',
    label: '小学甲组',
    minAge: 9,
    maxAge: 12,
    description: '4-6年级学生（9-12岁）'
  },
  PRIMARY_B: {
    key: 'primary_b',
    label: '小学乙组',
    minAge: 6,
    maxAge: 9,
    description: '1-3年级学生（6-9岁）'
  }
};

// 参赛要求类型
const REQUIREMENT_TYPES = {
  AGE_VERIFICATION: {
    key: 'age_verification',
    label: '年龄验证',
    description: '验证参赛者年龄是否符合组别要求',
    required: true
  },
  SCHOOL_REGISTRATION: {
    key: 'school_registration',
    label: '学校单位报名',
    description: '必须以学校为单位进行报名',
    required: true
  },
  MEDICAL_CERTIFICATE: {
    key: 'medical_certificate',
    label: '体检证明',
    description: '提供有效的体检证明',
    required: false
  },
  PARENT_CONSENT: {
    key: 'parent_consent',
    label: '家长同意书',
    description: '未成年参赛者需要家长同意书',
    required: false
  },
  INSURANCE: {
    key: 'insurance',
    label: '保险证明',
    description: '提供有效的意外保险证明',
    required: false
  }
};

const ParticipantValidation = ({ 
  participant, 
  competition, 
  onValidationResult,
  showDetails = true 
}) => {
  const [validationResults, setValidationResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 计算年龄
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // 验证年龄组别
  const validateAgeGroup = (participant, targetAgeGroup) => {
    const age = calculateAge(participant.birthDate);
    if (!age) {
      return {
        valid: false,
        message: '缺少出生日期信息',
        severity: 'error'
      };
    }

    const ageGroup = AGE_GROUPS[targetAgeGroup.toUpperCase()];
    if (!ageGroup) {
      return {
        valid: false,
        message: '无效的年龄组别',
        severity: 'error'
      };
    }

    const isValidAge = age >= ageGroup.minAge && age <= ageGroup.maxAge;
    
    return {
      valid: isValidAge,
      message: isValidAge 
        ? `年龄${age}岁，符合${ageGroup.label}要求`
        : `年龄${age}岁，不符合${ageGroup.label}要求（${ageGroup.minAge}-${ageGroup.maxAge}岁）`,
      severity: isValidAge ? 'success' : 'error',
      data: { age, ageGroup: ageGroup.label }
    };
  };

  // 验证学校报名
  const validateSchoolRegistration = (participant) => {
    const hasSchool = participant.school && participant.school.trim() !== '';
    
    return {
      valid: hasSchool,
      message: hasSchool 
        ? `学校：${participant.school}`
        : '缺少学校信息，必须以学校为单位报名',
      severity: hasSchool ? 'success' : 'error'
    };
  };

  // 验证文档要求
  const validateDocuments = (participant, requirements) => {
    const results = {};
    
    if (requirements.medicalCertificate) {
      const hasMedical = participant.documents?.medicalCertificate;
      results.medicalCertificate = {
        valid: hasMedical,
        message: hasMedical ? '已提交体检证明' : '需要提交体检证明',
        severity: hasMedical ? 'success' : 'warning'
      };
    }

    if (requirements.parentConsent) {
      const age = calculateAge(participant.birthDate);
      const needsConsent = age && age < 18;
      const hasConsent = participant.documents?.parentConsent;
      
      if (needsConsent) {
        results.parentConsent = {
          valid: hasConsent,
          message: hasConsent ? '已提交家长同意书' : '未成年参赛者需要家长同意书',
          severity: hasConsent ? 'success' : 'error'
        };
      }
    }

    if (requirements.insurance) {
      const hasInsurance = participant.documents?.insurance;
      results.insurance = {
        valid: hasInsurance,
        message: hasInsurance ? '已提交保险证明' : '建议提交意外保险证明',
        severity: hasInsurance ? 'success' : 'info'
      };
    }

    return results;
  };

  // 验证报名限制
  const validateRegistrationLimits = (participant, events, rules) => {
    const results = {};
    
    // 检查报名项目数量限制
    if (rules.maxEventsPerParticipant) {
      const eventCount = events.length;
      const isValidCount = eventCount <= rules.maxEventsPerParticipant;
      
      results.eventCount = {
        valid: isValidCount,
        message: `已报名${eventCount}个项目，限制${rules.maxEventsPerParticipant}个`,
        severity: isValidCount ? 'success' : 'error'
      };
    }

    // 检查传统器械重复报名
    if (rules.allowTraditionalWeaponDuplicate === false) {
      const traditionalWeaponEvents = events.filter(event => 
        event.category === 'traditional_weapon'
      );
      
      if (traditionalWeaponEvents.length > 1) {
        results.traditionalWeaponDuplicate = {
          valid: false,
          message: '不允许重复报名传统器械项目',
          severity: 'error'
        };
      }
    }

    return results;
  };

  // 执行完整验证
  const performValidation = async () => {
    setLoading(true);
    
    try {
      const results = {};
      
      // 年龄验证
      if (participant.ageGroup) {
        results.ageVerification = validateAgeGroup(participant, participant.ageGroup);
      }

      // 学校报名验证
      if (competition.registrationRules?.requireSchoolRegistration) {
        results.schoolRegistration = validateSchoolRegistration(participant);
      }

      // 文档验证
      if (competition.participantRequirements) {
        const docResults = validateDocuments(participant, competition.participantRequirements);
        Object.assign(results, docResults);
      }

      // 报名限制验证
      if (competition.registrationRules && participant.events) {
        const limitResults = validateRegistrationLimits(
          participant, 
          participant.events, 
          competition.registrationRules
        );
        Object.assign(results, limitResults);
      }

      setValidationResults(results);
      
      // 计算总体验证结果
      const allValid = Object.values(results).every(result => result.valid);
      const hasErrors = Object.values(results).some(result => result.severity === 'error');
      
      if (onValidationResult) {
        onValidationResult({
          participantId: participant.id,
          valid: allValid,
          hasErrors,
          results
        });
      }
      
    } catch (error) {
      console.error('验证过程出错:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时执行验证
  useEffect(() => {
    if (participant && competition) {
      performValidation();
    }
  }, [participant, competition]);

  // 获取验证状态图标
  const getStatusIcon = (result) => {
    if (!result) return <WarningIcon color="warning" />;
    
    switch (result.severity) {
      case 'success':
        return <ValidIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon color="info" />;
    }
  };

  // 获取总体验证状态
  const getOverallStatus = () => {
    const results = Object.values(validationResults);
    if (results.length === 0) return { status: 'pending', message: '等待验证' };
    
    const hasErrors = results.some(r => r.severity === 'error');
    const hasWarnings = results.some(r => r.severity === 'warning');
    const allValid = results.every(r => r.valid);
    
    if (hasErrors) {
      return { status: 'error', message: '验证失败', color: 'error' };
    } else if (hasWarnings) {
      return { status: 'warning', message: '部分通过', color: 'warning' };
    } else if (allValid) {
      return { status: 'success', message: '验证通过', color: 'success' };
    } else {
      return { status: 'pending', message: '验证中', color: 'info' };
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <Box>
      {/* 验证状态概览 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={2}>
                <PersonIcon color="primary" />
                <Box>
                  <Typography variant="subtitle1">
                    {participant.name || '参赛者'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {participant.school || '未知学校'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={2} justifyContent="flex-end">
                <Chip
                  label={overallStatus.message}
                  color={overallStatus.color}
                  icon={getStatusIcon(validationResults.ageVerification)}
                />
                {showDetails && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setDetailsOpen(true)}
                  >
                    查看详情
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 验证详情对话框 */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>参赛资格验证详情</DialogTitle>
        <DialogContent>
          <List>
            {Object.entries(validationResults).map(([key, result]) => (
              <React.Fragment key={key}>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(result)}
                  </ListItemIcon>
                  <ListItemText
                    primary={REQUIREMENT_TYPES[key]?.label || key}
                    secondary={result.message}
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
          
          {Object.keys(validationResults).length === 0 && (
            <Alert severity="info">
              暂无验证结果
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>关闭</Button>
          <Button onClick={performValidation} variant="contained" disabled={loading}>
            {loading ? '验证中...' : '重新验证'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParticipantValidation;