import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';

/**
 * 404页面 - 当用户访问不存在的页面时显示
 */
const NotFoundPage = () => {
  return (
    <Container maxWidth="md">
      <Paper
        elevation={3}
        sx={{
          p: 4,
          mt: 8,
          borderRadius: 2,
          textAlign: 'center',
        }}
      >
        <SentimentDissatisfiedIcon sx={{ fontSize: 100, color: 'text.secondary', mb: 2 }} />
        
        <Typography variant="h3" component="h1" gutterBottom>
          404
        </Typography>
        
        <Typography variant="h5" component="h2" gutterBottom>
          页面未找到
        </Typography>
        
        <Typography variant="body1" paragraph sx={{ mb: 4 }}>
          很抱歉，您访问的页面不存在或已被移除。
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/"
            size="large"
          >
            返回首页
          </Button>
          
          <Button
            variant="outlined"
            component={RouterLink}
            to="/competitions"
            size="large"
          >
            浏览比赛
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default NotFoundPage;