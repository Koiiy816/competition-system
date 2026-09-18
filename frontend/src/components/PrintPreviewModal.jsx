import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { rankDivingAwardEntries } from '../utils/divingAwards';

const refereeGroupsByCourt = {
  A: ['卢玉玲', '李楷毅', '柯燕', '李亮', '姚晓丽', '贾宇浩', '郑植群', '陈心怡', '王文熙', '张烨盛'],
  B: ['吴威成', '杨卫斌', '邓文锋', '杨国政', '吴家丽', '肖伟敏', '徐梓莹', '许晋涛']
};

const getRefereeGroup = (schedule) => {
  const court = String(schedule?.court || schedule?.location || '').trim();
  const match = court.match(/^([AB])(?:\s*场地)?$/i);
  return match ? match[1].toUpperCase() : null;
};

const savedDivingJudgeNames = () => {
  try {
    const names = JSON.parse(localStorage.getItem('diving_judge_names') || '[]');
    return Array.from({ length: 5 }, (_, index) => String(names[index] || ''));
  } catch {
    return ['', '', '', '', ''];
  }
};

const PrintPreviewModal = ({ open, onClose, schedule, participants, results, user, isTeamRanking = false }) => {
  const normalizeStrengthActionName = (value) => String(value || '')
    .replace(/提膝跳\s*10\s*次/g, '提膝跳')
    .replace(/引体控\s*40\s*秒/g, '引体控');
  // Use React's useEffect to automatically sync the title and subtitle when the schedule prop changes
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [signatureImage, setSignatureImage] = useState(localStorage.getItem('chief_signature') || '');
  const [divingJudgeNames, setDivingJudgeNames] = useState(savedDivingJudgeNames);
  const [divingReserveName, setDivingReserveName] = useState(localStorage.getItem('diving_reserve_name') || '');

  React.useEffect(() => {
    if (open && schedule) {
      const isStrength = /素质力量|素質力量/.test(String(schedule.name || ''));
      const isDiving = schedule.scoringMode === 'diving' && !isStrength;
      setTitle(isDiving || isStrength ? (schedule.competition?.name || schedule.competitionName || '比赛') : `${schedule.name || '比赛'} - 成绩公告`);
      setSubTitle(isDiving || isStrength ? '名次公告' : `日期：${schedule.startTime ? new Date(schedule.startTime).toLocaleDateString() : ''} | 地点：${schedule.location || ''}`);
    }
  }, [open, schedule]);
  
  const handlePrint = () => {
    window.print();
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureImage(reader.result);
        localStorage.setItem('chief_signature', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculate scores helper
  const getScoreData = (participant) => {
    // 优先使用 __printKey（兼容合并项目的虚拟 ID），如果不存在则降级使用 _id 或对象本身
    const key = participant.__printKey || participant._id || participant;
    const result = results[key];
    const scores = result?.details?.scores || ['', '', '', '', ''];
    const deduction = result?.details?.deduction || 0;
    const isAbsent = result?.details?.isAbsent || false;
    const finalScore = typeof result?.finalScore === 'number' ? result?.finalScore : (result?.score || 0);
    return { scores, deduction, finalScore, isAbsent };
  };
  const isStrengthPrint = /素质力量|素質力量/.test(String(schedule?.name || '')) || participants.some((participant) => results[participant.__printKey || participant._id || participant]?.details?.scoringType === 'strength');
  const isDivingPrint = !isStrengthPrint && (schedule?.scoringMode === 'diving' || participants.some((participant) => Array.isArray(results[participant.__printKey || participant._id || participant]?.details?.dives)));
  const strengthEventNames = [...new Set([
    ...(schedule?.divingProgram || []).map((event) => event.actionName || event.actionCode),
    ...participants.flatMap((participant) => participant?.additionalInfo?.divingPlan?.dives || []),
    ...participants.flatMap((participant) => (results[participant.__printKey || participant._id || participant]?.details?.events || []))
  ].map((event) => normalizeStrengthActionName(typeof event === 'string' ? event : (event?.actionName || event?.actionCode))).filter(Boolean))];
  const divingRankedParticipants = isDivingPrint ? rankDivingAwardEntries(participants, {
    getParticipant: (participant) => participant,
    getScore: (participant) => getScoreData(participant).finalScore,
    isAbsent: (participant) => getScoreData(participant).isAbsent,
    isTest: (participant) => Boolean(participant?.isTest)
  }) : null;

  // Sort participants by final score (descending), absent at the bottom
  const sortedParticipants = (() => {
    // 团体分打印时不需要排序，因为传入的时候已经排好序了
    if (isTeamRanking) {
      return [...participants];
    }
    const scoreSorted = [...participants].sort((a, b) => {
      const dataA = getScoreData(a);
      const dataB = getScoreData(b);
      if (dataA.isAbsent && dataB.isAbsent) return 0;
      if (dataA.isAbsent) return 1;
      if (dataB.isAbsent) return -1;
      if (dataB.finalScore !== dataA.finalScore) return dataB.finalScore - dataA.finalScore;
      if (isStrengthPrint) {
        for (let place = 1; place <= 20; place += 1) {
          const count = (participant) => (results[participant.__printKey || participant._id || participant]?.details?.events || []).filter((event) => event.rank === place).length;
          if (count(b) !== count(a)) return count(b) - count(a);
        }
      }
      return 0;
    });
    if (!isDivingPrint) return scoreSorted;
    return divingRankedParticipants.map(({ entry }) => entry);
  })();

  // Calculate actual ranks (handling ties)
  const getRanks = (participantsList) => {
    if (isTeamRanking) {
      return participantsList.map((_, i) => i + 1);
    }
    const ranks = [];
    let currentRank = 1;
    let currentScore = -1;
    
    participantsList.forEach((p, index) => {
      const data = getScoreData(p);
      if (data.isAbsent) {
        ranks.push('-');
        return;
      }
      const score = data.finalScore;
      if (index === 0) {
        ranks.push(currentRank);
        currentScore = score;
      } else {
        if (score === currentScore && !isStrengthPrint) {
          ranks.push(currentRank); // Tie, keep the same rank
        } else {
          currentRank = index + 1; // Not a tie, rank is index + 1
          ranks.push(currentRank);
          currentScore = score;
        }
      }
    });
    return ranks;
  };

  const participantRanks = isDivingPrint ? divingRankedParticipants.map(({ rank }) => rank) : getRanks(sortedParticipants);
  const completedParticipantCount = sortedParticipants.filter((participant) => !getScoreData(participant).isAbsent).length;
  const isDivingDetailPrint = isDivingPrint && schedule?.divingPrintType === 'detail';
  const isStrengthDetailPrint = isStrengthPrint && schedule?.divingPrintType === 'detail';
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');
  const refereeGroup = getRefereeGroup(schedule);
  const refereeNames = refereeGroup ? refereeGroupsByCourt[refereeGroup] : [];
  const refereeNameRows = refereeNames.length ? [
    refereeNames.slice(0, Math.ceil(refereeNames.length / 2)),
    refereeNames.slice(Math.ceil(refereeNames.length / 2))
  ] : [];
  const updateDivingJudgeName = (index, value) => {
    const names = divingJudgeNames.map((name, nameIndex) => nameIndex === index ? value : name);
    setDivingJudgeNames(names);
    localStorage.setItem('diving_judge_names', JSON.stringify(names));
  };
  const updateDivingReserveName = (value) => {
    setDivingReserveName(value);
    localStorage.setItem('diving_reserve_name', value);
  };
  const getAwardLevel = (rank) => {
    if (!rank || rank === '-' || completedParticipantCount <= 0) return '-';
    const firstPrizeLimit = Math.max(1, Math.ceil(completedParticipantCount * 0.3));
    const secondPrizeLimit = Math.max(firstPrizeLimit, Math.ceil(completedParticipantCount * 0.6));
    if (rank <= firstPrizeLimit) return '一等奖';
    if (rank <= secondPrizeLimit) return '二等奖';
    return '三等奖';
  };
  const showPrizeLevels = Boolean(schedule?.showPrizeLevels) && !isTeamRanking;
  const showCombinedColumns = !isTeamRanking && sortedParticipants.some(p => results[p.__printKey || p._id || p]?.isCombined);
  const combinedSubEvents = showCombinedColumns
    ? (
        results[
          (sortedParticipants.find(p => results[p.__printKey || p._id || p]?.isCombined && results[p.__printKey || p._id || p]?.subEvents)?.__printKey)
            || (sortedParticipants.find(p => results[p.__printKey || p._id || p]?.isCombined && results[p.__printKey || p._id || p]?.subEvents)?._id)
        ]?.subEvents || []
      )
    : [];
  const showAwardColumn = !isTeamRanking && !showPrizeLevels && sortedParticipants.some(p => results[p.__printKey || p._id || p]?.isAwarded !== undefined);
  const emptyColSpan = 2 + (isTeamRanking ? 0 : 1) + (showCombinedColumns ? combinedSubEvents.length : 0) + (showAwardColumn ? 1 : 0) + 1;

  const renderDivingRankTable = () => {
    const leader = sortedParticipants.find((participant) => !getScoreData(participant).isAbsent);
    const leaderScore = leader ? getScoreData(leader).finalScore : 0;
    return (
    <TableContainer sx={{ border: '1px solid black' }}>
      <Table size="small" sx={{
        '& .MuiTableCell-root': {
          borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 6px',
          color: 'black', fontSize: '12pt', fontFamily: '"SimSun", "宋体", serif', whiteSpace: 'nowrap'
        },
        '& .MuiTableCell-root:last-child': { borderRight: 'none' },
        '& .MuiTableCell-root:nth-of-type(2), & .MuiTableCell-root:nth-of-type(3)': { whiteSpace: 'normal', wordBreak: 'break-all', overflowWrap: 'anywhere' }
      }}>
        <TableHead>
          <TableRow>
            {['名次', '姓名', '单位', '成绩', '分差', '备注'].map((header) => (
              <TableCell key={header} align="center" sx={{ fontWeight: 'bold' }}>{header}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedParticipants.map((participant, participantIndex) => {
            const { finalScore, isAbsent } = getScoreData(participant);
            const name = participant?.isVirtualTeam ? (participant.teamMembers || []).map((member) => member.name).join('、') : (participant?.teamName || participant?.name || participant?.user?.name || '未知');
            const unit = participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-';
            return <TableRow key={participant._id || participantIndex}>
              <TableCell align="center">{participantRanks[participantIndex]}</TableCell>
              <TableCell align="center">{name}</TableCell><TableCell align="center">{unit}</TableCell>
              <TableCell align="center">{isAbsent ? '弃权' : Number(finalScore || 0).toFixed(2)}</TableCell>
              <TableCell align="center">{isAbsent || participantRanks[participantIndex] === 1 ? '' : (leaderScore - finalScore).toFixed(2)}</TableCell>
              <TableCell align="center">{isAbsent ? '弃权' : ''}</TableCell>
            </TableRow>;
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
  };

  const renderDivingDetailTable = () => {
    const totals = sortedParticipants.map(() => 0);
    const rounds = Math.max(1, ...sortedParticipants.map((participant) => results[participant.__printKey || participant._id || participant]?.details?.dives?.length || 0));
    const roundRanks = Array.from({ length: rounds }, (_, roundIndex) => {
      const rows = sortedParticipants.map((participant, participantIndex) => {
        const { isAbsent } = getScoreData(participant);
        const diveScore = Number(results[participant.__printKey || participant._id || participant]?.details?.dives?.[roundIndex]?.score || 0);
        totals[participantIndex] += diveScore;
        return { participantIndex, isAbsent, score: totals[participantIndex] };
      }).sort((a, b) => Number(a.isAbsent) - Number(b.isAbsent) || b.score - a.score);
      let rank = 0;
      let previousScore;
      return new Map(rows.map((row, index) => {
        if (row.isAbsent) return [row.participantIndex, '-'];
        if (index === 0 || row.score !== previousScore) rank = index + 1;
        previousScore = row.score;
        return [row.participantIndex, rank];
      }));
    });
    const leader = sortedParticipants.find((participant) => !getScoreData(participant).isAbsent);
    const leaderScore = leader ? getScoreData(leader).finalScore : 0;
    const headings = ['姓名', '单位', '动作', '难度', 'E1', 'E2', 'E3', 'E4', 'E5', '得分', '轮次名次', '累计分', '总名次', '分差'];
    const columnWidths = ['12%', '13%', '15.5%', '5%', '4.5%', '4.5%', '4.5%', '4.5%', '4.5%', '6%', '6%', '7%', '7%', '5%'];
    return <TableContainer>
      <Table size="small" className="diving-detail-table" sx={{ tableLayout: 'fixed', width: '100%',
        '& .MuiTableHead-root .MuiTableCell-root': { border: '1px solid black', padding: '3px 2px', color: 'black', fontSize: '9.5pt', lineHeight: 1.25, fontFamily: '"SimSun", "宋体", serif', whiteSpace: 'nowrap' },
        '& .MuiTableBody-root .MuiTableCell-root': { border: 'none', padding: '3px 2px', color: 'black', fontSize: '9.5pt', lineHeight: 1.25, fontFamily: '"SimSun", "宋体", serif', whiteSpace: 'nowrap' }
      }}>
        <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
        <TableHead><TableRow>{headings.map((header) => <TableCell key={header} align="center" sx={{ fontWeight: 'bold' }}>{header === '轮次名次' ? <>轮次<br />名次</> : header}</TableCell>)}</TableRow></TableHead>
        <TableBody>{sortedParticipants.flatMap((participant, participantIndex) => {
          const { finalScore, isAbsent } = getScoreData(participant);
          const dives = results[participant.__printKey || participant._id || participant]?.details?.dives || [];
          const count = Math.max(1, dives.length);
          const name = participant?.isVirtualTeam ? (participant.teamMembers || []).map((member) => member.name).join('、') : (participant?.teamName || participant?.name || participant?.user?.name || '未知');
          const unit = participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-';
          let cumulative = 0;
          const participantRows = Array.from({ length: count }, (_, roundIndex) => {
            const dive = dives[roundIndex];
            cumulative += Number(dive?.score || 0);
            return <TableRow key={`${participant._id || participantIndex}-${roundIndex}`}>
              {roundIndex === 0 && <TableCell rowSpan={count} align="center" className="detail-name-cell" sx={{ whiteSpace: 'normal', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{participant?.isVirtualTeam ? (participant.teamMembers || []).map((member, memberIndex) => <React.Fragment key={member._id || memberIndex}>{member.name}{memberIndex < participant.teamMembers.length - 1 && <br />}</React.Fragment>) : name}</TableCell>}
              {roundIndex === 0 && <TableCell rowSpan={count} align="center" className="detail-unit-cell" sx={{ whiteSpace: 'normal', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{unit}</TableCell>}
              <TableCell align="center" className="detail-action-cell">{dive?.actionCode || dive?.actionName || (isAbsent ? '弃权' : '-')}</TableCell><TableCell align="center">{dive?.difficulty ?? '-'}</TableCell>
              {[0, 1, 2, 3, 4].map((judge) => <TableCell key={judge} align="center">{dive?.scores?.[judge] ?? '-'}</TableCell>)}
              <TableCell align="center">{dive ? Number(dive.score || 0).toFixed(2) : '-'}</TableCell><TableCell align="center">{dive ? roundRanks[roundIndex]?.get(participantIndex) ?? '-' : '-'}</TableCell><TableCell align="center">{dive ? cumulative.toFixed(2) : '-'}</TableCell>
              {roundIndex === 0 && <TableCell rowSpan={count} align="center">{participantRanks[participantIndex]}</TableCell>}
              {roundIndex === 0 && <TableCell rowSpan={count} align="center">{isAbsent || participantRanks[participantIndex] === 1 ? '' : (leaderScore - finalScore).toFixed(2)}</TableCell>}
            </TableRow>;
          });
          if (participantIndex < sortedParticipants.length - 1) {
            participantRows.push(<TableRow key={`${participant._id || participantIndex}-spacer`} sx={{ height: 14 }}><TableCell colSpan={headings.length} sx={{ border: 'none !important', p: '0 !important', fontSize: 0 }} /></TableRow>);
          }
          return participantRows;
        })}</TableBody>
      </Table>
    </TableContainer>;
  };

  const renderStrengthDetailTable = () => {
    return <TableContainer sx={{ border: '1px solid black' }}><Table size="small" sx={{ '& .MuiTableCell-root': { borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px 4px', color: 'black', fontSize: '10px', fontFamily: '"SimSun", "宋体", serif', whiteSpace: 'nowrap' }, '& .MuiTableCell-root:nth-of-type(2), & .MuiTableCell-root:nth-of-type(3)': { whiteSpace: 'normal', wordBreak: 'break-all', overflowWrap: 'anywhere' } }}><TableHead><TableRow><TableCell align="center">名次</TableCell><TableCell align="center">姓名</TableCell><TableCell align="center">单位</TableCell>{strengthEventNames.flatMap((name) => [<TableCell key={`${name}-raw`} align="center">{name}原始成绩</TableCell>, <TableCell key={`${name}-points`} align="center">{name}积分</TableCell>])}<TableCell align="center">总分</TableCell><TableCell align="center">备注</TableCell></TableRow></TableHead><TableBody>{sortedParticipants.map((participant, index) => { const result = results[participant.__printKey || participant._id || participant]; const data = getScoreData(participant); const events = result?.details?.events || []; const name = participant?.name || participant?.user?.name || '未知'; const unit = participant?.schoolName || participant?.teamName || '-'; return <TableRow key={participant._id || index}><TableCell align="center">{participantRanks[index]}</TableCell><TableCell align="center">{name}</TableCell><TableCell align="center">{unit}</TableCell>{strengthEventNames.flatMap((eventName) => { const event = events.find((item) => normalizeStrengthActionName(item.actionName) === eventName); return [<TableCell key={`${eventName}-raw`} align="center">{data.isAbsent ? '弃权' : (event?.rawScore ?? '-')}</TableCell>, <TableCell key={`${eventName}-points`} align="center">{event?.points ?? '-'}</TableCell>]; })}<TableCell align="center">{data.isAbsent ? '弃权' : data.finalScore}</TableCell><TableCell align="center">{data.isAbsent ? '弃权' : ''}</TableCell></TableRow>; })}</TableBody></Table></TableContainer>;
  };

  const renderStrengthRankTable = () => <TableContainer sx={{ border: '1px solid black' }}><Table size="small" sx={{ '& .MuiTableCell-root': { borderBottom: '1px solid black', borderRight: '1px solid black', padding: '4px 5px', color: 'black', fontSize: '11px', fontFamily: '"SimSun", "宋体", serif', whiteSpace: 'nowrap' }, '& .MuiTableCell-root:nth-of-type(2), & .MuiTableCell-root:nth-of-type(3)': { whiteSpace: 'normal', wordBreak: 'break-all', overflowWrap: 'anywhere' } }}><TableHead><TableRow>{['名次', '姓名', '单位', '总分', '备注'].map((heading) => <TableCell key={heading} align="center" sx={{ fontWeight: 'bold' }}>{heading}</TableCell>)}</TableRow></TableHead><TableBody>{sortedParticipants.map((participant, index) => { const data = getScoreData(participant); const name = participant?.name || participant?.user?.name || '未知'; const unit = participant?.schoolName || participant?.teamName || '-'; return <TableRow key={participant._id || index}><TableCell align="center">{participantRanks[index]}</TableCell><TableCell align="center">{name}</TableCell><TableCell align="center">{unit}</TableCell><TableCell align="center">{data.isAbsent ? '弃权' : data.finalScore}</TableCell><TableCell align="center">{data.isAbsent ? '弃权' : ''}</TableCell></TableRow>; })}</TableBody></Table></TableContainer>;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      scroll="paper"
      className="print-dialog-root"
    >
      {/* Print Styles */}
      <style>{`
        @media print {
          /* 打分页会先隐藏全页；弹层打印内容必须显式恢复可见。 */
          body * { visibility: hidden !important; }
          .print-dialog-root, .print-dialog-root * { visibility: visible !important; }
          body:has(.print-dialog-root) .print-container {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Ensure the dialog is visible and takes full space */
          .print-dialog-root {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 9999 !important;
            display: block !important;
            background-color: white !important;
          }

          /* Reset Dialog internal layout */
          .print-dialog-root .MuiDialog-container {
            display: block !important;
            height: auto !important;
            min-height: auto !important;
          }
          
          .print-dialog-root .MuiPaper-root {
            box-shadow: none !important;
            max-width: 100% !important;
            max-height: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            width: 100% !important;
            height: auto !important;
            background-color: white !important;
          }

          .print-dialog-root .MuiDialogContent-root {
            overflow: visible !important;
            padding: 0 !important;
          }

          /* Hide non-print elements inside the dialog */
          .no-print, .MuiBackdrop-root {
            display: none !important;
          }

          /* Ensure print content is visible */
          .printable-content {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
          }

          .diving-detail-table .MuiTableCell-root {
            font-size: 9.5pt !important;
            padding: 3px 2px !important;
          }

          .diving-detail-table .detail-name-cell,
          .diving-detail-table .detail-unit-cell,
          .diving-detail-table .detail-action-cell {
            white-space: normal !important;
            word-break: break-all !important;
            overflow-wrap: anywhere !important;
          }

          .chief-signature {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Force page margins */
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          
          /* Remove background colors that might cause black pages */
          html, body {
            background-color: white !important;
            height: auto !important;
            min-height: auto !important;
          }
        }
      `}</style>

      <DialogTitle className="no-print">
        打印预览与设置
        <Typography variant="caption" display="block" color="text.secondary">
          您可以在下方修改标题和备注信息，确认无误后点击打印。
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Editing Controls - Hidden on Print */}
        <Box sx={{ mb: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }} className="no-print">
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="打印标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button variant="outlined" component="label" sx={{ height: '40px', flexGrow: 1 }}>
                  上传裁判长电子签
                  <input type="file" hidden accept="image/*" onChange={handleSignatureUpload} />
                </Button>
                {signatureImage && (
                  <Button size="small" color="error" variant="text" onClick={() => { setSignatureImage(''); localStorage.removeItem('chief_signature'); }}>
                    清除
                  </Button>
                )}
              </Box>
            </Grid>
            {isDivingPrint && isAdmin && <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 1 }}>跳水裁判员姓名（将显示在公告页尾）</Typography>
              <Grid container spacing={1}>
                {divingJudgeNames.map((name, index) => <Grid item xs={12} sm={6} md={4} key={index}><TextField fullWidth size="small" label={`裁判员 ${index + 1}`} value={name} onChange={(event) => updateDivingJudgeName(index, event.target.value)} /></Grid>)}
                <Grid item xs={12} sm={6} md={4}><TextField fullWidth size="small" label="候补" value={divingReserveName} onChange={(event) => updateDivingReserveName(event.target.value)} /></Grid>
              </Grid>
            </Grid>}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="副标题（时间/地点）"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>
        </Box>

        {/* Preview Area - This is what gets printed */}
        <Box 
          className="printable-content"
          sx={{ 
            p: 4, 
            bgcolor: 'white', 
            minHeight: '297mm',
            color: 'black',
            '@media print': {
              margin: '0',
              padding: '0',
              border: 'none',
              minHeight: 'auto',
            }
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: (isDivingPrint || isStrengthPrint) ? 1.5 : 4 }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              mb: 1, 
              fontSize: isTeamRanking ? (title.length > 20 ? '26px' : '32px') : (title.length > 20 ? '20px' : '24px'), // 团体分用大字号，普通打印用回较小字号
              whiteSpace: 'pre-wrap', // 允许换行
              lineHeight: 1.5,
              fontFamily: isTeamRanking ? '"SimHei", "黑体", sans-serif' : 'inherit' // 标题使用黑体更显正式
            }}>
              {title}
            </Typography>
            {isDivingPrint || isStrengthPrint ? <>
              <Typography sx={{ fontSize: '18px', fontFamily: '"SimHei", "黑体", sans-serif', mb: 0.5 }}>{isStrengthPrint ? (isStrengthDetailPrint ? '素质力量明细成绩公告' : '素质力量名次公告') : (isDivingDetailPrint ? '明细成绩公告' : '名次公告')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)', columnGap: 1, alignItems: 'center', fontSize: '14px', fontFamily: '"SimSun", "宋体", serif' }}>
                <span style={{ textAlign: 'left', overflowWrap: 'anywhere' }}>{isStrengthPrint ? '跳水·素质力量' : '跳水'}</span><span style={{ textAlign: 'center', overflowWrap: 'anywhere' }}>{schedule.name}</span><span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{schedule.startTime ? new Date(schedule.startTime).toLocaleDateString() : ''} {schedule.location || ''}</span>
              </Box>
            </> : <Typography variant="subtitle1" sx={{ fontSize: isTeamRanking ? '18px' : '14px', mt: 2 }}>{subTitle}</Typography>}
          </Box>

          {/* Table */}
          {isStrengthPrint ? (isStrengthDetailPrint ? renderStrengthDetailTable() : renderStrengthRankTable()) : isDivingPrint ? (isDivingDetailPrint ? renderDivingDetailTable() : renderDivingRankTable()) : <TableContainer sx={{ border: '2px solid black' }}>
            <Table size="medium" sx={{ 
              '& .MuiTableCell-root': { 
                borderBottom: '1px solid black',
                borderRight: '1px solid black',
                padding: isTeamRanking ? '12px 16px' : '6px 16px', // 团体分打印时大间距，否则普通间距
                fontSize: isTeamRanking ? '18px' : '14px',         // 团体分打印大字体，否则常规字体
                color: 'black',      // Ensure black text
                fontFamily: isTeamRanking ? '"SimSun", "宋体", serif' : 'inherit' // 正文使用宋体更符合正式公文规范
              },
              '& .MuiTableCell-root:last-child': {
                borderRight: 'none'
              }
            }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" width="100" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{isTeamRanking ? '名次' : (showPrizeLevels ? '奖项' : '名次')}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{isTeamRanking ? '单位' : '姓名'}</TableCell>
                  {!isTeamRanking && <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>代表队/学校</TableCell>}
                  {showCombinedColumns && combinedSubEvents.map(subName => (
                    <TableCell key={subName} align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{subName}</TableCell>
                  ))}

                  {showAwardColumn && <TableCell align="center" width="110" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>录取</TableCell>}
                  <TableCell align="center" width="120" sx={{ fontWeight: 'bold', color: 'black', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{isTeamRanking ? '总分' : '最终得分'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedParticipants.map((participant, index) => {
                  const { finalScore, isAbsent } = getScoreData(participant);
                  const resultObj = results[participant.__printKey || participant._id || participant];
                  
                  let displayContent;
                  if (participant?.isVirtualTeam && participant?.teamMembers && participant.teamMembers.length > 0) {
                    displayContent = participant.teamMembers.map((m, i) => (
                      <React.Fragment key={m._id || i}>
                        <span style={{ whiteSpace: 'nowrap' }}>{m.name}</span>
                        {i < participant.teamMembers.length - 1 ? '、' : ''}
                      </React.Fragment>
                    ));
                  } else if (participant?.type === 'team' && participant?.teamName) {
                    displayContent = participant.teamName;
                  } else {
                    displayContent = participant?.name || (participant?.user && participant.user.name) || '未知';
                  }

                  const isCombined = resultObj?.isCombined;
                  const subEventsList = isCombined ? (resultObj?.subEvents || []) : [];

                  return (
                    <TableRow key={participant._id || index}>
                      <TableCell align="center" sx={{ 
                        // 为名次列强制不换行，保持美观
                        whiteSpace: 'nowrap'
                      }}>{
                        // 将阿拉伯数字替换为中文名次（仅针对前几名）
                        isTeamRanking ? 
                          (participantRanks[index] === 1 ? '第一名' :
                           participantRanks[index] === 2 ? '第二名' :
                           participantRanks[index] === 3 ? '第三名' :
                           participantRanks[index] === 4 ? '第四名' :
                           participantRanks[index] === 5 ? '第五名' :
                           participantRanks[index] === 6 ? '第六名' :
                           participantRanks[index] === 7 ? '第七名' :
                           participantRanks[index] === 8 ? '第八名' : participantRanks[index])
                        : (showPrizeLevels ? getAwardLevel(participantRanks[index]) : participantRanks[index])
                      }</TableCell>
                      <TableCell align="center" sx={{
                        // 控制集体项目的名单排版
                        whiteSpace: 'normal',
                        wordBreak: 'normal', // 恢复正常换行，避免切断名字
                        lineHeight: 1.8
                      }}>{displayContent}</TableCell>
                      {!isTeamRanking && <TableCell align="center">{participant.schoolName || participant.teamName || (participant?.user && participant.user.schoolName) || '-'}</TableCell>}
                      {showCombinedColumns && combinedSubEvents.map(subName => {
                        if (isCombined && resultObj?.subScores && resultObj.subScores[subName]) {
                          const subData = resultObj.subScores[subName];
                          return (
                            <TableCell key={subName} align="center">
                              {subData.isAbsent ? '弃权' : (subData.score > 0 ? subData.score.toFixed(2) : '0')}
                            </TableCell>
                          );
                        }
                        return <TableCell key={subName} align="center">-</TableCell>;
                      })}

                      {showAwardColumn && <TableCell align="center">{resultObj?.awardLevel || (resultObj?.isAwarded ? '录取' : '未录取')}</TableCell>}
                      <TableCell align="center">
                        {isAbsent ? '弃权' : (finalScore > 0 ? (isTeamRanking ? `${finalScore} 分` : finalScore.toFixed(2)) : '-')}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedParticipants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={emptyColSpan} align="center">暂无数据</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>}

          {/* Footer Signature Area */}
          {isDivingPrint && <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px 24px', fontSize: '12pt', color: 'black', fontFamily: '"SimSun", "宋体", serif', lineHeight: 1.8 }}>
            {divingJudgeNames.map((name, index) => <Box key={index}>裁判员 {index + 1}：{name || '________________'}</Box>)}
            <Box>候补：{divingReserveName || '________________'}</Box>
          </Box>}

          {isStrengthPrint && refereeNames.length > 0 && <Box sx={{ mt: 3, fontSize: '12pt', color: 'black', fontFamily: '"SimSun", "宋体", serif', lineHeight: 1.8 }}>
            <Box sx={{ letterSpacing: '0.35em' }}>裁 判 员：</Box>
            <Box sx={{ textAlign: 'center', mt: 0.5 }}>
              <Box>{refereeGroup} 组：</Box>
              {refereeNameRows.map((names, index) => <Box key={index}>{names.join('、')}</Box>)}
            </Box>
          </Box>}

          <Box className="chief-signature" sx={{ mt: (isDivingPrint || isStrengthPrint) ? 2 : 6, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontSize: isTeamRanking ? '16px' : '14px', fontFamily: isTeamRanking ? '"SimSun", "宋体", serif' : 'inherit' }}>
            总裁判长签名：
            {signatureImage ? <img src={signatureImage} alt="裁判长签名" style={{ maxHeight: '50px', maxWidth: '150px', marginLeft: '10px' }} /> : '________________________'}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="no-print">
        <Button onClick={onClose}>取消</Button>
        <Button 
          variant="contained" 
          startIcon={<PrintIcon />} 
          onClick={handlePrint}
        >
          打印
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintPreviewModal;
