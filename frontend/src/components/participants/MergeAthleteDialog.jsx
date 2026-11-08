import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import api from '../../services/api';

export default function MergeAthleteDialog({ open, competitionId, onClose, onSuccess }) {
  const [sourceNumber, setSourceNumber] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDocumentDifference, setConfirmDocumentDifference] = useState(false);
  const [documentPolicy, setDocumentPolicy] = useState('preserve');
  useEffect(() => {
    if (open) { setSourceNumber(''); setTargetNumber(''); setPreview(null); setError(''); setConfirmDocumentDifference(false); setDocumentPolicy('preserve'); }
  }, [open, competitionId]);
  const submit = async (apply) => {
    setBusy(true); setError('');
    try {
      const response = await api.post(`/competitions/${competitionId}/participants/athlete-identities/${apply ? 'merge' : 'merge-preview'}`,
        { sourceNumber: sourceNumber.trim(), targetNumber: targetNumber.trim(), ...(apply ? { version: preview.version, confirmDocumentDifference, documentPolicy } : {}) },
        { skipMutationConfirmation: true });
      if (apply) { onSuccess(response.data.data); onClose(); }
      else { setPreview(response.data.data); setConfirmDocumentDifference(false); setDocumentPolicy('preserve'); }
    } catch (err) { setError(err.response?.data?.message || err.message || '编号合并失败，请重试'); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
    <DialogTitle>合并重复参赛者编号</DialogTitle>
    <DialogContent>
      <Alert severity="info" sx={{ mb: 2 }}>仅用于已确认是同一人的重复档案。所有项目将关联保留编号；旧编号停用并保留合并记录。报名编号、审核状态、赛程和成绩不变。</Alert>
      <TextField fullWidth margin="normal" label="停用的旧编号" value={sourceNumber} disabled={busy} onChange={event => { setSourceNumber(event.target.value); setPreview(null); }} />
      <TextField fullWidth margin="normal" label="保留的参赛者编号" value={targetNumber} disabled={busy} onChange={event => { setTargetNumber(event.target.value); setPreview(null); }} />
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
      {preview && <Box sx={{ mt: 2 }}>
        {preview.documentDifferences?.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography>发现证件资料差异：保留编号为 {preview.targetDocumentLength} 位（{preview.target.maskedIdCard}）。</Typography>
          {preview.documentDifferences.map(row => <Typography key={row.record} variant="body2">{row.record}：{row.documentLength} 位（{row.maskedIdCard}）</Typography>)}
          <TextField select fullWidth label="证件资料处理方式" margin="normal" value={documentPolicy} disabled={busy} onChange={event => setDocumentPolicy(event.target.value)}>
            <MenuItem value="preserve">保留各报名原证件字段</MenuItem>
            <MenuItem value="source">统一使用旧编号的证件资料</MenuItem>
            <MenuItem value="target">统一使用保留编号的证件资料</MenuItem>
          </TextField>
          <FormControlLabel control={<Checkbox checked={confirmDocumentDifference} disabled={busy} onChange={event => setConfirmDocumentDifference(event.target.checked)} />} label="我已核实为同一人，并确认以上证件资料处理方式" />
        </Alert>}
        <Typography fontWeight="bold">{preview.target.name} · {preview.target.schoolName}</Typography>
        <Typography>{preview.target.gender === 'male' ? '男' : preview.target.gender === 'female' ? '女' : preview.target.gender} · {preview.target.birthDate?.slice(0, 10) || '出生日期未填'} · 证件 {preview.target.maskedIdCard}</Typography>
        <Typography sx={{ my: 1 }}>将转移 {preview.movingCount} 条报名，合并后共 {preview.registrations.length} 条报名、{preview.participantCount} 人、{preview.eventCount} 个计费项目，按武术费用规则合计 {preview.fee} 元。</Typography>
        {preview.registrations.map(row => <Typography key={row._id} variant="body2">{row.registrationNumber}　{row.schoolName}　{row.event}　{row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已拒绝' : '待审核'}</Typography>)}
      </Box>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>取消</Button>
      <Button onClick={() => submit(false)} disabled={busy || !competitionId || !sourceNumber.trim() || !targetNumber.trim() || sourceNumber.trim() === targetNumber.trim()}>预览受影响的报名</Button>
      <Button variant="contained" color="warning" onClick={() => submit(true)} disabled={busy || !preview || (preview.documentDifferences?.length > 0 && !confirmDocumentDifference)}>{busy ? '处理中…' : '确认合并并停用旧编号'}</Button>
    </DialogActions>
  </Dialog>;
}
