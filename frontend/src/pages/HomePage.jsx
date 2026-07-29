import React from 'react';
import { Box, Typography, Button, Container, Grid, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Paper
          sx={{
            position: 'relative',
            color: '#fff',
            mb: 4,
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', // 使用深蓝色渐变代替图片
            borderRadius: 3,
            overflow: 'hidden',
            height: '400px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              backgroundColor: 'rgba(0,0,0,0.1)',
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)' // 添加微弱的光晕
            }}
          />
          <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, p: 4, textAlign: 'center' }}>
            <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.3)', letterSpacing: '4px' }}>
              赛易通
            </Typography>
            <Typography variant="h5" paragraph sx={{ mb: 4, opacity: 0.9, fontWeight: 400, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              一站式管理各类运动比赛的报名、赛程安排、成绩记录和排名的专业平台
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => navigate('/competitions')}
              sx={{ 
                py: 1.5, 
                px: 4, 
                fontSize: '1.1rem',
                borderRadius: '30px',
                backgroundColor: '#fff',
                color: '#1e3c72',
                fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                }
              }}
            >
              浏览比赛
            </Button>
          </Container>
        </Paper>

        <Typography variant="h4" component="h2" gutterBottom>
          系统功能
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <Typography variant="h6" gutterBottom>比赛管理</Typography>
              <Typography>创建和管理各类运动比赛，设置比赛规则和评分标准</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <Typography variant="h6" gutterBottom>参赛管理</Typography>
              <Typography>个人/团队报名，参赛资格审核，参赛者信息管理</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <Typography variant="h6" gutterBottom>赛程管理</Typography>
              <Typography>赛程创建和编辑，比赛日程安排，场地分配</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <Typography variant="h6" gutterBottom>成绩管理</Typography>
              <Typography>实时成绩录入，成绩审核和确认，排名计算</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button variant="outlined" color="primary" onClick={() => navigate('/test')}>
            测试页面
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default HomePage;