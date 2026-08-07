import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Container, CircularProgress, Alert, Chip,
  TextField
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import * as XLSX from 'xlsx';
import competitionService from '../services/competitionService';
import scheduleService from '../services/scheduleService';
import resultService from '../services/resultService';
import { useAuth } from '../contexts/AuthContext';
import PrintPreviewModal from '../components/PrintPreviewModal';

const normalizeCheckInStatus = (participant) => {
  if (!participant) return 'not_checked';
  if (['not_checked', 'checked', 'absent'].includes(participant.checkInStatus)) {
    return participant.checkInStatus;
  }
  return participant.isCheckedIn ? 'checked' : 'not_checked';
};

const getParticipantCheckInStatus = (participant) => {
  if (!participant?.isVirtualTeam) {
    return normalizeCheckInStatus(participant);
  }

  const teamMembers = participant.teamMembers || [];
  if (teamMembers.length === 0) return normalizeCheckInStatus(participant);

  const statuses = teamMembers.map(normalizeCheckInStatus);
  if (statuses.every(status => status === 'checked')) return 'checked';
  if (statuses.every(status => status === 'absent')) return 'absent';
  if (statuses.every(status => status === 'not_checked')) return 'not_checked';
  return 'mixed';
};

const getCheckInStatusMeta = (status) => {
  switch (status) {
    case 'checked':
      return { label: '已检录', color: 'success' };
    case 'absent':
      return { label: '缺席/弃权', color: 'error' };
    case 'mixed':
      return { label: '状态不一致', color: 'warning' };
    default:
      return { label: '未检录', color: 'warning' };
  }
};

const isParticipantAbsent = (participant, result) => (
  getParticipantCheckInStatus(participant) === 'absent' || !!result?.details?.isAbsent
);

const getResultScore = (result) => (
  typeof result?.finalScore === 'number'
    ? result.finalScore
    : (typeof result?.score === 'number' ? result.score : 0)
);

const formatScheduleTime = (schedule) => {
  if (schedule?.scheduleDate) {
    const [year, month, day] = schedule.scheduleDate.split('-');
    const dateText = `${year}/${Number(month)}/${Number(day)}`;
    const timeText = [schedule.timeSlot, schedule.exactTime].filter(Boolean).join(' ');
    return timeText ? `${dateText} | ${timeText}` : dateText;
  }

  return schedule?.startTime ? new Date(schedule.startTime).toLocaleDateString() : '';
};

const ScoreRow = ({ participant, initialResult, scheduleStatus, canEdit, onSave, onCheckIn, canCheckIn, isCheckInUpdating, index, displayNameContent, isChiefOrAdmin, allowedIndex, judgeCount, currentRank, isDuplicateScore, checkInStatus }) => {
  const [scores, setScores] = useState(['', '', '', '', '']);
  const [deduction, setDeduction] = useState('');
  const [finalScore, setFinalScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isAbsent, setIsAbsent] = useState(false);

  useEffect(() => {
    if (initialResult) {
      const savedScores = initialResult.details?.scores || initialResult.scores || [];
      const newScores = [...savedScores];
      while (newScores.length < 5) newScores.push('');
      // 如果当前行没有在被编辑，才用后端的最新数据覆盖，防止打断用户输入
      if (!isDirty) {
        setScores(newScores.slice(0, 5));
        setDeduction(initialResult.details?.deduction ?? initialResult.deduction ?? '');
        setFinalScore(initialResult.score ?? initialResult.finalScore ?? 0);
        setIsAbsent(checkInStatus === 'absent' || initialResult.details?.isAbsent || false);
      }
    } else {
      if (!isDirty) {
        setScores(['', '', '', '', '']);
        setDeduction('');
        setFinalScore(0);
        setIsAbsent(checkInStatus === 'absent');
      }
    }
  }, [initialResult, isDirty, checkInStatus]);

  useEffect(() => {
    if (!isDirty) return;
    let totalCalculated = 0;
    const activeScores = scores.slice(0, judgeCount);
    const filledScores = activeScores.filter(s => s !== '').map(parseFloat);
    
    if (filledScores.length > 0) {
      if (judgeCount === 5 && filledScores.length === 5) {
        // 5裁判模式：去掉最高分和最低分，取平均
        const sorted = [...filledScores].sort((a, b) => a - b);
        const sum = sorted.slice(1, 4).reduce((a, b) => a + b, 0);
        totalCalculated = (sum / 3);
      } else {
        // 还没填满时的临时平均分
        const sum = filledScores.reduce((a, b) => a + b, 0);
        totalCalculated = (sum / filledScores.length);
      }
    }
    const numericDeduction = parseFloat(deduction) || 0;
    // 这里把 deduction 的逻辑改成直接相加，因为我们要支持加分（正数）和减分（负数）
    const finalCalculated = totalCalculated + numericDeduction;
    setFinalScore(Math.round(finalCalculated * 100) / 100);
  }, [scores, deduction, isDirty, judgeCount]);

  const handleScoreChange = (idx, value) => {
    const newScores = [...scores];
    newScores[idx] = value;
    setScores(newScores);
    setIsDirty(true);
  };

  const handleDeductionChange = (value) => {
    setDeduction(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // 把空字符串转为0，而不是 null，这样后端接收到的依然是数字数组，方便过滤
    const flatScores = scores.map(s => s === '' || s === null ? 0 : parseFloat(s));
    try {
      await onSave(participant._id, {
        scores: flatScores,
        deduction: deduction === '' ? 0 : parseFloat(deduction),
        finalScore: finalScore,
        isAbsent: false
      });
      setIsDirty(false);
      setIsAbsent(false);
    } catch (err) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const isCompleted = scheduleStatus === 'completed';
  const isNotChecked = checkInStatus === 'not_checked';
  const isMixed = checkInStatus === 'mixed';
  const checkInMeta = getCheckInStatusMeta(checkInStatus);
  
  // 检查普通裁判是否已经提交过有效分数（大于0则锁定）
  // 并且检查这个成绩是否已经被裁判长确认（如果已经被 verified，普通裁判也不能再改了）
  // 但是，如果裁判长把分数退回（比如把分数改成了 0），普通裁判就应该被解锁，可以重新打分
  const myInitialScore = (!isChiefOrAdmin && allowedIndex !== -1 && initialResult?.details?.scores) 
    ? parseFloat(initialResult.details.scores[allowedIndex]) || 0
    : 0;
  // 只有当自己打的分数大于 0 时，或者裁判长已经确认（verified）时才锁定
  // 如果分数是 0，说明被重置了，应该解锁
  const isLockedForMe = !isChiefOrAdmin && (myInitialScore > 0 || initialResult?.status === 'verified');

  const disabled = isCompleted || !canEdit || isLockedForMe || isAbsent || isNotChecked || isMixed;
  
  const renderIndices = Array.from({ length: judgeCount }, (_, index) => index);

  return (
    <TableRow
      hover
      sx={{
        bgcolor: isAbsent ? '#ffebee' : (isNotChecked || isMixed ? '#fff8e1' : 'inherit')
      }}
    >
      <TableCell sx={{ verticalAlign: 'middle' }}>{index + 1}</TableCell>
      <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '250px', lineHeight: '1.8', verticalAlign: 'middle', py: 1.5 }}>
        {displayNameContent}
        {participant.isTest && (
          <Chip label="测试" color="secondary" size="small" sx={{ ml: 1, height: 20, verticalAlign: 'middle' }} />
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'middle' }}>{participant.schoolName || (participant.user && participant.user.schoolName) || '-'}</TableCell>
      <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
        <Chip size="small" label={checkInMeta.label} color={checkInMeta.color} />
        {canCheckIn && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }} className="no-print">
            {checkInStatus === 'not_checked' && (
              <>
                <Button size="small" variant="contained" color="success" disabled={isCheckInUpdating} onClick={() => onCheckIn(participant, 'checked')}>检录</Button>
                <Button size="small" variant="outlined" color="error" disabled={isCheckInUpdating} onClick={() => onCheckIn(participant, 'absent')}>缺席</Button>
              </>
            )}
            {['checked', 'absent'].includes(checkInStatus) && (
              <Button size="small" variant="text" disabled={isCheckInUpdating} onClick={() => onCheckIn(participant, 'not_checked')}>撤销</Button>
            )}
          </Box>
        )}
      </TableCell>
      
      {renderIndices.map(idx => {
        // isMyField 决定了这个格子是否属于当前登录的裁判
        const isMyField = isChiefOrAdmin || allowedIndex === idx;
        
        // 关键逻辑：
        // 1. 如果是裁判长或管理员 (isChiefOrAdmin)，能看到真实分数 (scores[idx])
        // 2. 如果是普通裁判，且是自己的格子 (isMyField)，能看到真实分数 (scores[idx])
        // 3. 如果是普通裁判，但不是自己的格子，统统显示 '***'，无视里面到底有没有分数
        const displayValue = (isChiefOrAdmin || isMyField) ? scores[idx] : '***';

        return (
          <TableCell key={idx} align="center" sx={{ verticalAlign: 'middle', px: 0.5, minWidth: '55px' }}>
            <TextField
              variant="outlined"
              size="small"
              value={displayValue}
              onChange={(e) => handleScoreChange(idx, e.target.value)}
              disabled={disabled || !isMyField}
              inputProps={{ step: "0.01", min: "0", max: "10", style: { textAlign: 'center', padding: '6px 2px' } }}
              sx={{ width: '100%', minWidth: '45px', bgcolor: isDirty && isMyField && scores[idx] !== '' ? '#fff8e1' : 'inherit' }}
              className="no-print"
            />
            <Box sx={{ display: 'none', '@media print': { display: 'block' } }}>
              {displayValue || '-'}
            </Box>
          </TableCell>
        );
      })}

      <TableCell align="center" sx={{ verticalAlign: 'middle', px: 0.5, minWidth: '55px' }}>
        <TextField
          variant="outlined"
          size="small"
          value={isChiefOrAdmin ? deduction : '***'}
          onChange={(e) => handleDeductionChange(e.target.value)}
          disabled={disabled || !isChiefOrAdmin}
          color={parseFloat(deduction) > 0 ? "success" : "error"}
          inputProps={{ step: "0.01", style: { textAlign: 'center', padding: '6px 2px', color: parseFloat(deduction) > 0 ? '#2e7d32' : '#d32f2f' } }}
          sx={{ width: '100%', minWidth: '45px', bgcolor: isDirty && deduction !== '' ? (parseFloat(deduction) > 0 ? '#e8f5e9' : '#ffebee') : 'inherit' }}
          className="no-print"
        />
        <Box sx={{ display: 'none', '@media print': { display: 'block', color: 'red' } }}>
          {isChiefOrAdmin ? (deduction || '-') : '***'}
        </Box>
      </TableCell>

      <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
        <Typography 
          variant="h6" 
          fontWeight="bold" 
          color={isAbsent ? "error" : "primary"} 
          sx={{ 
            fontSize: '1.1rem',
            // 【修改点】：如果存在相同分数，给最后得分加上醒目的红色背景高亮
            backgroundColor: (isDuplicateScore && finalScore > 0 && !isAbsent) ? '#ffebee' : 'transparent',
            color: (isDuplicateScore && finalScore > 0 && !isAbsent) ? '#d32f2f' : (isAbsent ? "error.main" : "primary.main"),
            padding: (isDuplicateScore && finalScore > 0 && !isAbsent) ? '4px 8px' : '0',
            borderRadius: '4px',
            display: 'inline-block'
          }}
        >
          {isAbsent ? '缺席/弃权' : (finalScore > 0 ? finalScore.toFixed(2) : '-')}
        </Typography>
      </TableCell>

      <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
        <Typography variant="h6" fontWeight="bold" color="secondary" sx={{ fontSize: '1.1rem' }}>
          {currentRank || '-'}
        </Typography>
      </TableCell>

      <TableCell align="center" className="no-print" sx={{ verticalAlign: 'middle', px: 0.5, whiteSpace: 'nowrap' }}>
        {!isAbsent && !isNotChecked && !isMixed && (
          <Button 
            variant="contained" 
            color={
              // 状态显示逻辑更新：
              // 如果是裁判长/管理员看，如果后端是 pending，说明裁判打完分了，可以显示"待审核/待确认"等提示
              // 如果是普通裁判看，自己保存后就显示"已保存"
              isDirty ? "warning" : 
              (isChiefOrAdmin ? 
                (initialResult?.status === 'verified' ? "success" : (initialResult?.status === 'pending' ? "info" : "primary")) 
                : (finalScore > 0 ? "success" : "primary"))
            }
            size="small"
            onClick={handleSave}
            disabled={disabled || isSaving || (!isDirty && !isChiefOrAdmin)}
            sx={{ minWidth: '50px', px: 1, py: 0.5, fontSize: '0.8rem', mr: 0.5 }}
          >
            {isSaving ? '中' : 
             (isDirty ? '保存' : 
              (isChiefOrAdmin ? 
                (initialResult?.status === 'verified' ? '已确认' : (initialResult?.status === 'pending' ? '确认' : '保存'))
                : (isLockedForMe ? '已锁定' : (finalScore > 0 ? '已存' : '保存'))
              )
             )
            }
          </Button>
        )}
        {(isAbsent || isNotChecked || isMixed) && (
          <Typography
            variant="caption"
            sx={{
              color: isAbsent ? 'error.main' : 'warning.dark',
              fontWeight: 'bold'
            }}
          >
            {isAbsent ? '检录已判定缺席' : (isMixed ? '请先统一检录状态' : '请先完成检录')}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
};

const CompetitionScoreEntryPage = () => {
  const { id, scheduleId } = useParams(); // id is competitionId
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [results, setResults] = useState({});
  const [error, setError] = useState('');
  const [nextSchedule, setNextSchedule] = useState(null);
  const [prevSchedule, setPrevSchedule] = useState(null);
  const [checkInUpdatingId, setCheckInUpdatingId] = useState(null);
  
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Permission check: Admin, Chief Referee, Referee
  const hasPermission = (roles) => {
    return user && user.roles && user.roles.some(role => roles.includes(role));
  };
  
  const canEdit = hasPermission(['admin', 'chief_referee', 'referee']);
  const isChiefOrAdmin = hasPermission(['admin', 'chief_referee']);
  const canCheckIn = hasPermission(['admin', 'chief_referee']);
  
  let allowedIndex = -1;
  // 依然限制普通裁判只能填写自己的格子，不影响他们看到最后得分
  // 检查 user 是否存在，以及提取正确的姓名或角色信息
  if (!isChiefOrAdmin && user) {
    const userName = user.name || user.username || '';
    const match = userName.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      // 支持多场地：1-5对应裁1-5，6-10也对应裁1-5
      allowedIndex = (num - 1) % 5;
    }
  }

  // 判断是否是特定日期的比赛，或者是南山区中小学教育集团联盟比赛，以此开启 3裁判模式
  const isThreeRefereesMode = 
    schedule?.scheduleDate?.includes('05-30') || 
    schedule?.scheduleDate?.includes('05-31') || 
    schedule?.scheduleDate?.includes('06-13') || 
    schedule?.name?.includes('5月30') || 
    schedule?.name?.includes('5月31') ||
    schedule?.name?.includes('6月13') ||
    competition?.name?.includes('第五届南山区中小学教育集团联盟');
  const judgeCount = isThreeRefereesMode ? 3 : (schedule?.judgeCount || 5);
  
  useEffect(() => {
    fetchData();
    // 自动轮询刷新分数 (每3秒)，解决裁判长看不到最新分数的问题
    const interval = setInterval(() => {
      fetchResultsOnly();
      fetchScheduleOnly();
    }, 3000);
    return () => clearInterval(interval);
  }, [id, scheduleId]);

  const fetchResultsOnly = async () => {
    try {
      const resRes = await resultService.getResults(id, { scheduleId: scheduleId, limit: 1000 });
      const resMap = {};
      if (resRes.data && Array.isArray(resRes.data)) {
        resRes.data.forEach(r => {
          const pId = r.participant?._id || r.participant;
          if (pId) resMap[pId] = r;
        });
      }
      setResults(prev => {
        // 性能优化：对比前后数据是否一致，如果完全一样则不触发 setResults 重渲染整个打分表格，防止卡顿
        if (JSON.stringify(prev) !== JSON.stringify(resMap)) {
          return resMap;
        }
        return prev;
      });
    } catch (err) {
      console.error('Auto fetch results failed:', err);
    }
  };

  const fetchScheduleOnly = async () => {
    try {
      const schedRes = await scheduleService.getSchedule(id, scheduleId);
      const schedData = schedRes?.data;
      if (!schedData) return;

      setParticipants(prev => {
        const prevKey = JSON.stringify((prev || []).map(p => ({
          _id: p._id,
          isCheckedIn: p.isCheckedIn,
          checkInStatus: p.checkInStatus,
          teamMembers: (p.teamMembers || []).map(m => ({
            _id: m._id,
            isCheckedIn: m.isCheckedIn,
            checkInStatus: m.checkInStatus
          }))
        })));
        const nextParticipants = schedData.participants || [];
        const nextKey = JSON.stringify(nextParticipants.map(p => ({
          _id: p._id,
          isCheckedIn: p.isCheckedIn,
          checkInStatus: p.checkInStatus,
          teamMembers: (p.teamMembers || []).map(m => ({
            _id: m._id,
            isCheckedIn: m.isCheckedIn,
            checkInStatus: m.checkInStatus
          }))
        })));
        if (prevKey !== nextKey) return nextParticipants;
        return prev;
      });

      setSchedule(prev => {
        if (!prev) return schedData;
        const nextSchedule = {
          ...prev,
          status: schedData.status,
          participants: prev.participants,
          updatedAt: schedData.updatedAt,
          startTime: schedData.startTime,
          endTime: schedData.endTime,
          scheduleDate: schedData.scheduleDate,
          timeSlot: schedData.timeSlot,
          exactTime: schedData.exactTime,
          court: schedData.court,
          name: schedData.name,
          judgeCount: schedData.judgeCount
        };
        const prevKey = JSON.stringify({
          status: prev.status,
          updatedAt: prev.updatedAt,
          startTime: prev.startTime,
          endTime: prev.endTime,
          scheduleDate: prev.scheduleDate,
          timeSlot: prev.timeSlot,
          exactTime: prev.exactTime,
          court: prev.court,
          name: prev.name,
          judgeCount: prev.judgeCount
        });
        const nextKey = JSON.stringify({
          status: nextSchedule.status,
          updatedAt: nextSchedule.updatedAt,
          startTime: nextSchedule.startTime,
          endTime: nextSchedule.endTime,
          scheduleDate: nextSchedule.scheduleDate,
          timeSlot: nextSchedule.timeSlot,
          exactTime: nextSchedule.exactTime,
          court: nextSchedule.court,
          name: nextSchedule.name,
          judgeCount: nextSchedule.judgeCount
        });
        if (prevKey !== nextKey) return nextSchedule;
        return prev;
      });
    } catch (err) {
      console.error('Auto fetch schedule failed:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const schedRes = await scheduleService.getSchedule(id, scheduleId);
      
      if (!schedRes || !schedRes.data) {
        throw new Error('赛程数据加载失败');
      }
      
      // We also need the competition details to show the updated location
      const compRes = await competitionService.getCompetition(id);
      if (compRes && compRes.data) {
        // Overlay the competition's location onto the schedule if schedule doesn't have a distinct one
        schedRes.data.location = compRes.data.location || schedRes.data.location;
        setCompetition(compRes.data);
      }
      
      setSchedule(schedRes.data);
      
      // Get Results
      const resRes = await resultService.getResults(id, { scheduleId: scheduleId, limit: 1000 });
      
      // Map results by participant ID for easy lookup
      const resMap = {};
      if (resRes.data && Array.isArray(resRes.data)) {
        resRes.data.forEach(r => {
          const pId = r.participant?._id || r.participant;
          if (pId) resMap[pId] = r;
        });
      }
      setResults(resMap);

      // Participants are populated in schedule
      setParticipants(schedRes.data.participants || []);

      // 获取所有赛程以计算“下一个比赛项目”
      try {
        const allSchedRes = await scheduleService.getSchedules(id, { limit: 1000 });
        if (allSchedRes && allSchedRes.data) {
          const allSchedules = allSchedRes.data;
          const currentCourt = schedRes.data.court || '一号场地';
          
          // 筛选出同场地的所有赛程
          const courtSchedules = allSchedules.filter(s => s.court === currentCourt);
          
          // 按日期、时间段、排序号依次排序
          const timeSlotOrder = { '上午': 1, '下午': 2, '晚上': 3 };
          courtSchedules.sort((a, b) => {
            if (a.scheduleDate !== b.scheduleDate) {
              return new Date(a.scheduleDate || 0) - new Date(b.scheduleDate || 0);
            }
            const slotA = timeSlotOrder[a.timeSlot] || 99;
            const slotB = timeSlotOrder[b.timeSlot] || 99;
            if (slotA !== slotB) return slotA - slotB;
            
            return (a.order || 0) - (b.order || 0);
          });
          
          const currentIndex = courtSchedules.findIndex(s => s._id === scheduleId);
          if (currentIndex !== -1 && currentIndex < courtSchedules.length - 1) {
            setNextSchedule(courtSchedules[currentIndex + 1]);
          } else {
            setNextSchedule(null);
          }
          if (currentIndex > 0) {
            setPrevSchedule(courtSchedules[currentIndex - 1]);
          } else {
            setPrevSchedule(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch next schedule', err);
      }

    } catch (err) {
      setError(err.message || '加载数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineSave = async (participantId, scoreData) => {
    try {
      const data = {
        scheduleId: scheduleId,
        participantId: participantId,
        scores: scoreData.scores,
        deduction: scoreData.deduction,
        finalScore: scoreData.finalScore,
        isAbsent: scoreData.isAbsent
      };
      
      const res = await resultService.submitScore(id, data);
      
      setResults(prev => ({
        ...prev,
        [participantId]: res.data
      }));
    } catch (err) {
      alert(err.message || '保存失败');
      throw err;
    }
  };

  const handleInlineCheckIn = async (participant, status) => {
    setCheckInUpdatingId(participant._id);
    setError('');
    try {
      await scheduleService.updateParticipantCheckInStatus(id, participant._id, status, scheduleId);
      await Promise.all([fetchScheduleOnly(), fetchResultsOnly()]);
    } catch (err) {
      setError(err.message || '检录状态更新失败');
    } finally {
      setCheckInUpdatingId(null);
    }
  };

  const handleToggleSessionStatus = async () => {
    if (schedule?.status === 'completed') {
      if (!window.confirm('确定要恢复本场比赛吗？恢复后将可以重新修改成绩。')) return;
      try {
        await scheduleService.updateSchedule(id, scheduleId, { status: 'ongoing' });
        setSchedule(prev => ({ ...prev, status: 'ongoing' }));
      } catch (err) {
        alert('操作失败');
      }
    } else {
      if (!window.confirm('确定要结束本场比赛吗？结束将锁定成绩。')) return;
      try {
        await scheduleService.updateSchedule(id, scheduleId, { status: 'completed' });
        setSchedule(prev => ({ ...prev, status: 'completed' }));
      } catch (err) {
        alert('操作失败');
      }
    }
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
  };

  const handleExportExcel = () => {
    const normalizeText = (value = '') => String(value).replace(/\s+/g, '');
    const isLuohuTraditionalCompetition = (competition) => {
      const competitionName = normalizeText(competition?.name || '');
      return competitionName.includes('罗湖区青少年传统武术锦标赛竞赛');
    };
    const isLuohuExcludedTeamScoreEvent = (scheduleName = '') => {
      const normalizedScheduleName = normalizeText(scheduleName);
      return normalizedScheduleName.includes('集体武术操') || normalizedScheduleName.includes('幼儿集体拳');
    };
    const getAdmissionCount = (competition, scheduleName, formalCount) => {
      if (formalCount <= 0) return 0;
      if (!isLuohuTraditionalCompetition(competition)) return 8;

      if (isLuohuExcludedTeamScoreEvent(scheduleName)) return Math.min(8, formalCount);
      if (formalCount > 8) return 8;
      if (formalCount === 1) return 1;
      return Math.max(formalCount - 1, 1);
    };

    const selectedCompetition = competition;
    const scheduleName = schedule?.name || '';
    const formalCount = participants.filter(p => !p.isTest).length;
    const admissionCount = getAdmissionCount(selectedCompetition, scheduleName, formalCount);
    const countsForTeam = isLuohuTraditionalCompetition(selectedCompetition)
      ? (!isLuohuExcludedTeamScoreEvent(scheduleName) && formalCount >= 3)
      : null;
    const admissionNote = isLuohuTraditionalCompetition(selectedCompetition)
      ? `录取前${admissionCount}名${countsForTeam ? '，计团体总分' : '，不计团体总分'}`
      : '';

    // 1. 整理数据并按最后得分降序排列，排除测试人员
    const dataToExport = participants
      .filter(p => !p.isTest)
      .map((p, index) => {
        const result = results[p._id];
        const finalScore = getResultScore(result);
        const absent = isParticipantAbsent(p, result);
        
        let displayName = p.name || (p.user && p.user.name) || '未知';
        if (p.isVirtualTeam && p.teamMembers && p.teamMembers.length > 0) {
          displayName = p.teamMembers.map(m => m.name).join('、');
        }

        return {
          '排名': 0, // 占位，等下排序后赋值
          '姓名': displayName,
          '代表队/学校': p.schoolName || (p.user && p.user.schoolName) || '-',
          '是否录取': '否',
          '最终得分': absent ? '弃权' : (finalScore > 0 ? finalScore.toFixed(2) : '')
        };
      });

    // 按最后得分降序，弃权排最后
    dataToExport.sort((a, b) => {
      const isAbsentA = a['最终得分'] === '弃权';
      const isAbsentB = b['最终得分'] === '弃权';
      if (isAbsentA && isAbsentB) return 0;
      if (isAbsentA) return 1;
      if (isAbsentB) return -1;

      const scoreA = parseFloat(a['最终得分']) || 0;
      const scoreB = parseFloat(b['最终得分']) || 0;
      return scoreB - scoreA;
    });

    // 重新编排排名序号 (处理并列情况)
    let currentRank = 1;
    let currentScore = -1;
    
    dataToExport.forEach((row, idx) => {
      if (row['最终得分'] === '弃权') {
        row['排名'] = '-';
        row['是否录取'] = '否';
        if (admissionNote) row['录取说明'] = admissionNote;
        return;
      }
      const score = parseFloat(row['最终得分']) || 0;
      if (idx === 0) {
        row['排名'] = currentRank;
        currentScore = score;
      } else {
        if (score === currentScore) {
          row['排名'] = currentRank; // 分数相同，排名相同
        } else {
          currentRank = idx + 1; // 分数不同，排名为当前索引+1
          row['排名'] = currentRank;
          currentScore = score;
        }
      }

      const isAwarded = admissionCount > 0 && typeof row['排名'] === 'number' && row['排名'] <= admissionCount;
      row['是否录取'] = isAwarded ? '是' : '否';
      if (admissionNote) row['录取说明'] = admissionNote;
    });

    // 2. 生成 Excel
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "成绩公告");

    // 3. 导出并下载
    const fileName = `${schedule?.name || '成绩公告'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 计算当前的实时排名 (必须放在所有 return 之前，遵循 Hooks 规则)
  const participantRanks = React.useMemo(() => {
    // 排除测试人员，不让他们参与排名计算
    const scoresList = participants.filter(p => !p.isTest).map(p => {
      const res = results[p._id];
      const isAbsent = isParticipantAbsent(p, res);
      const score = getResultScore(res);
      return { id: p._id, score, isAbsent };
    });
    
    // 按分数降序排列
    const sorted = [...scoresList].sort((a, b) => {
      if (a.isAbsent && b.isAbsent) return 0;
      if (a.isAbsent) return 1;
      if (b.isAbsent) return -1;
      return b.score - a.score;
    });
    
    const ranks = {};
    let currentRank = 1;
    let currentScore = -1;
    
    sorted.forEach((item, index) => {
      if (item.isAbsent || item.score === 0) {
        ranks[item.id] = '-';
        return;
      }
      if (index === 0) {
        ranks[item.id] = currentRank;
        currentScore = item.score;
      } else {
        if (item.score === currentScore) {
          ranks[item.id] = currentRank;
        } else {
          currentRank = index + 1;
          ranks[item.id] = currentRank;
          currentScore = item.score;
        }
      }
    });

    // 给测试人员手动分配 '-' 作为排名
    participants.forEach(p => {
      if (p.isTest) {
        ranks[p._id] = '-';
      }
    });

    return ranks;
  }, [participants, results]);

  // 找出所有发生重复（并列）的分数
  const duplicateScores = React.useMemo(() => {
    const scoreCounts = {};
    participants.forEach(p => {
      const res = results[p._id];
      if (!isParticipantAbsent(p, res)) {
        const score = getResultScore(res);
        if (score > 0) {
          scoreCounts[score] = (scoreCounts[score] || 0) + 1;
        }
      }
    });
    // 返回所有出现次数大于 1 的分数
    return Object.keys(scoreCounts).filter(score => scoreCounts[score] > 1).map(Number);
  }, [participants, results]);

  const checkInSummary = React.useMemo(() => {
    return participants.reduce((acc, participant) => {
      const status = getParticipantCheckInStatus(participant);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { checked: 0, absent: 0, not_checked: 0, mixed: 0 });
  }, [participants]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }} className="print-container">
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${id}/score`)} sx={{ mb: 2 }} className="no-print">
        返回赛程列表
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }} className="no-print">{error}</Alert>}
      {checkInSummary.not_checked > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} className="no-print">
          当前有 {checkInSummary.not_checked} 个参赛对象尚未检录，已禁止打分。
        </Alert>
      )}
      {checkInSummary.absent > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} className="no-print">
          当前有 {checkInSummary.absent} 个参赛对象已被检录标记为缺席，页面已自动显示“缺席/弃权”。
        </Alert>
      )}
      {checkInSummary.mixed > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} className="no-print">
          当前有 {checkInSummary.mixed} 个集体项目检录状态不一致，请先到检录页面统一状态。
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }} className="no-print">
          <Box>
            <Typography variant="h5" component="h1" gutterBottom>
              {schedule?.name} - 成绩录入
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {formatScheduleTime(schedule)}
            </Typography>
          </Box>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<PrintIcon />} 
              onClick={handlePrint}
              sx={{ mr: 1 }}
            >
              成绩打印
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />} 
              onClick={handleExportExcel}
              sx={{ mr: 1 }}
            >
              导出Excel
            </Button>
            <Button 
              variant="contained" 
              color={schedule?.status === 'completed' ? 'warning' : 'primary'}
              startIcon={<CheckCircleIcon />}
              onClick={handleToggleSessionStatus}
            >
              {schedule?.status === 'completed' ? '恢复修改成绩' : '本场结束'}
            </Button>
          </Box>
        </Box>

        <div id="printable-area" style={{ padding: '20px' }}>
          <TableContainer sx={{ p: 2 }}>
            {/* Print Header - Visible only in print */}
            <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 3, textAlign: 'center' } }}>
               <Typography variant="h4" align="center" gutterBottom>{schedule?.name} - 成绩单</Typography>
               <Typography variant="subtitle1" align="center" gutterBottom>
                 日期及時間：{formatScheduleTime(schedule)}
               </Typography>
            </Box>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width="5%">序号</TableCell>
                  <TableCell width="23%">姓名</TableCell>
                  <TableCell width="14%">代表队/学校</TableCell>
                  <TableCell width="9%" align="center">检录状态</TableCell>
                  {Array.from({ length: judgeCount }, (_, index) => (
                    <TableCell key={index} width="7%" align="center">裁{index + 1}</TableCell>
                  ))}
                  <TableCell width="7%" align="center">裁判长加减分</TableCell>
                  <TableCell width="8%" align="center">最后得分</TableCell>
                  <TableCell width="5%" align="center">实时排名</TableCell>
                  <TableCell width="5%" align="center" className="no-print">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((p, index) => {
                  const result = results[p._id];
                  const checkInStatus = getParticipantCheckInStatus(p);
                  
                  // 集体项目人员姓名换行逻辑 (与赛程页保持一致)
                  let displayNameContent = p.name || (p.user && p.user.name) || '未知';
                  if (p.isVirtualTeam && p.teamMembers && p.teamMembers.length > 0) {
                    const names = p.teamMembers.map(m => m.name);
                    const chunks = [];
                    for (let i = 0; i < names.length; i += 3) {
                      let chunkStr = names.slice(i, i + 3).join('、');
                      if (i + 3 < names.length) {
                        chunkStr += '、';
                      }
                      chunks.push(chunkStr);
                    }
                    displayNameContent = chunks.map((chunk, idx) => (
                      <React.Fragment key={idx}>
                        {chunk}
                        {idx < chunks.length - 1 && <br />}
                      </React.Fragment>
                    ));
                  }
                  
                  return (
                    <ScoreRow 
                      key={p._id}
                      participant={p}
                      initialResult={result}
                      scheduleStatus={schedule?.status}
                      canEdit={canEdit}
                      onSave={handleInlineSave}
                      onCheckIn={handleInlineCheckIn}
                      canCheckIn={canCheckIn}
                      isCheckInUpdating={checkInUpdatingId === p._id}
                      index={index}
                      displayNameContent={displayNameContent}
                      isChiefOrAdmin={isChiefOrAdmin}
                      allowedIndex={allowedIndex}
                      judgeCount={judgeCount}
                      currentRank={participantRanks[p._id]}
                      isDuplicateScore={duplicateScores.includes(getResultScore(result))}
                      checkInStatus={checkInStatus}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 上一个/下一个比赛项目按钮 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, mx: 2 }} className="no-print">
            <Box>
              {prevSchedule && (
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={() => navigate(`/competitions/${id}/score/${prevSchedule._id}`)}
                  sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', boxShadow: 1 }}
                >
                  上一个比赛项目：{prevSchedule.name}
                </Button>
              )}
            </Box>
            <Box>
              {nextSchedule && (
                <Button 
                  variant="contained" 
                  color="secondary"
                  onClick={() => navigate(`/competitions/${id}/score/${nextSchedule._id}`)}
                  sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', boxShadow: 3 }}
                >
                  下一个比赛项目：{nextSchedule.name}
                </Button>
              )}
            </Box>
          </Box>
        </div>
      </Paper>

      {/* 成绩预览打印 (可选) */}

      <PrintPreviewModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        schedule={schedule}
        participants={participants.filter(p => !p.isTest)}
        results={results}
        user={user}
      />
      
      <style>{`
        @media print {
          /* No specific global print styles needed as PrintPreviewModal handles its own printing */
        }
      `}</style>
    </Container>
  );
};

export default CompetitionScoreEntryPage;
