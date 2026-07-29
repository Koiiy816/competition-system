import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Typography
} from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import competitionService from '../services/competitionService';

const CheckInPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [competitions, setCompetitions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await competitionService.getCompetitions();
        setCompetitions(response.data || []);
      } catch (err) {
        setError(err.message || '加载比赛列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitions();
  }, []);

  const availableCompetitions = useMemo(() => {
    return competitions.filter(competition => ['registration', 'ongoing'].includes(competition.status));
  }, [competitions]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        检录管理
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        请选择要进入检录的比赛。进入后可按场次对参赛者进行检录。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {availableCompetitions.length === 0 ? (
        <Alert severity="info">当前没有可检录的比赛。</Alert>
      ) : (
        <Grid container spacing={3}>
          {availableCompetitions.map(competition => (
            <Grid item xs={12} md={6} key={competition._id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', pr: 2 }}>
                      {competition.name}
                    </Typography>
                    <Chip
                      size="small"
                      color={competition.status === 'ongoing' ? 'success' : 'primary'}
                      label={competition.status === 'ongoing' ? '进行中' : '报名中'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                    <Chip size="small" icon={<EmojiEventsIcon />} label={competition.type || '比赛'} />
                    {competition.location && <Chip size="small" label={competition.location} />}
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    开始时间：{competition.startDate ? new Date(competition.startDate).toLocaleString('zh-CN') : '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    结束时间：{competition.endDate ? new Date(competition.endDate).toLocaleString('zh-CN') : '-'}
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<HowToRegIcon />}
                    onClick={() => navigate(`/competitions/${competition._id}/check-in`)}
                  >
                    进入检录
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default CheckInPage;
