import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const TestPage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom color="primary">
          测试页面正常显示
        </Typography>
        <Typography variant="h5" paragraph>
          如果您能看到这个页面，说明前端路由工作正常
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button 
            variant="contained" 
            color="primary" 
            size="large" 
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            返回首页
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            size="large" 
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default TestPage;