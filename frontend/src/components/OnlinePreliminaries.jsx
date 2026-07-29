import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  Paper,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Star as StarIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Schedule as PendingIcon,
  VideoLibrary as VideoIcon,
  Assignment as ScoreIcon,
  Group as TeamIcon
} from '@mui/icons-material';

// 预赛状态定义
const PRELIMINARY_STATUS = {
  NOT_STARTED: { key: 'not_started', label: '未开始', color: 'default' },
  REGISTRATION_OPEN: { key: 'registration_open', label: '报名中', color: 'primary' },
  VIDEO_SUBMISSION: { key: 'video_submission', label: '视频提交中', color: 'info' },
  UNDER_REVIEW: { key: 'under_review', label: '评审中', color: 'warning' },
  COMPLETED: { key: 'completed', label: '已完成', color: 'success' }
};

// 视频提交状态
const SUBMISSION_STATUS = {
  PENDING: { key: 'pending', label: '待提交', color: 'default', icon: <PendingIcon /> },
  UPLOADED: { key: 'uploaded', label: '已上传', color: 'info', icon: <VideoIcon /> },
  UNDER_REVIEW: { key: 'under_review', label: '评审中', color: 'warning', icon: <ViewIcon /> },
  APPROVED: { key: 'approved', label: '通过', color: 'success', icon: <ApprovedIcon /> },
  REJECTED: { key: 'rejected', label: '未通过', color: 'error', icon: <RejectedIcon /> }
};

const OnlinePreliminaries = ({ 
  competition, 
  event, 
  userRole = 'participant',
  onStatusChange 
}) => {
  const [submissions, setSubmissions] = useState([]);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  // 预赛配置
  const preliminaryConfig = event?.preliminaryConfig || {
    enabled: false,
    maxParticipants: 200,
    videoRequirements: {
      maxDuration: 300, // 5分钟
      maxFileSize: 500, // 500MB
      formats: ['mp4', 'avi', 'mov'],
      resolution: '1080p'
    },
    submissionDeadline: null,
    reviewCriteria: [
      { name: '技术动作', weight: 40, maxScore: 10 },
      { name: '整体协调', weight: 30, maxScore: 10 },
      { name: '精神面貌', weight: 20, maxScore: 10 },
      { name: '创新性', weight: 10, maxScore: 10 }
    ]
  };

  // 获取预赛步骤
  const getPreliminarySteps = () => [
    {
      label: '报名参加预赛',
      description: '确认参加线上预赛',
      completed: submissions.length > 0
    },
    {
      label: '提交参赛视频',
      description: `在${preliminaryConfig.submissionDeadline}前提交视频`,
      completed: submissions.some(s => s.status !== 'pending')
    },
    {
      label: '等待评审结果',
      description: '评委将对提交的视频进行评分',
      completed: submissions.some(s => ['approved', 'rejected'].includes(s.status))
    },
    {
      label: '查看晋级结果',
      description: '根据评分确定是否晋级决赛',
      completed: submissions.some(s => s.finalResult)
    }
  ];

  // 处理视频上传
  const handleVideoUpload = async (file, teamInfo) => {
    setLoading(true);
    setUploadProgress(0);

    try {
      // 模拟上传进度
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 创建新的提交记录
      const newSubmission = {
        id: Date.now().toString(),
        teamName: teamInfo.teamName,
        participants: teamInfo.participants,
        videoFile: {
          name: file.name,
          size: file.size,
          uploadTime: new Date().toISOString()
        },
        status: 'uploaded',
        submissionTime: new Date().toISOString(),
        scores: [],
        averageScore: 0,
        finalResult: null
      };

      // 完成上传
      setTimeout(() => {
        setUploadProgress(100);
        setSubmissions(prev => [...prev, newSubmission]);
        setUploadDialog(false);
        setLoading(false);
      }, 1000);

    } catch (error) {
      console.error('视频上传失败:', error);
      setLoading(false);
    }
  };

  // 处理评分
  const handleScoring = async (submissionId, scores, comments) => {
    setLoading(true);

    try {
      const updatedSubmissions = submissions.map(submission => {
        if (submission.id === submissionId) {
          const newScore = {
            judgeId: 'current_judge',
            judgeName: '评委',
            scores: scores,
            totalScore: scores.reduce((sum, score) => sum + score.score, 0),
            comments: comments,
            scoreTime: new Date().toISOString()
          };

          const updatedScores = [...(submission.scores || []), newScore];
          const averageScore = updatedScores.reduce((sum, s) => sum + s.totalScore, 0) / updatedScores.length;

          return {
            ...submission,
            scores: updatedScores,
            averageScore: averageScore,
            status: 'under_review'
          };
        }
        return submission;
      });

      setSubmissions(updatedSubmissions);
      setReviewDialog(false);
    } catch (error) {
      console.error('评分失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 渲染上传对话框
  const renderUploadDialog = () => (
    <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle>提交参赛视频</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">视频要求：</Typography>
              <Typography variant="body2">
                • 时长不超过{Math.floor(preliminaryConfig.videoRequirements.maxDuration / 60)}分钟<br/>
                • 文件大小不超过{preliminaryConfig.videoRequirements.maxFileSize}MB<br/>
                • 支持格式：{preliminaryConfig.videoRequirements.formats.join(', ')}<br/>
                • 建议分辨率：{preliminaryConfig.videoRequirements.resolution}
              </Typography>
            </Alert>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="团队名称"
              placeholder="请输入团队名称"
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="参赛成员"
              placeholder="请输入所有参赛成员姓名，用逗号分隔"
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Box
              sx={{
                border: 2,
                borderColor: 'primary.main',
                borderStyle: 'dashed',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                点击或拖拽上传视频文件
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支持 {preliminaryConfig.videoRequirements.formats.join(', ')} 格式
              </Typography>
            </Box>
          </Grid>

          {uploadProgress > 0 && (
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  上传进度: {uploadProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setUploadDialog(false)}>取消</Button>
        <Button variant="contained" disabled={loading}>
          {loading ? '上传中...' : '提交视频'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // 渲染评分对话框
  const renderReviewDialog = () => (
    <Dialog open={reviewDialog} onClose={() => setReviewDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle>视频评分</DialogTitle>
      <DialogContent>
        {selectedSubmission && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6">{selectedSubmission.teamName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  参赛成员：{selectedSubmission.participants?.join(', ')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  提交时间：{new Date(selectedSubmission.submissionTime).toLocaleString()}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>评分标准</Typography>
              {preliminaryConfig.reviewCriteria.map((criteria, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    {criteria.name} (权重: {criteria.weight}%, 满分: {criteria.maxScore}分)
                  </Typography>
                  <Rating
                    max={criteria.maxScore}
                    precision={0.5}
                    size="large"
                  />
                </Box>
              ))}
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="评分说明"
                placeholder="请输入对该视频的评价和建议..."
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setReviewDialog(false)}>取消</Button>
        <Button variant="contained" disabled={loading}>
          {loading ? '提交中...' : '提交评分'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const currentStep = getPreliminarySteps().findIndex(step => !step.completed);

  return (
    <Box>
      {/* 预赛概览 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h6" gutterBottom>
                线上预赛 - {event?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {event?.isTeamEvent ? '集体项目' : '个人项目'} • 
                最多{preliminaryConfig.maxParticipants}人参加预赛
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1} justifyContent="flex-end">
                {userRole === 'organization' && (
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => setUploadDialog(true)}
                    disabled={!preliminaryConfig.enabled}
                  >
                    提交视频
                  </Button>
                )}
                {(userRole === 'referee' || userRole === 'chief_referee') && (
                  <Button
                    variant="outlined"
                    startIcon={<ScoreIcon />}
                    onClick={() => setReviewDialog(true)}
                  >
                    评分管理
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 预赛流程 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>预赛流程</Typography>
          <Stepper activeStep={currentStep} orientation="vertical">
            {getPreliminarySteps().map((step, index) => (
              <Step key={index} completed={step.completed}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* 提交记录 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>提交记录</Typography>
          
          {submissions.length === 0 ? (
            <Alert severity="info">
              暂无视频提交记录
            </Alert>
          ) : (
            <List>
              {submissions.map((submission, index) => (
                <React.Fragment key={submission.id}>
                  <ListItem>
                    <ListItemIcon>
                      {SUBMISSION_STATUS[submission.status.toUpperCase()]?.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2">
                            {submission.teamName}
                          </Typography>
                          <Chip
                            label={SUBMISSION_STATUS[submission.status.toUpperCase()]?.label}
                            color={SUBMISSION_STATUS[submission.status.toUpperCase()]?.color}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            提交时间：{new Date(submission.submissionTime).toLocaleString()}
                          </Typography>
                          {submission.averageScore > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              平均分：{submission.averageScore.toFixed(1)}分
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        onClick={() => {
                          setSelectedSubmission(submission);
                          setReviewDialog(true);
                        }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < submissions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* 对话框 */}
      {renderUploadDialog()}
      {renderReviewDialog()}
    </Box>
  );
};

export default OnlinePreliminaries;