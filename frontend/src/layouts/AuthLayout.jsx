import React from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Container, Box, Paper, Typography, Link } from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';

const AuthLayout = () => {
  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <SportsSoccerIcon sx={{ fontSize: 40, mr: 1, color: 'primary.main' }} />
          <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold' }}>
            竞赛系统
          </Typography>
        </Box>
        
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 2,
          }}
        >
          <Outlet />
        </Paper>
        
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" align="center">
            {'© '}
            {new Date().getFullYear()}
            {' 赛易通. 保留所有权利。'}
          </Typography>
          <Link component={RouterLink} to="/" variant="body2" sx={{ mt: 1, display: 'block' }}>
            返回首页
          </Link>
        </Box>
      </Box>
    </Container>
  );
};

export default AuthLayout;