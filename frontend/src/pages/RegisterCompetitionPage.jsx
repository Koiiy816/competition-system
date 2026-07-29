import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Divider,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  CardMedia,
  Chip,
} from '@mui/material';
import {
  SportsSoccer as SportsSoccerIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Check as CheckIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import competitionService from '../services/competitionService';
import participantService from '../services/participantService';
import { PARTICIPANT_TAGS_HELPER_TEXT } from '../constants/participantTags';

const RegisterCompetitionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const districts = [
    '福田区',
    '罗湖区',
    '盐田区',
    '南山区',
    '宝安区',
    '龙岗区',
    '龙华区',
    '坪山区',
    '光明区',
    '大鹏新区',
    '深汕特别合作区'
  ];
  
  // 年级选项配置
  const gradeOptions = [
    { value: '一年级', label: '一年级', group: '小学乙组' },
    { value: '二年级', label: '二年级', group: '小学乙组' },
    { value: '三年级', label: '三年级', group: '小学乙组' },
    { value: '四年级', label: '四年级', group: '小学甲组' },
    { value: '五年级', label: '五年级', group: '小学甲组' },
    { value: '六年级', label: '六年级', group: '小学甲组' },
    { value: '初一', label: '初一', group: '初中组' },
    { value: '初二', label: '初二', group: '初中组' },
    { value: '初三', label: '初三', group: '初中组' },
    { value: '高一', label: '高一', group: '高中组' },
    { value: '高二', label: '高二', group: '高中组' },
    { value: '高三', label: '高三', group: '高中组' }
  ];
  
  // 状态管理
  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  
  // 文件上传相关状态
  const [templates, setTemplates] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    type: 'individual',
    teamName: '',
    members: [],
    event: '',
    schoolName: user?.profile?.organization || '',
    grade: '',
    gender: '',
    idCard: '',
    birthDate: '',
    phone: '',
    teamLeader: '',
    leaderPhone: '',
    coach: '',
    coachPhone: '',
    insuranceConfirmed: false,
    additionalInfo: {
      notes: ''
    }
  });
  
  // 表单错误
  const [formErrors, setFormErrors] = useState({});

  // 比赛项目数据结构
  const eventOptions = {
    '高中组': {
      '拳术类': [
        '自选长拳',
        '自选南拳', 
        '自选太极拳',
        '咏春拳（非咏春拳12式）'
      ],
      '短器械': [
        '自选刀术',
        '自选剑术',
        '自选南刀',
        '自选太极剑'
      ],
      '长器械': [
        '自选棍术',
        '自选枪术',
        '自选南棍'
      ],
      '集体项目': [
        '咏春拳12式（12人）'
      ]
    },
    '初中组': {
      '拳术类': [
        '第三套国际武术竞赛长拳',
        '第三套国际武术竞赛南拳',
        '第三套国际武术竞赛太极拳',
        '咏春拳（非咏春拳12式）'
      ],
      '短器械': [
        '第三套国际武术竞赛刀术',
        '第三套国际武术竞赛剑术',
        '第三套国际武术竞赛南刀',
        '第三套国际武术竞赛太极剑'
      ],
      '长器械': [
        '第三套国际武术竞赛棍术',
        '第三套国际武术竞赛枪术',
        '第三套国际武术竞赛南棍'
      ],
      '集体项目': [
        '咏春拳12式（12人）'
      ]
    },
    '小学甲组': {
      '拳术类': [
        '第三套国际武术竞赛长拳',
        '第三套国际武术竞赛南拳',
        '第三套国际武术竞赛太极拳',
        '自选长拳',
        '传统拳术',
        '咏春拳（非咏春拳12式）'
      ],
      '短器械': [
        '第三套国际武术竞赛刀术',
        '第三套国际武术竞赛剑术',
        '第三套国际武术竞赛南刀',
        '第三套国际武术竞赛太极剑'
      ],
      '长器械': [
        '第三套国际武术竞赛棍术',
        '第三套国际武术竞赛枪术',
        '第三套国际武术竞赛南棍'
      ],
      '传统器械': [
        '传统器械'
      ],
      '集体项目': [
        '咏春拳12式（12人）'
      ]
    },
    '小学乙组': {
      '拳术类': [
        '传统拳术',
        '少年规定拳',
        '自选长拳',
        '初级南拳',
        '42式太极拳',
        '咏春拳（非咏春拳12式）'
      ],
      '短器械': [
        '初级刀术',
        '初级剑术',
        '自选南刀',
        '42式太极剑'
      ],
      '长器械': [
        '初级棍术',
        '初级枪术',
        '自选南棍'
      ],
      '传统器械': [
        '传统器械'
      ],
      '集体项目': [
        '咏春拳12式（12人）'
      ]
    }
  };

  // 根据年级获取对应的组别
  const getGradeGroup = (grade) => {
    // 如果是动态配置的年龄组别，直接返回
    if (competition?.ageGroups?.some(g => g.name === grade)) {
      return grade;
    }
    const gradeOption = gradeOptions.find(option => option.value === grade);
    return gradeOption ? gradeOption.group : null;
  };

  // 获取当前年级可选的比赛项目
  const getAvailableEvents = () => {
    // 优先使用动态配置的比赛项目
    if (competition?.events?.length > 0) {
      const selectedGroup = formData.grade;
      const selectedGender = formData.gender;
      
      if (!selectedGroup) return [];
      
      return competition.events.filter(event => {
        // 检查年龄组别
        const ageMatch = event.ageGroups && event.ageGroups.includes(selectedGroup);
        
        // 检查性别限制
        let genderMatch = true;
        if (selectedGender && event.genderRestriction && event.genderRestriction !== 'both') {
          genderMatch = event.genderRestriction === selectedGender;
        }
        
        return ageMatch && genderMatch;
      }).map(event => ({
        category: event.category || '',
        name: event.name,
        displayName: event.name,
        isGroupEvent: event.isGroupEvent || false
      }));
    }

    const gradeGroup = getGradeGroup(formData.grade);
    if (!gradeGroup || !eventOptions[gradeGroup]) {
      return [];
    }
    
    const events = [];
    const categories = eventOptions[gradeGroup];
    
    Object.keys(categories).forEach(category => {
      categories[category].forEach(event => {
        events.push({
          category,
          name: event,
          displayName: `${category} - ${event}`
        });
      });
    });
    
    return events;
  };



  // 获取比赛详情
  useEffect(() => {
    const fetchCompetitionDetails = async () => {
      setLoading(true);
      setError('');
      
      try {
        const response = await competitionService.getCompetition(id);
        setCompetition(response.data);
        
        // 设置默认参赛类型
        if (response.data.participantType !== 'both') {
          setFormData(prev => ({
            ...prev,
            type: response.data.participantType
          }));
        }
        
        // 获取报名表模板
        await fetchTemplates();
      } catch (error) {
        setError(error.message || '获取比赛详情失败');
        console.error('获取比赛详情失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // 检查用户是否已登录
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: `/competitions/${id}/register` } });
      return;
    }
    
    fetchCompetitionDetails();
  }, [id, isAuthenticated, navigate]);
  
  // 获取报名表模板
  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/competitions/${id}/templates`);
      
      // 添加更严格的 Content-Type 检查
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim() !== '') {
            try {
              const data = JSON.parse(text);
              setTemplates(data.data || []);
            } catch (e) {
              console.warn('解析模板 JSON 失败:', e);
            }
          }
        }
      } else {
        console.warn('后端未返回 JSON，跳过模板解析。ContentType:', contentType);
      }
    } catch (error) {
      console.warn('获取模板接口请求失败 (可能接口未实现):', error);
    }
  };
  
  // 处理文件选择
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setFileError('');
    
    if (!file) {
      setSelectedFile(null);
      return;
    }
    
    // 检查文件类型
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setFileError('不支持的文件类型。请上传 PDF、Word 文档或图片文件。');
      setSelectedFile(null);
      return;
    }
    
    // 检查文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setFileError('文件大小不能超过 10MB');
      setSelectedFile(null);
      return;
    }
    
    setSelectedFile(file);
  };
  
  // 下载模板
  const handleDownloadTemplate = async (templateId) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `报名表模板.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('下载模板失败:', error);
    }
  };
  
  // 下载报名表
  const handleDownloadRegistrationForm = async () => {
    try {
      const response = await fetch(`/api/competitions/${id}/registration-form`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${competition.name}_报名表`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '下载报名表失败');
      }
    } catch (error) {
      console.error('下载报名表失败:', error);
      setError('下载报名表失败，请稍后重试');
    }
  };
  
  // 处理表单变更
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    // 如果年级发生变化，清空比赛项目选择
    if (name === 'grade') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        event: '' // 清空比赛项目
      }));
    } else if (name === 'event') {
      // 不再强制切换到team模式，保持用户的原始填写逻辑
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (name === 'idCard') {
      let updates = { [name]: value };
      
      // 自动提取18位身份证信息 (支持15位转18位后的标准18位身份证)
      if (value && value.length === 18 && /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(value)) {
        // 提取出生日期
        const year = value.substring(6, 10);
        const month = value.substring(10, 12);
        const day = value.substring(12, 14);
        const birthDateStr = `${year}-${month}-${day}`;
        
        // 提取性别 (第17位奇数男，偶数女)
        const genderDigit = parseInt(value.substring(16, 17), 10);
        const genderStr = genderDigit % 2 === 1 ? 'male' : 'female';
        
        updates.birthDate = birthDateStr;
        updates.gender = genderStr;
        updates.event = ''; // 组别或性别变化，清空已选比赛项目
        
        // 计算年龄组别
         const birthDate = new Date(birthDateStr);
         const currentYear = new Date().getFullYear();
         const age = currentYear - birthDate.getFullYear();
         
         let autoGrade = formData.grade;
         // 根据比赛已有的组别进行智能匹配
         if (competition && competition.ageGroups && competition.ageGroups.length > 0) {
           const availableGroups = competition.ageGroups.map(g => g.name);
           if (age <= 6 && availableGroups.includes('U6组')) autoGrade = 'U6组';
           else if (age <= 10 && availableGroups.includes('U10组')) autoGrade = 'U10组';
           else if (age <= 13 && availableGroups.includes('U13组')) autoGrade = 'U13组';
           else if (age <= 16 && availableGroups.includes('U16组')) autoGrade = 'U16组';
           else {
             // 如果没匹配上标准规则，尝试寻找包含当前年龄的组别，或默认选中第一个
             autoGrade = availableGroups.find(g => g.includes(age.toString())) || availableGroups[0] || '';
           }
         } else {
           if (age <= 6) autoGrade = 'U6组';
           else if (age <= 9) autoGrade = 'U9组';
           else if (age <= 11) autoGrade = 'U11组';
           else if (age <= 13) autoGrade = 'U13组';
           else if (age <= 16) autoGrade = 'U16组';
           else autoGrade = '成人组';
         }
         
         updates.grade = autoGrade;
      }
      
      setFormData(prev => ({
        ...prev,
        ...updates
      }));
    } else if (name === 'birthDate') {
      // 根据出生日期自动计算年龄组别
      let autoGrade = formData.grade;
      if (value) {
        const birthDate = new Date(value);
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthDate.getFullYear();
        
        // 根据比赛已有的组别进行智能匹配
        if (competition && competition.ageGroups && competition.ageGroups.length > 0) {
          const availableGroups = competition.ageGroups.map(g => g.name);
          if (age <= 6 && availableGroups.includes('U6组')) autoGrade = 'U6组';
          else if (age <= 10 && availableGroups.includes('U10组')) autoGrade = 'U10组';
          else if (age <= 13 && availableGroups.includes('U13组')) autoGrade = 'U13组';
          else if (age <= 16 && availableGroups.includes('U16组')) autoGrade = 'U16组';
          else {
            autoGrade = availableGroups.find(g => g.includes(age.toString())) || availableGroups[0] || '';
          }
        } else {
          if (age <= 6) autoGrade = 'U6组';
          else if (age <= 9) autoGrade = 'U9组';
          else if (age <= 11) autoGrade = 'U11组';
          else if (age <= 13) autoGrade = 'U13组';
          else if (age <= 16) autoGrade = 'U16组';
          else autoGrade = '成人组';
        }
      }

      setFormData(prev => ({
        ...prev,
        [name]: value,
        grade: autoGrade,
        event: '' // 组别可能变化，清空比赛项目
      }));
    } else if (name === 'gender') {
      // 如果性别发生变化，也应该清空比赛项目选择，因为可能某些项目有性别限制
      setFormData(prev => ({
        ...prev,
        [name]: value,
        event: '' // 清空比赛项目
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // 清除错误
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // 如果年级或性别变化，也清除比赛项目的错误
    if ((name === 'grade' || name === 'gender') && formErrors.event) {
      setFormErrors(prev => ({
        ...prev,
        event: ''
      }));
    }
  };
  
  // 处理附加信息变更
  const handleAdditionalInfoChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      additionalInfo: {
        ...prev.additionalInfo,
        [name]: value
      }
    }));
    
    // 清除错误
    if (formErrors[`additionalInfo.${name}`]) {
      setFormErrors(prev => ({
        ...prev,
        [`additionalInfo.${name}`]: ''
      }));
    }
  };
  
  // 验证表单
  const validateForm = () => {
    const errors = {};
    
    // 姓名必填
    if (formData.type === 'individual' && (!formData.name || !formData.name.trim())) {
      errors.name = '请输入姓名';
    }

    if (formData.type === 'team' && !formData.teamName) {
      errors.teamName = '请输入团队名称';
    }
  
    // 性别必选
    if (!formData.gender) {
      errors.gender = '请选择性别';
    }

    // 保险确认必选
    if (formData.insuranceConfirmed !== true) {
      errors.insuranceConfirmed = '参赛必须办理保险';
    }
  
    // 学校与年级必填
    if (!formData.schoolName || !formData.schoolName.trim()) {
      errors.schoolName = '请输入所属单位';
    }
    if (!formData.grade || !formData.grade.trim()) {
      errors.grade = '请输入年龄组别';
    }
  
    // 比赛项目必选
    if (!formData.event || !formData.event.trim()) {
      errors.event = '请选择比赛项目';
    }
    
    // 验证其他必填字段
    // 这里可以根据比赛的具体要求添加更多验证
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // 处理下一步
  const handleNext = () => {
    if (activeStep === 0 && !validateForm()) {
      return;
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };
  
  // 处理上一步
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  // 提交报名
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    setError('');
    
    try {
      // 创建 FormData 对象以支持文件上传
      const submitData = new FormData();
      
      // 添加表单数据
      Object.keys(formData).forEach(key => {
        if (key === 'additionalInfo') {
          submitData.append(key, JSON.stringify(formData[key]));
        } else if (key === 'members') {
          // 如果 members 为空数组，不发送或发送空数组的 JSON 字符串
          if (formData[key] && formData[key].length > 0) {
            submitData.append(key, JSON.stringify(formData[key]));
          }
        } else {
          submitData.append(key, formData[key]);
        }
      });
      
      // 查找所选比赛项目的 category
      const availableEvents = getAvailableEvents();
      const selectedEventObj = availableEvents.find(e => e.name === formData.event);
      if (selectedEventObj && selectedEventObj.category) {
        submitData.append('eventCategory', selectedEventObj.category);
      }
      
      // 计算并添加 ageGroup
      let ageGroup = '';
      if (competition && competition.ageGroups && competition.ageGroups.some(g => g.name === formData.grade)) {
         ageGroup = formData.grade; 
      } else {
         ageGroup = getGradeGroup(formData.grade);
      }
      if (ageGroup) {
        submitData.append('ageGroup', ageGroup);
      }

      // 添加文件（如果有选择）
      if (selectedFile) {
        submitData.append('registrationForm', selectedFile);
      }
      
      // 使用 fetch 直接发送请求以支持文件上传
      const response = await fetch(`/api/competitions/${id}/participants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: submitData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '报名失败');
      }
      
      setCompleted(true);
      
      // 延迟导航到比赛详情页
      setTimeout(() => {
        navigate(`/competitions/${id}`);
      }, 3000);
    } catch (error) {
      setError(error.message || '报名失败');
    } finally {
      setSubmitting(false);
    }
  };
  
  // 获取比赛状态的中文名称和颜色
  const getStatusInfo = (status) => {
    const statusMap = {
      'draft': { name: '草稿', color: 'default' },
      'registration': { name: '报名中', color: 'primary' },
      'ongoing': { name: '进行中', color: 'success' },
      'completed': { name: '已结束', color: 'secondary' },
      'cancelled': { name: '已取消', color: 'error' }
    };
    
    return statusMap[status] || { name: status, color: 'default' };
  };
  
  // 获取参赛类型的中文名称和图标
  const getTypeInfo = (type) => {
    const typeMap = {
      'individual': { name: '个人', icon: <PersonIcon /> },
      'team': { name: '团队', icon: <GroupIcon /> }
    };
    
    return typeMap[type] || { name: type, icon: null };
  };
  
  // 步骤标题
  const steps = ['基本信息', '确认报名'];
  
  // 渲染步骤内容
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderBasicInfoForm();
      case 1:
        return renderConfirmation();
      default:
        return '未知步骤';
    }
  };
  
  // 渲染基本信息表单
  const renderBasicInfoForm = () => {
    if (!competition) return null;
    
    return (
      <Grid container spacing={3}>
        {/* 参赛类型选择 - 已移除 */}
        {/* {competition.participantType === 'both' && (
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="type-label">参赛类型</InputLabel>
              <Select
                labelId="type-label"
                id="type"
                name="type"
                value={formData.type}
                label="参赛类型"
                onChange={handleFormChange}
              >
                <MenuItem value="individual">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PersonIcon sx={{ mr: 1 }} />
                    个人
                  </Box>
                </MenuItem>
                <MenuItem value="team">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <GroupIcon sx={{ mr: 1 }} />
                    团队
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
        )} */}

        {/* 姓名/团队名称 */}
        {formData.type === 'team' && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="团队名称"
              name="teamName"
              value={formData.teamName}
              onChange={handleFormChange}
              error={!!formErrors.teamName}
              helperText={formErrors.teamName}
              required
            />
          </Grid>
        )}
        
        {/* 个人信息 */}
        {formData.type === 'individual' && (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="姓名"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                error={!!formErrors.name}
                helperText={formErrors.name || '参赛者姓名'}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="邮箱"
                value={user?.email || ''}
                disabled
              />
            </Grid>
          </>
        )}

        {/* 性别选择 */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel id="gender-label">性别</InputLabel>
            <Select
              labelId="gender-label"
              id="gender"
              name="gender"
              value={formData.gender}
              label="性别"
              onChange={handleFormChange}
              error={!!formErrors.gender}
            >
              <MenuItem value="male">男</MenuItem>
              <MenuItem value="female">女</MenuItem>
            </Select>
            {formErrors.gender && (
              <FormHelperText error>{formErrors.gender}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        {/* 身份证号码 */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="身份证号码"
            name="idCard"
            value={formData.idCard}
            onChange={handleFormChange}
            error={!!formErrors.idCard}
            helperText={formErrors.idCard || '比赛时需要验证身份证 (选填)'}
          />
        </Grid>

        {/* 领队信息 */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="领队姓名"
            name="teamLeader"
            value={formData.teamLeader}
            onChange={handleFormChange}
            error={!!formErrors.teamLeader}
            helperText={formErrors.teamLeader}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="领队电话"
            name="leaderPhone"
            value={formData.leaderPhone}
            onChange={handleFormChange}
            error={!!formErrors.leaderPhone}
            helperText={formErrors.leaderPhone}
          />
        </Grid>

        {/* 指导教练 */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="教练姓名"
            name="coach"
            value={formData.coach}
            onChange={handleFormChange}
            error={!!formErrors.coach}
            helperText={formErrors.coach}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="教练电话"
            name="coachPhone"
            value={formData.coachPhone}
            onChange={handleFormChange}
            error={!!formErrors.coachPhone}
            helperText={formErrors.coachPhone}
          />
        </Grid>
        
        {/* 所属单位 */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="所属单位 (代表队名称)"
            name="schoolName"
            value={formData.schoolName}
            onChange={handleFormChange}
            error={!!formErrors.schoolName}
            helperText={formErrors.schoolName || '如：罗湖区、某某小学'}
            required
          />
        </Grid>

        {/* 出生日期 */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="出生日期"
            name="birthDate"
            type="date"
            InputLabelProps={{
              shrink: true,
            }}
            value={formData.birthDate}
            onChange={handleFormChange}
            error={!!formErrors.birthDate}
            helperText={formErrors.birthDate || '选择出生日期自动匹配组别'}
            required
          />
        </Grid>

        {/* 年级/年龄组别 (自动计算后禁用或只读，或者允许微调) */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel id="grade-label">年龄组别 (根据出生日期自动匹配)</InputLabel>
            <Select
              labelId="grade-label"
              id="grade"
              name="grade"
              value={formData.grade}
              label="年龄组别 (根据出生日期自动匹配)"
              onChange={handleFormChange}
              error={!!formErrors.grade}
              renderValue={(selected) => selected}
            >
              {competition?.ageGroups?.length > 0 ? (
                competition.ageGroups.map((group, index) => (
                  <MenuItem key={index} value={group.name}>
                    <Box>
                      <Typography variant="body1">{group.name}</Typography>
                      {group.description && (
                        <Typography variant="caption" color="text.secondary">
                          {group.description}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))
              ) : (
                gradeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))
              )}
            </Select>
            {formErrors.grade && (
              <FormHelperText error>{formErrors.grade}</FormHelperText>
            )}
          </FormControl>
        </Grid>
        
        {/* 比赛项目 */}
        <Grid item xs={12}>
          <FormControl fullWidth required>
            <InputLabel id="event-label">比赛项目</InputLabel>
            <Select
              labelId="event-label"
              id="event"
              name="event"
              value={formData.event}
              label="比赛项目"
              onChange={handleFormChange}
              error={!!formErrors.event}
              disabled={!formData.grade}
            >
              {getAvailableEvents().map((event, index) => (
                <MenuItem key={index} value={event.name}>
                  {event.displayName}
                </MenuItem>
              ))}
            </Select>
            {formErrors.event && (
              <FormHelperText error>{formErrors.event}</FormHelperText>
            )}
            {!formData.grade && (
              <FormHelperText>请先选择年龄组别</FormHelperText>
            )}
            {formData.grade && getAvailableEvents().length === 0 && (
              <FormHelperText>该组别暂无可选项目</FormHelperText>
            )}
          </FormControl>
        </Grid>
        
        {/* 附加信息 */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            附加信息
          </Typography>
          
          {/* 保险确认 */}
          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel id="insurance-label">保险确认</InputLabel>
            <Select
              labelId="insurance-label"
              id="insuranceConfirmed"
              name="insuranceConfirmed"
              value={formData.insuranceConfirmed}
              label="保险确认"
              onChange={handleFormChange}
              error={!!formErrors.insuranceConfirmed}
            >
              <MenuItem value={false}>未办理保险</MenuItem>
              <MenuItem value={true}>已办理保险</MenuItem>
            </Select>
            {formErrors.insuranceConfirmed && (
              <FormHelperText error>{formErrors.insuranceConfirmed}</FormHelperText>
            )}
            <FormHelperText>参赛必须办理保险</FormHelperText>
          </FormControl>
          
          <TextField
            fullWidth
            label="备注"
            name="notes"
            value={formData.additionalInfo.notes || ''}
            onChange={handleAdditionalInfoChange}
            multiline
            rows={4}
            sx={{ mb: 3 }}
            placeholder="请输入备注信息..."
            helperText={PARTICIPANT_TAGS_HELPER_TEXT}
          />
          
          {/* 报名表模板下载 */}
          {competition.registrationForm && competition.registrationForm.filename && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                比赛专用报名表下载
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                请下载此比赛专用的报名表，填写后上传
              </Typography>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                href={`/api/competitions/${competition._id}/registration-form`}
                target="_blank"
                component="a"
                sx={{ mr: 1, mb: 1 }}
              >
                下载报名表 ({competition.registrationForm.originalName || '报名表'})
              </Button>
            </Box>
          )}

          {templates.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                通用报名表模板下载
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                如果比赛没有提供专用报名表，您可以下载通用模板
              </Typography>
              {templates.map((template) => (
                <Button
                  key={template._id}
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownloadTemplate(template._id)}
                  sx={{ mr: 1, mb: 1 }}
                >
                  {template.name}
                </Button>
              ))}
            </Box>
          )}
          
          {/* 纸质版报名表上传 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              纸质版报名表上传（可选）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              请上传已填写的纸质版报名表（支持 PDF、Word 文档或图片格式，最大 10MB）
            </Typography>
            
            <input
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              id="registration-form-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="registration-form-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                sx={{ mb: 1 }}
              >
                选择文件
              </Button>
            </label>
            
            {selectedFile && (
              <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="body2">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </Typography>
                </Box>
              </Box>
            )}
            
            {fileError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {fileError}
              </Alert>
            )}
          </Box>
        </Grid>
      </Grid>
    );
  };
  
  // 渲染确认信息
  const renderConfirmation = () => {
    if (!competition) return null;
    
    const typeInfo = getTypeInfo(formData.type);
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          请确认您的报名信息
        </Typography>
        
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle1">
                比赛信息
              </Typography>
              <Divider sx={{ my: 1 }} />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                比赛名称
              </Typography>
              <Typography variant="body1">
                {competition.name}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                比赛时间
              </Typography>
              <Typography variant="body1">
                {new Date(competition.startDate).toLocaleDateString()} ~ {new Date(competition.endDate).toLocaleDateString()}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                比赛地点
              </Typography>
              <Typography variant="body1">
                {competition.location}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                报名截止日期
              </Typography>
              <Typography variant="body1">
                {new Date(competition.registrationDeadline).toLocaleDateString()}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
        
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle1">
                参赛信息
              </Typography>
              <Divider sx={{ my: 1 }} />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                参赛类型
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {typeInfo.icon}
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {typeInfo.name}
                </Typography>
              </Box>
            </Grid>
            
            {formData.type === 'team' && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  团队名称
                </Typography>
                <Typography variant="body1">
                  {formData.teamName}
                </Typography>
              </Grid>
            )}
            
            {formData.type === 'individual' && (
              <>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    参赛者姓名
                  </Typography>
                  <Typography variant="body1">
                    {formData.name}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    联系邮箱
                  </Typography>
                  <Typography variant="body1">
                    {user?.email}
                  </Typography>
                </Grid>
              </>
            )}

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                性别
              </Typography>
              <Typography variant="body1">
                {formData.gender === 'male' ? '男' : '女'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                身份证号码
              </Typography>
              <Typography variant="body1">
                {formData.idCard}
              </Typography>
            </Grid>

            {formData.teamLeader && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  领队姓名
                </Typography>
                <Typography variant="body1">
                  {formData.teamLeader}
                </Typography>
              </Grid>
            )}

            {formData.leaderPhone && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  领队电话
                </Typography>
                <Typography variant="body1">
                  {formData.leaderPhone}
                </Typography>
              </Grid>
            )}

            {formData.coach && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  教练姓名
                </Typography>
                <Typography variant="body1">
                  {formData.coach}
                </Typography>
              </Grid>
            )}

            {formData.coachPhone && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  教练电话
                </Typography>
                <Typography variant="body1">
                  {formData.coachPhone}
                </Typography>
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                保险确认
              </Typography>
              <Typography variant="body1">
                {formData.insuranceConfirmed ? '已办理保险' : '未办理保险'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                所属单位
              </Typography>
              <Typography variant="body1">
                {formData.schoolName}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                年龄组别
              </Typography>
              <Typography variant="body1">
                {formData.grade}
              </Typography>
            </Grid>
            
            {formData.event && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  比赛项目
                </Typography>
                <Typography variant="body1">
                  {formData.event}
                </Typography>
              </Grid>
            )}
            
            {formData.additionalInfo.notes && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  备注
                </Typography>
                <Typography variant="body1">
                  {formData.additionalInfo.notes}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      </Box>
    );
  };
  
  // 渲染完成页面
  const renderCompleted = () => {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CheckIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
        
        <Typography variant="h5" gutterBottom>
          报名成功！
        </Typography>
        
        <Typography variant="body1" paragraph>
          您已成功报名参加 {competition?.name}。
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          我们将审核您的报名信息，请留意邮件通知。
        </Typography>
        
        <Typography variant="body2" paragraph>
          正在跳转到比赛详情页...
        </Typography>
        
        <CircularProgress size={24} sx={{ mt: 2 }} />
      </Box>
    );
  };
  
  // 检查比赛是否可以报名
  const canRegister = competition && competition.status === 'registration' && !isAdmin;
  
  return (
    <Box>
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* 加载中 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* 比赛信息卡片 */}
          {competition && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5">
                  {competition.name}
                </Typography>
                <Chip 
                  label={getStatusInfo(competition.status).name} 
                  color={getStatusInfo(competition.status).color} 
                />
              </Box>
            </Paper>
          )}
          
          {/* 报名表单 */}
          {competition && canRegister ? (
            completed ? (
              renderCompleted()
            ) : (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" component="h1" gutterBottom>
                  报名参加比赛
                </Typography>
                
                <Stepper activeStep={activeStep} sx={{ mb: 4, pt: 2 }}>
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                
                <Box sx={{ mt: 2, mb: 4 }}>
                  {getStepContent(activeStep)}
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  {activeStep > 0 && (
                    <Button
                      onClick={handleBack}
                      disabled={submitting}
                    >
                      上一步
                    </Button>
                  )}
                  
                  {activeStep < steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                    >
                      下一步
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? <CircularProgress size={24} /> : '提交报名'}
                    </Button>
                  )}
                </Box>
              </Paper>
            )
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <SportsSoccerIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              
              <Typography variant="h5" gutterBottom>
                无法报名
              </Typography>
              
              <Typography variant="body1" paragraph>
                {isAdmin ? '管理员无需报名参加比赛。' : (!canRegister ? '该比赛当前不在报名阶段。' : '无法加载比赛信息。')}
              </Typography>
              
              <Button 
                variant="contained" 
                onClick={() => navigate('/competitions')}
                sx={{ mt: 2 }}
              >
                浏览其他比赛
              </Button>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default RegisterCompetitionPage;