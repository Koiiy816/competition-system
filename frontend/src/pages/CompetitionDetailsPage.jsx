import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, CircularProgress, Alert, TextField, Button, Paper, 
  FormControl, InputLabel, Select, MenuItem, Grid, IconButton, Card, 
  CardContent, CardMedia, Divider, Checkbox, FormControlLabel, FormGroup,
  Stepper, Step, StepLabel, Chip, OutlinedInput, Snackbar, FormHelperText,
  Autocomplete, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import EditIcon from '@mui/icons-material/Edit';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import competitionService from '../services/competitionService';
import EventItem from '../components/competitions/EventItem';
import { useAuth } from '../contexts/AuthContext';

export default function CompetitionDetailsPage({ isCreate = false, isEdit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [competition, setCompetition] = useState({
    name: '',
    description: '',
    startDate: null,
    endDate: null,
    registrationDeadline: null,
    status: 'draft',
    type: '武术',
    location: '',
    hosts: [],
    organizers: [],
    coOrganizers: [],
    rules: '',
    maxParticipants: 0,
    genderRestriction: 'both',
    ageGroups: [], // Added ageGroups
    events: [],
    participantRequirements: {
      requireIdCard: true,
      requirePhone: true,
      requireCoach: false,
      requireSchool: true,
      requireInsurance: true,
      requireMedicalCertificate: false,
      requireParentConsent: true
    },
    registrationRules: {
      maxEventsPerParticipant: 3,
      allowTraditionalWeaponDuplicate: false,
      schoolBasedRegistration: true,
      minGroupSize: 1,
      maxGroupSize: 12
    }
  });
  
  const [loading, setLoading] = useState(!isCreate);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [newAgeGroup, setNewAgeGroup] = useState({ name: '', description: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fileError, setFileError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const steps = ['基本信息', '比赛项目', '高级设置'];

  useEffect(() => {
    if (isCreate) {
      const savedDraft = localStorage.getItem('competitionDraft');
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          // Convert date strings back to Date objects if needed, or keep as strings if compatible
          if (parsedDraft.startDate) parsedDraft.startDate = new Date(parsedDraft.startDate);
          if (parsedDraft.endDate) parsedDraft.endDate = new Date(parsedDraft.endDate);
          if (parsedDraft.registrationDeadline) parsedDraft.registrationDeadline = new Date(parsedDraft.registrationDeadline);
          
          setCompetition(parsedDraft);
          setDraftLoaded(true);
        } catch (e) {
          console.error('Error parsing draft:', e);
        }
      }
      setLoading(false);
      return;
    }

    const fetchCompetition = async () => {
      setLoading(true);
      try {
        const response = await competitionService.getCompetition(id);
        const data = response.data;
        // Format dates for input fields safely compensating for timezone
        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          const d = new Date(dateStr);
          const localD = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
          return localD.toISOString().split('T')[0];
        };
        data.startDate = formatDate(data.startDate);
        data.endDate = formatDate(data.endDate);
        data.registrationDeadline = formatDate(data.registrationDeadline);
        setCompetition(data);
      } catch (err) {
        setError('无法加载比赛详情');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCompetition();
    }
  }, [id, isCreate, isEdit]);

  // Auto-save to localStorage whenever competition changes (only in create mode)
  useEffect(() => {
    if (isCreate) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem('competitionDraft', JSON.stringify(competition));
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [competition, isCreate]);

  const handleDateChange = (name, date) => {
    // 修复时区问题：确保使用本地日期转换为 YYYY-MM-DD
    if (date) {
      // 加上时区偏移，确保提取的日期字符串符合当地时间
      const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
      const dateString = localDate.toISOString().split('T')[0];
      setCompetition(prev => ({ ...prev, [name]: dateString }));
    } else {
      setCompetition(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleManualSave = () => {
    if (isCreate) {
      localStorage.setItem('competitionDraft', JSON.stringify(competition));
      setSaveSuccess(true);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCompetition(prev => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setCompetition(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleEventChange = useCallback((index, field, value) => {
    setCompetition(prev => {
      const newEvents = [...prev.events];
      newEvents[index] = { ...newEvents[index], [field]: value };
      return { ...prev, events: newEvents };
    });
  }, []);

  const handleFileChange = (e) => {
    setFileError('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 
        'image/png', 
        'image/jpg'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setFileError('不支持的文件类型。请上传 PDF、Word、Excel 文档或图片文件。');
        setSelectedFile(null);
        e.target.value = null; // Reset input
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB
        setFileError('文件大小不能超过 10MB');
        setSelectedFile(null);
        e.target.value = null; // Reset input
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleAddAgeGroup = () => {
    if (!newAgeGroup.name.trim()) return;
    setCompetition(prev => ({
      ...prev,
      ageGroups: [...(prev.ageGroups || []), { ...newAgeGroup }]
    }));
    setNewAgeGroup({ name: '', description: '' });
  };

  const handleRemoveAgeGroup = (index) => {
    setCompetition(prev => ({
      ...prev,
      ageGroups: (prev.ageGroups || []).filter((_, i) => i !== index)
    }));
  };

  const addEvent = () => {
    setCompetition(prev => ({
      ...prev,
      events: [
        ...prev.events,
        {
          name: '',
          ageGroups: [], 
          category: '', 
          subcategory: '',
          genderRestriction: 'both',
          maxParticipants: 0
        }
      ]
    }));
  };

  const removeEvent = useCallback((index) => {
    setCompetition(prev => ({
      ...prev,
      events: prev.events.filter((_, i) => i !== index)
    }));
  }, []);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    if (!competition.name || !competition.type) {
      setFormError('请填写所有必填字段');
      return;
    }

    // Validate events
    if (competition.events && competition.events.length > 0) {
      const invalidEvents = competition.events.filter(event => !event.name);
      if (invalidEvents.length > 0) {
        setFormError('所有比赛项目都必须填写名称');
        // If we are not on the events step, we might want to navigate there, 
        // but for now just showing error is safe.
        // To make it better, we could switch to step 1 if the error is there.
        if (activeStep !== 1) {
             // Optional: automatically switch to events tab if validation fails
             // setActiveStep(1); 
        }
        return;
      }
    }

    setLoading(true);
    setFormError('');

    // Transform data for backend
    const submissionData = {
      ...competition,
      registrationRules: {
        ...competition.registrationRules,
        teamSizeLimits: {
          minSize: parseInt(competition.registrationRules?.minGroupSize || 1),
          maxSize: parseInt(competition.registrationRules?.maxGroupSize || 12)
        }
      }
    };

    // Clean up temporary fields
    if (submissionData.registrationRules && submissionData.registrationRules.minGroupSize) delete submissionData.registrationRules.minGroupSize;
    if (submissionData.registrationRules && submissionData.registrationRules.maxGroupSize) delete submissionData.registrationRules.maxGroupSize;

    // Fix invalid Date strings
    const isValidDate = (d) => {
      if (!d) return false;
      const date = new Date(d);
      return date instanceof Date && !isNaN(date);
    };

    const formData = new FormData();

    // Explicitly define the fields we want to send to the backend
    const stringFields = [
      'name', 'description', 'status', 'type', 'location', 'rules', 'genderRestriction'
    ];
    
    const numberFields = [
      'maxParticipants'
    ];

    const jsonFields = [
      'hosts', 'organizers', 'coOrganizers', 'ageGroups', 'events', 
      'participantRequirements', 'registrationRules', 'scoringRules', 
      'awards', 'categories', 'tags'
    ];

    const dateFields = [
      'startDate', 'endDate', 'registrationDeadline'
    ];

    // Append String Fields
    stringFields.forEach(field => {
      if (submissionData[field] !== undefined && submissionData[field] !== null) {
        formData.append(field, String(submissionData[field]));
      }
    });

    // Append Number Fields
    numberFields.forEach(field => {
      if (submissionData[field] !== undefined && submissionData[field] !== null) {
        formData.append(field, String(submissionData[field]));
      }
    });

    // Append JSON Fields
    jsonFields.forEach(field => {
      if (submissionData[field] !== undefined && submissionData[field] !== null) {
        formData.append(field, JSON.stringify(submissionData[field]));
      }
    });

    // Append Date Fields
    dateFields.forEach(field => {
      if (isValidDate(submissionData[field])) {
        const d = new Date(submissionData[field]);
        formData.append(field, d.toISOString());
      }
    });

    if (selectedFile) {
      formData.append('registrationForm', selectedFile);
    }

    try {
      if (isCreate) {
        await competitionService.createCompetition(formData);
        // Clear draft on successful creation
        localStorage.removeItem('competitionDraft');
        navigate('/competitions');
      } else if (isEdit) {
        try {
          // 统一使用 formData 发送给后端，不再区分是否包含文件
          await competitionService.updateCompetition(id, formData);
        } catch (updateErr) {
          console.error("Update failed:", updateErr);
          throw updateErr;
        }
        navigate(`/competitions/${id}`);
      }
    } catch (err) {
      setFormError(err.message || '操作失败，请重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await competitionService.deleteCompetition(id);
      navigate('/competitions');
    } catch (err) {
      setError(err.message || '删除失败，请重试');
      console.error(err);
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading && !isCreate) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  // Form for creating or editing a competition
  if (isCreate || isEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>{isCreate ? '创建新比赛' : '编辑比赛'}</Typography>
          
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
    
          <form>
            {activeStep === 0 && (
              <Box>
                <TextField
                  fullWidth
                  margin="normal"
                  label="比赛名称"
                  name="name"
                  value={competition.name}
                  onChange={handleChange}
                  required
                />
                <TextField
                  fullWidth
                  margin="normal"
                  label="比赛规程 (描述与规则)"
                  name="description"
                  value={competition.description}
                  onChange={handleChange}
                  multiline
                  rows={10}
                  required
                  helperText="请在此处粘贴完整的比赛规程内容"
                />
                <TextField
                  fullWidth
                  margin="normal"
                  label="主办单位 (用逗号分隔)"
                  name="hosts"
                  value={Array.isArray(competition.hosts) ? competition.hosts.join('，') : competition.hosts}
                  onChange={(e) => setCompetition({ ...competition, hosts: e.target.value.split(/[,，]/).map(s => s.trim()) })}
                />
                <TextField
                  fullWidth
                  margin="normal"
                  label="承办单位 (用逗号分隔)"
                  name="organizers"
                  value={Array.isArray(competition.organizers) ? competition.organizers.join('，') : competition.organizers}
                  onChange={(e) => setCompetition({ ...competition, organizers: e.target.value.split(/[,，]/).map(s => s.trim()) })}
                />
                <TextField
                  fullWidth
                  margin="normal"
                  label="协办单位 (用逗号分隔)"
                  name="coOrganizers"
                  value={Array.isArray(competition.coOrganizers) ? competition.coOrganizers.join('，') : competition.coOrganizers}
                  onChange={(e) => setCompetition({ ...competition, coOrganizers: e.target.value.split(/[,，]/).map(s => s.trim()) })}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      margin="normal"
                      label="比赛类型"
                      name="type"
                      value={competition.type}
                      onChange={handleChange}
                      required
                    />
                  </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        margin="normal"
                        label="比赛地点"
                        name="location"
                        value={competition.location}
                        onChange={handleChange}
                      />
                    </Grid>
                  </Grid>
                  
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} sm={4}>
                        <DatePicker
                          label="开始日期"
                          value={competition.startDate ? new Date(competition.startDate) : null}
                          onChange={(date) => handleDateChange('startDate', date)}
                          format="dd/MM/yyyy"
                          slotProps={{ textField: { fullWidth: true, InputLabelProps: { shrink: true } } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <DatePicker
                          label="结束日期"
                          value={competition.endDate ? new Date(competition.endDate) : null}
                          onChange={(date) => handleDateChange('endDate', date)}
                          format="dd/MM/yyyy"
                          slotProps={{ textField: { fullWidth: true, InputLabelProps: { shrink: true } } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <DatePicker
                          label="报名截止日期"
                          value={competition.registrationDeadline ? new Date(competition.registrationDeadline) : null}
                          onChange={(date) => handleDateChange('registrationDeadline', date)}
                          format="dd/MM/yyyy"
                          slotProps={{ textField: { fullWidth: true, InputLabelProps: { shrink: true } } }}
                        />
                      </Grid>
                    </Grid>
                  </LocalizationProvider>
                  
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="最大参赛人数/队伍数 (0表示不限制)"
                        name="maxParticipants"
                        value={competition.maxParticipants}
                        onChange={handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel id="gender-label">性别限制</InputLabel>
                        <Select
                          labelId="gender-label"
                          id="genderRestriction"
                          name="genderRestriction"
                          value={competition.genderRestriction}
                          label="性别限制"
                          onChange={handleChange}
                        >
                          <MenuItem value="both">不限制</MenuItem>
                          <MenuItem value="male">仅限男性</MenuItem>
                          <MenuItem value="female">仅限女性</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>年龄组别配置</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    在此定义本次比赛的所有适用年龄组别，供后续参考或使用。
                  </Typography>
                  
                  <Grid container spacing={2} alignItems="flex-start">
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="组别名称 (如: 幼儿组 或 U16组)"
                        value={newAgeGroup.name}
                        onChange={(e) => setNewAgeGroup({ ...newAgeGroup, name: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="描述 (如: 14-16岁，2009年1月1日至2011年12月31日)"
                        value={newAgeGroup.description}
                        onChange={(e) => setNewAgeGroup({ ...newAgeGroup, description: e.target.value })}
                        helperText="建议格式：年龄范围，具体出生日期区间（用逗号分隔）"
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button 
                        variant="contained" 
                        onClick={handleAddAgeGroup} 
                        fullWidth
                        sx={{ mt: 1, height: '40px' }}
                        disabled={!newAgeGroup.name.trim()}
                      >
                        添加
                      </Button>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {competition.ageGroups && competition.ageGroups.map((group, index) => (
                    <Chip
                      key={index}
                      label={`${group.name} ${group.description ? `(${group.description})` : ''}`}
                      onDelete={() => handleRemoveAgeGroup(index)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
                </Box>
              )}
              
              {activeStep === 1 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>比赛项目</Typography>
                  {competition.events && competition.events.map((event, index) => (
                    <EventItem
                      key={index}
                      event={event}
                      index={index}
                      onChange={handleEventChange}
                      onRemove={removeEvent}
                      ageGroupOptions={competition.ageGroups}
                    />
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addEvent}
                    variant="outlined"
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    添加比赛项目
                  </Button>
                </Box>
              )}
              
              {activeStep === 2 && (
                 <Box>
                   <Typography variant="h6" sx={{ mb: 2 }}>参赛要求配置</Typography>
                   <FormGroup row>
                     <Grid container spacing={2}>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireIdCard || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireIdCard', e.target.checked)}
                             />
                           }
                           label="要求身份证验证"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requirePhone || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requirePhone', e.target.checked)}
                             />
                           }
                           label="要求联系电话"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireCoach || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireCoach', e.target.checked)}
                             />
                           }
                           label="要求指导教练信息"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireSchool || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireSchool', e.target.checked)}
                             />
                           }
                           label="要求学校信息"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireInsurance || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireInsurance', e.target.checked)}
                             />
                           }
                           label="要求保险确认"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireMedicalCertificate || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireMedicalCertificate', e.target.checked)}
                             />
                           }
                           label="要求体检证明"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireParentConsent || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireParentConsent', e.target.checked)}
                             />
                           }
                           label="要求家长同意书"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireRiskWaiver || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireRiskWaiver', e.target.checked)}
                             />
                           }
                           label="自愿参赛责任及风险告知书"
                         />
                       </Grid>
                       <Grid item xs={12} sm={6}>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.participantRequirements?.requireStudentInfoDetails || false}
                               onChange={(e) => handleNestedChange('participantRequirements', 'requireStudentInfoDetails', e.target.checked)}
                             />
                           }
                           label="学籍基本信息"
                         />
                       </Grid>
                     </Grid>
                   </FormGroup>
     
                   <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>报名限制规则</Typography>
                   <Grid container spacing={2}>
                     <Grid item xs={12} sm={4}>
                       <TextField
                         fullWidth
                         type="number"
                         label="每人最多报名项目数"
                         value={competition.registrationRules?.maxEventsPerParticipant || 3}
                         onChange={(e) => handleNestedChange('registrationRules', 'maxEventsPerParticipant', e.target.value)}
                       />
                     </Grid>
                     <Grid item xs={12} sm={4}>
                       <TextField
                         fullWidth
                         type="number"
                         label="团体最小人数"
                         value={competition.registrationRules?.minGroupSize || 1}
                         onChange={(e) => handleNestedChange('registrationRules', 'minGroupSize', e.target.value)}
                       />
                     </Grid>
                     <Grid item xs={12} sm={4}>
                       <TextField
                         fullWidth
                         type="number"
                         label="团体最大人数"
                         value={competition.registrationRules?.maxGroupSize || 12}
                         onChange={(e) => handleNestedChange('registrationRules', 'maxGroupSize', e.target.value)}
                       />
                     </Grid>
                     
                     <Grid item xs={12}>
                       <FormGroup row>
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.registrationRules?.allowTraditionalWeaponDuplicate || false}
                               onChange={(e) => handleNestedChange('registrationRules', 'allowTraditionalWeaponDuplicate', e.target.checked)}
                             />
                           }
                           label="允许传统器械重复报名"
                           sx={{ mr: 4 }}
                         />
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.registrationRules?.allowTraditionalFistDuplicate || false}
                               onChange={(e) => handleNestedChange('registrationRules', 'allowTraditionalFistDuplicate', e.target.checked)}
                             />
                           }
                           label="允许传统拳术重复报名"
                           sx={{ mr: 4 }}
                         />
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.registrationRules?.requireDistrictRegistration || false}
                               onChange={(e) => handleNestedChange('registrationRules', 'requireDistrictRegistration', e.target.checked)}
                             />
                           }
                           label="要求以区为单位报名"
                           sx={{ mr: 4 }}
                         />
                         <FormControlLabel
                           control={
                             <Checkbox
                               checked={competition.registrationRules?.schoolBasedRegistration || false}
                               onChange={(e) => handleNestedChange('registrationRules', 'schoolBasedRegistration', e.target.checked)}
                             />
                           }
                           label="要求学校单位报名"
                         />
                       </FormGroup>
                     </Grid>
                   </Grid>
                   
                   <Divider sx={{ my: 3 }} />
                   
                   <Typography variant="h6" sx={{ mb: 2 }}>比赛报名表/附件</Typography>
                   <Box sx={{ mb: 3 }}>
                     <Button
                       component="label"
                       variant="outlined"
                       startIcon={<CloudUploadIcon />}
                       sx={{ mt: 1 }}
                     >
                       上传文件
                       <input
                         type="file"
                         hidden
                         onChange={handleFileChange}
                         accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                       />
                     </Button>
                     {selectedFile && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        已选择: {selectedFile.name}
                      </Typography>
                    )}
                    {fileError && (
                      <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                        {fileError}
                      </Typography>
                    )}
                    {competition.registrationForm && !selectedFile && (
                       <Typography variant="body2" sx={{ mt: 1 }}>
                         当前文件: {competition.registrationForm.originalName}
                       </Typography>
                     )}
                   </Box>

                   <Divider sx={{ my: 3 }} />
                   <Typography variant="h6" sx={{ mb: 2 }}>发布设置</Typography>
                   <Grid container spacing={2}>
                     <Grid item xs={12} sm={6}>
                       <FormControl fullWidth>
                         <InputLabel id="status-select-label">比赛状态</InputLabel>
                         <Select
                           labelId="status-select-label"
                           id="status-select"
                           value={competition.status}
                           label="比赛状态"
                           onChange={(e) => setCompetition({ ...competition, status: e.target.value })}
                         >
                           <MenuItem value="draft">草稿 (仅管理员可见)</MenuItem>
                           <MenuItem value="registration">开启报名 (用户可报名)</MenuItem>
                           <MenuItem value="ongoing">进行中</MenuItem>
                           <MenuItem value="completed">已结束</MenuItem>
                           <MenuItem value="cancelled">已取消</MenuItem>
                         </Select>
                         <FormHelperText>
                           设置为"开启报名"后，参赛者即可看到并报名参加比赛。
                         </FormHelperText>
                       </FormControl>
                     </Grid>
                   </Grid>
                 </Box>
              )}

              {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
              
              <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                <Button
                  color="inherit"
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  sx={{ mr: 1 }}
                >
                  上一步
                </Button>
                {isCreate && (
                  <Button
                    color="primary"
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={handleManualSave}
                    sx={{ mr: 1 }}
                  >
                    保存进度
                  </Button>
                )}
                <Box sx={{ flex: '1 1 auto' }} />
                <Button onClick={handleSubmit} disabled={loading}>
                  {activeStep === steps.length - 1 ? (loading ? <CircularProgress size={24} /> : (isCreate ? '创建比赛' : '保存更改')) : '下一步'}
                </Button>
              </Box>
            </form>
          </Paper>
          <Snackbar
            open={draftLoaded}
            autoHideDuration={6000}
            onClose={() => setDraftLoaded(false)}
            message="已加载上次未完成的草稿"
          />
          <Snackbar
            open={saveSuccess}
            autoHideDuration={3000}
            onClose={() => setSaveSuccess(false)}
            message="草稿保存成功"
          />
        </Box>
      );
    }

    // Display competition details
    const getStatusInfo = (status) => {
      const statusMap = {
        draft: { label: '草稿', color: 'default' },
        registration: { label: '报名中', color: 'success' },
        ongoing: { label: '进行中', color: 'primary' },
        completed: { label: '已结束', color: 'info' },
        cancelled: { label: '已取消', color: 'error' }
      };
      return statusMap[status] || { label: status, color: 'default' };
    };

    // 增加安全性检查，确保 competition 不为 null
    if (!competition) {
      return (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <Typography color="textSecondary">比赛信息正在加载或不存在</Typography>
        </Box>
      );
    }

    const isAdmin = user?.roles?.includes('admin');
    const isChiefReferee = user?.roles?.includes('chief_referee');
    const isReferee = user?.roles?.includes('referee');
    const isAdminOrOrganizer = isAdmin || isChiefReferee;

    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
          <Box>
            {!isAdminOrOrganizer && user && competition?.status === 'registration' && (
              <Button 
                variant="contained" 
                color="primary"
                size="large"
                onClick={() => navigate(`/competitions/${id}/register`)}
                sx={{ mr: 1 }}
              >
                立即报名
              </Button>
            )}
            {(isAdmin || isChiefReferee || isReferee) && (
              <Button 
                variant="outlined" 
                startIcon={<AssessmentIcon />}
                onClick={() => navigate(`/competitions/${id}/score`)}
                sx={{ mr: 1 }}
              >
                比赛打分
              </Button>
            )}
            {(isAdmin || isChiefReferee) && competition?.awardRules?.enabled && (
              <Button
                variant="outlined"
                startIcon={<EmojiEventsIcon />}
                onClick={() => navigate(`/competitions/${id}/awards`)}
                sx={{ mr: 1 }}
              >
                {'\u734e\u9879\u7edf\u8ba1'}
              </Button>
            )}
            {(isAdmin || isChiefReferee) && (
              <Button 
                variant="outlined" 
                startIcon={<ShuffleIcon />}
                onClick={() => navigate(`/competitions/${id}/start-list`)}
                sx={{ mr: 1 }}
              >
                赛程编排
              </Button>
            )}
            {isAdmin && (
              <>
                <Button 
                  variant="outlined" 
                  startIcon={<PeopleIcon />}
                  onClick={() => navigate(`/admin/participants?competitionId=${id}`)}
                  sx={{ mr: 1 }}
                >
                  查看报名情况
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/admin/competitions/edit/${id}`)}
                  sx={{ mr: 1 }}
                >
                  编辑比赛
                </Button>
                <Button 
                  variant="contained" 
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteClick}
                >
                  删除比赛
                </Button>
              </>
            )}
          </Box>
        </Box>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <CardMedia
                component="img"
                height="300"
                image={competition.coverImage ? `/uploads/competitions/${competition.coverImage}` : '/assets/placeholder-cover.svg'}
                alt={competition.name}
                sx={{ borderRadius: 1, objectFit: 'cover' }}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="h4" gutterBottom>{competition.name}</Typography>
              <Box sx={{ mb: 2 }}>
                <Chip 
                  label={getStatusInfo(competition.status).label} 
                  color={getStatusInfo(competition.status).color} 
                  sx={{ mr: 1 }}
                />
                <Chip label={competition.type} variant="outlined" />
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>
                <strong>比赛时间：</strong> 
                {competition.startDate || '待定'} 
                {' - '} 
                {competition.endDate || '待定'}
              </Typography>
               <Typography variant="subtitle1" gutterBottom>
                <strong>报名截止：</strong> 
                {competition.registrationDeadline || '待定'}
              </Typography>
               <Typography variant="subtitle1" gutterBottom>
                <strong>地点：</strong> {competition.location || '待定'}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>比赛规程</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {competition.description}
              </Typography>

              {competition.registrationForm && competition.registrationForm.filename && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    href={`/api/competitions/${id}/registration-form`}
                    target="_blank"
                    component="a"
                  >
                    下载报名表 ({competition.registrationForm.originalName})
                  </Button>
                </Box>
              )}
            </Grid>
          </Grid>
        </Paper>
        
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>比赛项目</Typography>
          {competition.events && competition.events.length > 0 ? (
            <Grid container spacing={2}>
              {competition.events.map((event, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6">{event.name}</Typography>
                      <Typography color="textSecondary" gutterBottom>
                        {event.category} {event.subcategory && `- ${event.subcategory}`}
                      </Typography>
                      {event.isCombinedEvent && (
                        <Box sx={{ mt: 1, mb: 1, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                          <Typography variant="caption" color="primary.dark" fontWeight="bold">
                            合并项目 (报名一项即自动报名以下子项)
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {event.subEvents?.map((sub, idx) => (
                              <Chip key={idx} label={sub} size="small" color="primary" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {event.ageGroups && event.ageGroups.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                            {event.ageGroups.map((group, idx) => (
                                <Chip 
                                    key={idx} 
                                    label={typeof group === 'string' ? group : group.name} 
                                    size="small" 
                                    sx={{ mr: 0.5, mb: 0.5 }} 
                                />
                            ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography color="textSecondary">暂无比赛项目</Typography>
          )}

          {!isAdminOrOrganizer && user && competition?.status === 'registration' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button 
                variant="contained" 
                color="primary"
                size="large"
                onClick={() => navigate(`/competitions/${id}/register`)}
              >
                立即报名
              </Button>
            </Box>
          )}
        </Paper>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button variant="outlined" onClick={() => navigate('/competitions')}>
            返回列表
          </Button>
        </Box>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              确定要删除比赛 "{competition.name}" 吗？此操作无法撤销。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
              取消
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" disabled={deleteLoading}>
              {deleteLoading ? <CircularProgress size={24} /> : '删除'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
