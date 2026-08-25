import React, { useState, useRef } from 'react';
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

const PrintPreviewModal = ({ open, onClose, schedule, participants, results, user, isTeamRanking = false }) => {
  // Use React's useEffect to automatically sync the title and subtitle when the schedule prop changes
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [signatureImage, setSignatureImage] = useState(localStorage.getItem('chief_signature') || '');

  React.useEffect(() => {
    if (open && schedule) {
      setTitle(`${schedule.name || '比赛'} - 成绩公告`);
      setSubTitle(`日期：${schedule.startTime ? new Date(schedule.startTime).toLocaleDateString() : ''} | 地点：${schedule.location || ''}`);
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

  // Sort participants by final score (descending), absent at the bottom
  const sortedParticipants = (() => {
    // 团体分打印时不需要排序，因为传入的时候已经排好序了
    if (isTeamRanking) {
      return [...participants];
    }
    return [...participants].sort((a, b) => {
      const dataA = getScoreData(a);
      const dataB = getScoreData(b);
      if (dataA.isAbsent && dataB.isAbsent) return 0;
      if (dataA.isAbsent) return 1;
      if (dataB.isAbsent) return -1;
      return dataB.finalScore - dataA.finalScore;
    });
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
        if (score === currentScore) {
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

  const participantRanks = getRanks(sortedParticipants);
  const completedParticipantCount = sortedParticipants.filter((participant) => !getScoreData(participant).isAbsent).length;
  const getAwardLevel = (rank) => {
    if (!rank || rank === '-' || completedParticipantCount <= 0) return '-';
    const firstPrizeLimit = Math.max(1, Math.ceil(completedParticipantCount * 0.3));
    const secondPrizeLimit = Math.max(firstPrizeLimit, Math.ceil(completedParticipantCount * 0.6));
    if (rank <= firstPrizeLimit) return '一等奖';
    if (rank <= secondPrizeLimit) return '二等奖';
    return '三等奖';
  };
  const showCombinedColumns = !isTeamRanking && sortedParticipants.some(p => results[p.__printKey || p._id || p]?.isCombined);
  const combinedSubEvents = showCombinedColumns
    ? (
        results[
          (sortedParticipants.find(p => results[p.__printKey || p._id || p]?.isCombined && results[p.__printKey || p._id || p]?.subEvents)?.__printKey)
            || (sortedParticipants.find(p => results[p.__printKey || p._id || p]?.isCombined && results[p.__printKey || p._id || p]?.subEvents)?._id)
        ]?.subEvents || []
      )
    : [];
  const emptyColSpan = 2 + (isTeamRanking ? 0 : 1) + (showCombinedColumns ? combinedSubEvents.length : 0) + 1;

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
          /* Hide everything in body except our dialog */
          body > *:not(.print-dialog-root) {
            display: none !important;
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

          /* Force page margins */
          @page {
            size: A4;
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
            minHeight: '297mm', // A4 height approx
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
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              mb: 1, 
              fontSize: isTeamRanking ? (title.length > 20 ? '26px' : '32px') : (title.length > 20 ? '20px' : '24px'), // 团体分用大字号，普通打印用回较小字号
              whiteSpace: 'pre-wrap', // 允许换行
              lineHeight: 1.5,
              fontFamily: isTeamRanking ? '"SimHei", "黑体", sans-serif' : 'inherit' // 标题使用黑体更显正式
            }}>
              {/* 如果包含连字符或较长，允许它自然换行 */}
              {title}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontSize: isTeamRanking ? '18px' : '14px', mt: 2 }}>
              {subTitle}
            </Typography>
          </Box>

          {/* Table */}
          <TableContainer sx={{ border: '2px solid black' }}>
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
                  <TableCell align="center" width="100" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{isTeamRanking ? '名次' : '奖项'}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{isTeamRanking ? '单位' : '姓名'}</TableCell>
                  {!isTeamRanking && <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>代表队/学校</TableCell>}
                  {showCombinedColumns && combinedSubEvents.map(subName => (
                    <TableCell key={subName} align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: isTeamRanking ? '20px' : '14px' }}>{subName}</TableCell>
                  ))}

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
                        : getAwardLevel(participantRanks[index])
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
          </TableContainer>

          {/* Footer Signature Area */}
          <Box sx={{ mt: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: isTeamRanking ? '16px' : '14px', fontFamily: isTeamRanking ? '"SimSun", "宋体", serif' : 'inherit' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              总裁判长签名：
              {signatureImage ? (
                <img src={signatureImage} alt="裁判长签名" style={{ maxHeight: '50px', marginLeft: '10px' }} />
              ) : (
                '________________________'
              )}
            </Box>
            {/* 暂时隐藏底部的日期，因为你的参考图里没有 */}
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
