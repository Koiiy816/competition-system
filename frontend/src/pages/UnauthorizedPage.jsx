import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';

/**
 * 未授权页面 - 当用户尝试访问没有权限的页面时显示
 */
const UnauthorizedPage = () => {
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
        <BlockIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
        
        <Typography variant="h4" component="h1" gutterBottom>
          访问被拒绝
        </Typography>
        
        <Typography variant="body1" paragraph sx={{ mb: 4 }}>
          很抱歉，您没有权限访问此页面。如果您认为这是一个错误，请联系系统管理员。
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/"
          >
            返回首页
          </Button>
          
          <Button
            variant="outlined"
            component={RouterLink}
            to="/dashboard"
          >
            前往控制面板
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default UnauthorizedPage;