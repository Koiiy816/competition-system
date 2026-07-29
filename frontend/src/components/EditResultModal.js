import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { resultService } from '../services/resultService';

const EditResultModal = ({ open, onClose, result, onResultUpdated }) => {
  const [score, setScore] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (result && result.score) {
      if (typeof result.score === 'object') {
        setScore(JSON.stringify(result.score));
      } else {
        setScore(result.score.toString());
      }
    } else {
      setScore('');
    }
    setError('');
  }, [result]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    let finalScore;
    try {
      finalScore = JSON.parse(score);
    } catch (e) {
      finalScore = score;
    }

    try {
      await resultService.updateResult(result._id, { score: finalScore });
      onResultUpdated();
      onClose();
    } catch (err) {
      setError(err.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  if (!result) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>编辑成绩</DialogTitle>      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          margin="dense"
          label="成绩"
          fullWidth
          variant="outlined"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          helperText={`可以直接输入数字，或输入 JSON 格式的成绩，例如：{"time": "10.5", "points": 95}`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditResultModal;