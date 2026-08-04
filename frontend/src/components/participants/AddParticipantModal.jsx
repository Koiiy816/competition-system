import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  FormHelperText,
  Box,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import competitionService from '../../services/competitionService';
import participantService from '../../services/participantService';

const AddParticipantModal = ({ open, onClose, competitionId, onSuccess, editData }) => {
  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    schoolName: '',
    event: '',
    grade: '',
    gender: '',
    idCard: '',
    birthDate: '',
    teamLeader: '',
    leaderPhone: '',
    coach: '',
    coachPhone: '',
    insuranceConfirmed: true,
    type: 'individual',
    isTest: false
  });

  const [errors, setErrors] = useState({});
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const gradeOptions = [
    { value: 'U10组 (7-10岁)', label: 'U10组 (7-10岁)' },
    { value: 'U13组 (11-13岁)', label: 'U13组 (11-13岁)' },
    { value: 'U16组 (14-16岁)', label: 'U16组 (14-16岁)' },
    { value: '一年级', label: '一年级' },
    { value: '二年级', label: '二年级' },
    { value: '三年级', label: '三年级' },
    { value: '四年级', label: '四年级' },
    { value: '五年级', label: '五年级' },
    { value: '六年级', label: '六年级' },
    { value: '初一', label: '初一' },
    { value: '初二', label: '初二' },
    { value: '初三', label: '初三' },
    { value: '高一', label: '高一' },
    { value: '高二', label: '高二' },
    { value: '高三', label: '高三' }
  ];

  // 获取比赛详情及初始化编辑数据
  useEffect(() => {
    if (open && competitionId) {
      const fetchCompetition = async () => {
        setLoading(true);
        setError(''); // Reset error state when fetching
        try {
          const compId = typeof competitionId === 'object' ? competitionId._id : competitionId;
          const res = await competitionService.getCompetition(compId);
          setCompetition(res.data);
          
          if (editData) {
             // 填充编辑数据
             setFormData({
                name: editData.type === 'team' ? (editData.members?.[0]?.name || '') : editData.name || '',
                schoolName: editData.schoolName || editData.teamName || '',
                event: editData.event || '',
                grade: editData.grade || editData.ageGroup || '',
                gender: editData.gender || '',
                idCard: editData.idCard || '',
                birthDate: editData.birthDate ? new Date(editData.birthDate).toISOString().split('T')[0] : '',
                teamLeader: editData.teamLeader || '',
                leaderPhone: editData.leaderPhone || '',
                coach: editData.coach || '',
                coachPhone: editData.coachPhone || '',
                insuranceConfirmed: true,
                type: editData.type || 'individual',
                isTest: editData.isTest || false
             });
          } else if (res.data.events && res.data.events.length === 1) {
             // 如果只有单个项目，自动选择
             setFormData(prev => ({ ...prev, event: res.data.events[0].name }));
          }
        } catch (err) {
          console.error("Fetch competition error:", err);
          setError('获取比赛信息失败: ' + (err.response?.data?.message || err.message));
        } finally {
          setLoading(false);
        }
      };
      fetchCompetition();
    } else if (!open) {
       // 清空表单
       setFormData({
        name: '',
        schoolName: '',
        event: '',
        grade: '',
        gender: '',
        idCard: '',
        birthDate: '',
        teamLeader: '',
        leaderPhone: '',
        coach: '',
        coachPhone: '',
        insuranceConfirmed: true,
        type: 'individual',
        isTest: false
       });
       setErrors({});
       setSelectedPhoto(null);
    }
  }, [open, competitionId, editData]);

  // 处理输入改变
  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({ ...prev, [name]: val }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === 'idCard') {
       if (val.length === 18) {
          const year = val.substring(6, 10);
          const month = val.substring(10, 12);
          const day = val.substring(12, 14);
          
          // 自动识别性别
          const genderDigit = parseInt(val.substring(16, 17), 10);
          const autoGender = genderDigit % 2 === 0 ? 'female' : 'male';
          const genderPrefix = autoGender === 'male' ? '男子' : '女子';
          
          // 自动识别年龄组别 (按2026年计算)
          const birthYear = parseInt(year, 10);
          const age = 2026 - birthYear;
          let autoGrade = '';
          if (age <= 6) autoGrade = `U6组 (6岁以下)`; // 或者是标准名称，可以只用核心词或者匹配
          else if (age <= 10) autoGrade = `U10组 (7-10岁)`;
          else if (age <= 13) autoGrade = `U13组 (11-13岁)`;
          else if (age <= 16) autoGrade = `U16组 (14-16岁)`;

          setFormData(prev => ({
            ...prev,
            idCard: val,
            birthDate: `${year}-${month}-${day}`,
            gender: autoGender,
            grade: autoGrade || prev.grade
          }));
       }
    }
  };

  const getAvailableEvents = () => {
    if (!competition?.events) return [];
    
    const selectedGroup = formData.grade;
    const selectedGender = formData.gender;
    
    if (!selectedGroup) return [];
    
    return competition.events.filter(event => {
      let ageMatch = false;
      if (event.ageGroups && event.ageGroups.length > 0) {
         // 模糊匹配：只要 selectedGroup 包含 U16，且 event 配置里也有 U16 就算匹配
         ageMatch = event.ageGroups.some(g => {
            const coreMatchG = g.match(/(U\d+组)/i);
            const coreMatchS = selectedGroup.match(/(U\d+组)/i);
            if (coreMatchG && coreMatchS && coreMatchG[1] === coreMatchS[1]) {
               return true;
            }
            return g === selectedGroup || selectedGroup.includes(g) || g.includes(selectedGroup);
         });
      }
      
      let genderMatch = true;
      if (selectedGender && event.genderRestriction && event.genderRestriction !== 'both') {
        genderMatch = event.genderRestriction === selectedGender;
      }
      return ageMatch && genderMatch;
    });
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) { setSelectedPhoto(null); return; }
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setErrors(prev => ({ ...prev, photo: '\u8bf7\u4e0a\u4f20 JPG \u6216 PNG \u683c\u5f0f\u7684\u8fd0\u52a8\u5458\u7167\u7247' }));
      setSelectedPhoto(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: '\u7167\u7247\u5927\u5c0f\u4e0d\u80fd\u8d85\u8fc7 10MB' }));
      setSelectedPhoto(null);
      return;
    }
    setSelectedPhoto(file);
    setErrors(prev => ({ ...prev, photo: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = '请输入姓名';
    if (!formData.schoolName.trim()) newErrors.schoolName = '请输入代表单位';
    if (!formData.gender) newErrors.gender = '请选择性别';
    if (!formData.grade) newErrors.grade = '请选择年龄组别';
    if (!formData.event) newErrors.event = '请选择比赛项目';
    if (competition?.participantRequirements?.requirePhoto && !editData && !selectedPhoto) newErrors.photo = '\u8bf7\u4e0a\u4f20\u8fd0\u52a8\u5458\u7167\u7247';
    
    if (formData.idCard && !/^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(formData.idCard)) {
      newErrors.idCard = '身份证格式不正确';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    setSubmitting(true);
    setError('');
    
    try {
      // 提交的数据，默认状态为已通过
      const submitData = {
        ...formData,
        grade: formData.grade, // 确保 grade 字段也被正确更新
        ageGroup: formData.grade, // 保持与前台报名一致，保存到 ageGroup 字段
        status: 'approved'
      };

      // 检查是否为集体项目
      const eventConfig = competition.events?.find(e => e.name === formData.event);
      if (eventConfig && eventConfig.isGroupEvent) {
         submitData.teamName = formData.schoolName;
         submitData.members = [{ name: formData.name }];
      }
      
      if (editData) {
         await participantService.updateParticipant(competitionId, editData._id, submitData);
      } else if (selectedPhoto) {
         const multipartData = new FormData();
         Object.entries(submitData).forEach(([key, value]) => {
           if (value !== undefined && value !== null) multipartData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
         });
         multipartData.append('photo', selectedPhoto);
         await participantService.addParticipant(competitionId, multipartData);
      } else {
         await participantService.addParticipant(competitionId, submitData);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || (editData ? '更新参赛者失败' : '添加参赛者失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const availableEvents = getAvailableEvents();
  const photoRequired = Boolean(competition?.participantRequirements?.requirePhoto);

  return (
    <Dialog open={open} onClose={!submitting ? onClose : null} maxWidth="md" fullWidth>
      <DialogTitle>{editData ? '编辑参赛者' : '添加参赛者'}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="姓名 *"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={!!errors.name}
                helperText={errors.name}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="代表单位 / 学校 *"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleChange}
                error={!!errors.schoolName}
                helperText={errors.schoolName || "集体项目将以此作为队伍名称"}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.gender}>
                <InputLabel>性别 *</InputLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  label="性别 *"
                  onChange={handleChange}
                >
                  <MenuItem value="male">男</MenuItem>
                  <MenuItem value="female">女</MenuItem>
                </Select>
                {errors.gender && <FormHelperText>{errors.gender}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.grade}>
                <InputLabel>年龄组别 *</InputLabel>
                <Select
                  name="grade"
                  value={formData.grade}
                  label="年龄组别 *"
                  onChange={handleChange}
                >
                  {/* 如果当前 formData.grade 不在默认选项中，将其作为额外选项加入，防止回显空白 */}
                  {formData.grade && 
                    !competition?.events?.some(e => e.ageGroups?.includes(formData.grade)) &&
                    !gradeOptions.some(o => o.value === formData.grade) && (
                      <MenuItem key={formData.grade} value={formData.grade}>
                        {formData.grade}
                      </MenuItem>
                  )}
                  {competition?.events?.reduce((acc, current) => {
                     if (current.ageGroups) {
                        current.ageGroups.forEach(g => {
                           if (!acc.includes(g)) acc.push(g);
                        });
                     }
                     return acc;
                  }, []).map(group => (
                    <MenuItem key={group} value={group}>{group}</MenuItem>
                  ))}
                  {/* 如果比赛没有配置组别，退回默认 */}
                  {(!competition?.events || competition.events.length === 0) && gradeOptions.map(option => (
                     <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
                {errors.grade && <FormHelperText>{errors.grade}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.event}>
                <InputLabel>比赛项目 *</InputLabel>
                <Select
                  name="event"
                  value={formData.event}
                  label="比赛项目 *"
                  onChange={handleChange}
                  disabled={!formData.grade || !formData.gender}
                >
                  {availableEvents.length === 0 ? (
                    <MenuItem value="" disabled>没有符合当前组别和性别的项目</MenuItem>
                  ) : (
                    availableEvents.map(event => (
                      <MenuItem key={event.name} value={event.name}>
                        {event.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
                {errors.event && <FormHelperText>{errors.event}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="身份证号"
                name="idCard"
                value={formData.idCard}
                onChange={handleChange}
                error={!!errors.idCard}
                helperText={errors.idCard || "输入18位身份证号可自动解析生日"}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="出生日期"
                name="birthDate"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.birthDate}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isTest}
                    onChange={(e) => handleChange({
                      target: {
                        name: 'isTest',
                        value: e.target.checked,
                        type: 'checkbox',
                        checked: e.target.checked
                      }
                    })}
                    name="isTest"
                    color="secondary"
                  />
                }
                label="设为测试人员 (不占用正式名次和团体积分)"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 2 }}>
                联系人信息 (可选)
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="领队姓名"
                name="teamLeader"
                value={formData.teamLeader}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="领队电话"
                name="leaderPhone"
                value={formData.leaderPhone}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="教练姓名"
                name="coach"
                value={formData.coach}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="教练电话"
                name="coachPhone"
                value={formData.coachPhone}
                onChange={handleChange}
              />
            </Grid>

            {!editData && (
              <Grid item xs={12}>
                <Box sx={{ border: '1px dashed', borderColor: errors.photo ? 'error.main' : 'divider', borderRadius: 1, p: 2 }}>
                  <Typography variant="subtitle2">{'\u8fd0\u52a8\u5458\u7167\u7247'}{photoRequired ? ' *' : ''}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{'\u4ec5\u652f\u6301 JPG\u3001PNG\uff0c\u5355\u5f20\u4e0d\u8d85\u8fc7 10MB\u3002'}</Typography>
                  <input accept="image/jpeg,image/png" id="admin-participant-photo" type="file" style={{ display: 'none' }} onChange={handlePhotoChange} />
                  <label htmlFor="admin-participant-photo"><Button component="span" variant="outlined">{'\u4e0a\u4f20\u7167\u7247'}</Button></label>
                  {selectedPhoto && <Typography variant="body2" sx={{ mt: 1 }}>{'\u5df2\u9009\u62e9\uff1a'}{selectedPhoto.name}</Typography>}
                  {errors.photo && <FormHelperText error>{errors.photo}</FormHelperText>}
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || submitting}>
          {submitting ? <CircularProgress size={24} /> : (editData ? '保存修改' : '直接添加')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddParticipantModal;