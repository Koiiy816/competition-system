import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import participantService from '../../services/participantService';

export default function RenameTrampolineUnitDialog({ open, competitionId, originalName, initialName, ownRegistrationsOnly = false, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setName(initialName || originalName || ''); setError(''); }
  }, [open, originalName, initialName]);

  const save = async () => {
    if (!name.trim() || name.trim().length > 100) { setError('请填写新单位名称，最多100字'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await participantService.renameTrampolineUnit(competitionId, { oldSchoolName: originalName, newSchoolName: name.trim() });
      onSuccess(result);
    } catch (err) { setError(err.message || '单位更名失败，请重试'); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
    <DialogTitle>整个单位统一更名</DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography sx={{ mb: 2 }}>原单位：{originalName}</Typography>
      <Alert severity="info" sx={{ mb: 3 }}>{ownRegistrationsOnly
        ? '仅将本账号在当前赛事中、属于原单位的全部报名统一更名，保存后重新进入待审核。选手、教练和领队资料保持原样，其他账号的报名不受影响。新名称不能与本赛事其他单位重名；如有报名已进入比赛流程，请联系管理员。'
        : '将当前赛事中原单位的全部报名统一更名，包括不同账号提交的报名。此次只更改单位名称，选手、教练和领队资料保持原样。新名称不能与本赛事其他单位重名。'}</Alert>
      <TextField autoFocus fullWidth label="新单位名称" value={name} disabled={saving} inputProps={{ maxLength: 100 }} onChange={event => setName(event.target.value)} />
    </DialogContent>
    <DialogActions>
      <Button disabled={saving} onClick={onClose}>取消</Button>
      <Button variant="contained" disabled={saving || !name.trim() || name.trim() === String(originalName || '').trim()} onClick={save}>{saving ? '更名中…' : '确认统一更名'}</Button>
    </DialogActions>
  </Dialog>;
}
