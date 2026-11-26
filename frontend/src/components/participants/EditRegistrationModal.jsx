import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import competitionService from '../../services/competitionService';
import participantService from '../../services/participantService';
import { getSportType } from '../../utils/competitionType';
import RenameTrampolineUnitDialog from './RenameTrampolineUnitDialog';
import { getTrampolineParticipantCoaches, getFilledTrampolineCoaches, validateTrampolineStaff } from '../../utils/trampolineStaff';

export default function EditRegistrationModal({ participant, onClose, onSuccess }) {
  const [competition, setCompetition] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [renameUnitOpen, setRenameUnitOpen] = useState(false);
  const [coaches, setCoaches] = useState([]);
  useEffect(() => {
    let active = true;
    setCompetition(null);
    setForm(null);
    setError('');
    setRenameUnitOpen(false);
    setCoaches(getTrampolineParticipantCoaches(participant));
    if (participant) {
      setForm({ teamLeader: participant.teamLeader || '', leaderPhone: participant.leaderPhone || '', coach: participant.coach || '', coachPhone: participant.coachPhone || '', athleteNumber: participant.athleteNumber || '', schoolName: participant.schoolName || '', event: participant.event || '', ageGroup: participant.ageGroup || participant.grade || '', groupTeam: participant.groupTeam || '', eventDetail: participant.additionalInfo?.eventDetail || '', updatedAt: participant.updatedAt });
      competitionService.getCompetition(participant.competition?._id || participant.competition)
        .then(response => { if (active) setCompetition(response.data); })
        .catch(err => { if (active) setError(err.message || '获取比赛失败'); });
    }
    return () => { active = false; };
  }, [participant]);
  const event = competition?.events?.find(item => item.name === form?.event);
  const needsAthleteNumber = getSportType(competition) === 'wushu';
  const isTrampoline = getSportType(competition) === 'trampoline';
  const save = async () => {
    if (isTrampoline) {
      const coachError = validateTrampolineStaff({ coaches }, 1);
      if (coachError) { setError(coachError); return; }
    }
    setSaving(true);
    setError('');
    try {
      await participantService.updateRegistrationContent(competition._id, participant._id, { ...form, ...(isTrampoline ? { trampolineCoaches: coaches } : {}) });
      onSuccess();
    } catch (err) { setError(err.message || '修改失败，请刷新后重试'); }
    finally { setSaving(false); }
  };
  return <><Dialog open={Boolean(participant)} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>编辑报名信息</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 2 }}>{participant?.name} · {participant?.schoolName}</Typography>
      {needsAthleteNumber && <Typography sx={{ mb: 2 }}>参赛者编号：{participant?.athleteNumber || '待管理员完成补号'}</Typography>}
      <Alert severity="info" sx={{ mb: 2 }}>仅在报名截止前开放。保存后将重新进入待审核；已关联赛程或成绩的报名请联系管理员。</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!competition && !error && <CircularProgress />}
      {competition && form && <>
        <TextField select fullWidth label="参赛项目" margin="normal" value={form.event} disabled={saving} onChange={e => setForm({ ...form, event: e.target.value, eventDetail: '', groupTeam: '' })}>
          {(competition.events || []).map(item => <MenuItem key={item.name} value={item.name}>{item.displayName || item.name}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="年龄组别" margin="normal" value={form.ageGroup} disabled helperText="组别不可自行修改，如需更正请联系管理员" />
        <TextField fullWidth required label="代表单位 / 学校" margin="normal" value={form.schoolName} disabled={saving} inputProps={{ maxLength: 100 }} helperText={getSportType(competition) === 'trampoline' ? '此处保存仅修改当前报名；本账号统一改名请使用下方入口' : '请统一填写本次报名使用的代表单位名称'} onChange={e => setForm({ ...form, schoolName: e.target.value })} />
        {getSportType(competition) === 'trampoline' && <Button size="small" disabled={saving} onClick={() => setRenameUnitOpen(true)}>整个单位统一更名</Button>}
        <TextField fullWidth label="领队" margin="normal" value={form.teamLeader} disabled={saving} inputProps={{ maxLength: 50 }} onChange={e => setForm({ ...form, teamLeader: e.target.value })} />
        <TextField fullWidth label="领队联系电话" margin="normal" value={form.leaderPhone} disabled={saving} onChange={e => setForm({ ...form, leaderPhone: e.target.value })} />
        {isTrampoline ? <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">教练资料（选填，已填写{getFilledTrampolineCoaches(coaches).length}名）</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>以下为当前报名关联的全部教练。保存仅修改当前报名，系统会核验本单位累计教练名额。</Typography>
          {!coaches.length && <Typography color="text.secondary">未填写教练资料</Typography>}
          {coaches.map((coach, index) => <Box key={index} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>教练{index + 1}</Typography>
              <Button color="error" size="small" disabled={saving} onClick={() => setCoaches(previous => previous.filter((_, i) => i !== index))}>删除教练{index + 1}</Button>
            </Box>
            {['name', 'phone'].map(field => <TextField key={field} fullWidth margin="normal" label={`教练${index + 1}${field === 'name' ? '姓名' : '电话'}`} value={coach[field]} disabled={saving}
              inputProps={{ maxLength: field === 'name' ? 50 : 30 }} onChange={event => setCoaches(previous => previous.map((person, i) => i === index ? { ...person, [field]: event.target.value } : person))} />)}
          </Box>)}
          <Button variant="outlined" disabled={saving} sx={{ mt: 1 }} onClick={() => setCoaches(previous => [...previous, { name: '', phone: '' }])}>添加教练</Button>
        </Box> : <><TextField fullWidth label="教练" margin="normal" value={form.coach} disabled={saving} inputProps={{ maxLength: 50 }} onChange={e => setForm({ ...form, coach: e.target.value })} />
        <TextField fullWidth label="教练联系电话" margin="normal" value={form.coachPhone} disabled={saving} onChange={e => setForm({ ...form, coachPhone: e.target.value })} />
        </>}
        {event?.isGroupEvent && <TextField fullWidth label="队伍编号（选填）" margin="normal" value={form.groupTeam} disabled={saving} inputProps={{ maxLength: 30 }} onChange={e => setForm({ ...form, groupTeam: e.target.value })} />}
        <TextField fullWidth label={event?.registrationDetail?.label || '项目补充说明'} required={event?.registrationDetail?.required} margin="normal" value={form.eventDetail} disabled={saving} inputProps={{ maxLength: event?.registrationDetail?.maxLength || 100 }} onChange={e => setForm({ ...form, eventDetail: e.target.value })} />
      </>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>取消</Button><Button variant="contained" onClick={save} disabled={saving || !competition || !form?.event || !form?.schoolName?.trim() || (needsAthleteNumber && !participant?.athleteNumber)}>{saving ? '保存中…' : '保存并提交审核'}</Button></DialogActions>
  </Dialog>
    {participant && getSportType(competition) === 'trampoline' && <RenameTrampolineUnitDialog open={renameUnitOpen} competitionId={competition._id}
      originalName={participant.schoolName || ''} initialName={form?.schoolName} ownRegistrationsOnly onClose={() => setRenameUnitOpen(false)}
      onSuccess={result => { setRenameUnitOpen(false); onSuccess(result); }} />}
  </>;
}
