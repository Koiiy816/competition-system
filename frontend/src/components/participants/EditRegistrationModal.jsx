import React, { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import competitionService from '../../services/competitionService';
import participantService from '../../services/participantService';

export default function EditRegistrationModal({ participant, onClose, onSuccess }) {
  const [competition, setCompetition] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setCompetition(null);
    setForm(null);
    setError('');
    if (participant) {
      setForm({ athleteNumber: participant.athleteNumber || '', event: participant.event || '', ageGroup: participant.ageGroup || participant.grade || '', groupTeam: participant.groupTeam || '', eventDetail: participant.additionalInfo?.eventDetail || '', updatedAt: participant.updatedAt });
      competitionService.getCompetition(participant.competition?._id || participant.competition)
        .then(response => { if (active) setCompetition(response.data); })
        .catch(err => { if (active) setError(err.message || '获取比赛失败'); });
    }
    return () => { active = false; };
  }, [participant]);
  const event = competition?.events?.find(item => item.name === form?.event);
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await participantService.updateRegistrationContent(competition._id, participant._id, form);
      onSuccess();
    } catch (err) { setError(err.message || '修改失败，请刷新后重试'); }
    finally { setSaving(false); }
  };
  return <Dialog open={Boolean(participant)} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>编辑报名项目</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 2 }}>{participant?.name} · {participant?.schoolName}</Typography>
      <Typography sx={{ mb: 2 }}>参赛者编号：{participant?.athleteNumber || '待管理员确认关联'}</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>仅在报名截止前开放。保存后将重新进入待审核；已关联赛程或成绩的报名请联系管理员。</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!competition && !error && <CircularProgress />}
      {competition && form && <>
        <TextField select fullWidth label="参赛项目" margin="normal" value={form.event} disabled={saving} onChange={e => setForm({ ...form, event: e.target.value, eventDetail: '', groupTeam: '' })}>
          {(competition.events || []).map(item => <MenuItem key={item.name} value={item.name}>{item.displayName || item.name}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="年龄组别" margin="normal" value={form.ageGroup} disabled helperText="组别不可自行修改，如需更正请联系管理员" />
        {event?.isGroupEvent && <TextField fullWidth required label="队伍编号" margin="normal" value={form.groupTeam} disabled={saving} inputProps={{ maxLength: 30 }} onChange={e => setForm({ ...form, groupTeam: e.target.value })} />}
        <TextField fullWidth label={event?.registrationDetail?.label || '项目补充说明'} required={event?.registrationDetail?.required} margin="normal" value={form.eventDetail} disabled={saving} inputProps={{ maxLength: event?.registrationDetail?.maxLength || 100 }} onChange={e => setForm({ ...form, eventDetail: e.target.value })} />
      </>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>取消</Button><Button variant="contained" onClick={save} disabled={saving || !competition || !form?.event || !participant?.athleteNumber}>{saving ? '保存中…' : '保存并提交审核'}</Button></DialogActions>
  </Dialog>;
}
