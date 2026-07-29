import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Typography, Box, Divider
} from '@mui/material';

const ScoreInputModal = ({ open, onClose, onSave, participant, initialData, schedule }) => {
  const eventName = schedule?.name || participant?.event || '';

  // 使用数组存储5个裁判分
  const [scores, setScores] = useState(['', '', '', '', '']);
  const [deduction, setDeduction] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    if (open && initialData) {
      const savedScores = initialData.details?.scores || [];
      const newScores = [...savedScores];
      while (newScores.length < 5) newScores.push('');
      setScores(newScores.slice(0, 5));
      setDeduction(initialData.details?.deduction || '');
      if (initialData.score !== undefined) {
        setFinalScore(initialData.score);
      }
    } else {
      setScores(['', '', '', '', '']);
      setDeduction('');
      setFinalScore(0);
    }
  }, [open, initialData]);

  useEffect(() => {
    calculateFinalScore();
  }, [scores, deduction]);

  const calculateFinalScore = () => {
    let totalCalculated = 0;

    const filledScores = scores.filter(s => s !== '').map(parseFloat);
    if (filledScores.length > 0) {
      if (filledScores.length === 5) {
        const sorted = [...filledScores].sort((a, b) => a - b);
        const sum = sorted.slice(1, 4).reduce((a, b) => a + b, 0);
        totalCalculated = (sum / 3);
      } else {
        const sum = filledScores.reduce((a, b) => a + b, 0);
        totalCalculated = (sum / filledScores.length);
      }
    }

    const numericDeduction = parseFloat(deduction) || 0;
    const finalCalculated = totalCalculated - numericDeduction;
    
    setFinalScore(Math.round(finalCalculated * 100) / 100);
  };

  const handleScoreChange = (index, value) => {
    const newScores = [...scores];
    newScores[index] = value;
    setScores(newScores);
  };

  const handleSave = () => {
    const flatScores = scores.map(s => s === '' ? 0 : parseFloat(s));

    onSave({
      scores: flatScores,
      deduction: deduction === '' ? 0 : parseFloat(deduction),
      finalScore: finalScore
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        打分 - {participant?.name || '选手'}
        <Typography variant="subtitle2" color="text.secondary">
          {participant?.schoolName} | {eventName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, mb: 3 }}>
          <Typography gutterBottom variant="h6" color="primary">
            裁判打分 (1-5)
          </Typography>
          <Grid container spacing={2}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Grid item xs={4} sm={2.4} key={index}>
                <TextField
                  label={`裁判 ${index + 1}`}
                  type="number"
                  value={scores[index]}
                  onChange={(e) => handleScoreChange(index, e.target.value)}
                  inputProps={{ step: "0.01", min: "0", max: "10" }}
                  fullWidth
                  size="small"
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={6}>
            <TextField
              label="扣分"
              type="number"
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
              inputProps={{ step: "0.01", min: "0" }}
              fullWidth
              color="error"
            />
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f0f7ff', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">最终得分</Typography>
              <Typography variant="h4" color="primary.main" fontWeight="bold">
                {finalScore > 0 ? finalScore.toFixed(2) : '0.00'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          保存成绩
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScoreInputModal;
