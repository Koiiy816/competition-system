import React, { useEffect, useState } from 'react';
import { Alert, MenuItem, TextField } from '@mui/material';
import api from '../../services/api';

export default function AthleteIdentitySelect({ competitionId, value, onChange, onReady, disabled }) {
  const [identities, setIdentities] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    setIdentities([]);
    setError('');
    setLoading(true);
    setConfirmed(false);
    if (competitionId) api.get(`/competitions/${competitionId}/participants/athlete-identities`)
      .then(response => { if (active) setIdentities(response.data.data); })
      .catch(() => { if (active) setError('读取参赛者编号失败，请稍后重试；不要为已有人员重复新建编号。'); })
      .finally(() => { if (active) setLoading(false); });
    else setLoading(false);
    return () => { active = false; };
  }, [competitionId]);
  const ready = !loading && !error && (value ? identities.some(item => item.number === value) : confirmed);
  useEffect(() => { onReady?.(Boolean(ready)); }, [ready, onReady]);
  return <>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField select fullWidth label="参赛者编号关联" value={value || (confirmed ? '' : '__choose__')} disabled={disabled || loading || Boolean(error)} onChange={e => { setConfirmed(true); onChange(e.target.value); }}
      helperText="编号在本赛事内跨单位共用。姓名、生日和证件号一致时自动复用编号；共用编号不改变各账号的报名管理权限。证件仅显示尾号。">
      <MenuItem value="__choose__" disabled>请选择已有人员或新增人员</MenuItem>
      <MenuItem value="">新增人员 / 新增同名人员（资料一致时复用已有编号）</MenuItem>
      {value && !identities.some(item => item.number === value) && <MenuItem value={value}>{value}（编号未找到或无权访问，请核对）</MenuItem>}
      {identities.map(item => <MenuItem key={item.number} value={item.number}>
        {item.name} · {item.gender === 'male' ? '男' : item.gender === 'female' ? '女' : item.gender || '性别未填'} · {item.birthDate?.slice(0, 10) || '出生日期未填'} · 证件 {item.maskedIdCard} · {item.number}
      </MenuItem>)}
    </TextField>
  </>;
}
