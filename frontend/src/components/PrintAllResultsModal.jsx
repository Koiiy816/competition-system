import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';

// Convert number to Chinese rank
const getChineseRank = (num) => {
  const map = { 1: '第一名', 2: '第二名', 3: '第三名', 4: '第四名', 5: '第五名', 6: '第六名', 7: '第七名', 8: '第八名' };
  return map[num] || `第${num}名`;
};

const PrintAllResultsModal = ({ open, onClose, groupedResults, competition, teamRankings = [] }) => {
  const [signatureImage, setSignatureImage] = useState(localStorage.getItem('chief_signature') || '');

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

  if (!competition) return null;

  // Render a single schedule's table
  const renderScheduleTable = (scheduleName, scheduleResults) => {
    // 过滤掉测试人员
    const validResults = scheduleResults.filter(r => !r.participant?.isTest);
    
    // Sort
    const sortedResults = [...validResults].sort((a, b) => {
      const aAbsent = a.details?.isAbsent || false;
      const bAbsent = b.details?.isAbsent || false;
      if (aAbsent && bAbsent) return 0;
      if (aAbsent) return 1;
      if (bAbsent) return -1;
      
      const scoreA = typeof a.finalScore === 'number' ? a.finalScore : (typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0);
      const scoreB = typeof b.finalScore === 'number' ? b.finalScore : (typeof b.score === 'number' ? b.score : parseFloat(b.score) || 0);
      return scoreB - scoreA;
    });

    // Calculate Ranks
    const ranks = [];
    let currentRank = 1;
    let currentScore = -1;
    
    sortedResults.forEach((r, index) => {
      const isAbsent = r.details?.isAbsent || false;
      if (isAbsent) {
        ranks.push('-');
        return;
      }
      const score = typeof r.finalScore === 'number' ? r.finalScore : (typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0);
      if (index === 0) {
        ranks.push(currentRank);
        currentScore = score;
      } else {
        if (score === currentScore) {
          ranks.push(currentRank);
        } else {
          currentRank = index + 1;
          ranks.push(currentRank);
          currentScore = score;
        }
      }
    });

    const completedParticipantCount = sortedResults.filter((result) => !result.details?.isAbsent).length;
    const getAwardLevel = (rank) => {
      if (!rank || rank === '-' || completedParticipantCount <= 0) return '-';
      const firstPrizeLimit = Math.max(1, Math.ceil(completedParticipantCount * 0.3));
      const secondPrizeLimit = Math.max(firstPrizeLimit, Math.ceil(completedParticipantCount * 0.6));
      if (rank <= firstPrizeLimit) return '一等奖';
      if (rank <= secondPrizeLimit) return '二等奖';
      return '三等奖';
    };

    const isCombined = sortedResults.some(r => r.isCombined);
    const combinedSubEvents = isCombined ? (sortedResults.find(r => r.isCombined)?.subEvents || []) : [];
    
    // Determine admission count and team points rule
    const getScheduleRuleSummary = () => {
      let eventConfig = competition.events?.find(e => e.name === scheduleName.split(' ')[2]);
      if (!eventConfig) {
        const potentialEventName = scheduleName.split(' ').slice(2).join(' ');
        eventConfig = competition.events?.find(e => e.name === potentialEventName);
      }
      const participantCount = sortedResults.length;
      let admissionCount = participantCount > 8 ? 8 : Math.max(0, participantCount - 1);
      
      const isLuohuTraditionalCompetition = competition.name?.includes('2026年深圳市罗湖区青少年传统武术 锦标赛竞赛');
      const isLuohuExcludedTeamScoreEvent = isLuohuTraditionalCompetition && (scheduleName.includes('集体武术操') || scheduleName.includes('幼儿集体拳'));
      
      if (isLuohuTraditionalCompetition) {
        if (isLuohuExcludedTeamScoreEvent) {
          admissionCount = 8;
        } else {
          if (participantCount >= 8) admissionCount = 8;
          else if (participantCount === 1) admissionCount = 1;
          else if (participantCount === 2) admissionCount = 1;
          else admissionCount = participantCount - 1;
        }
      }
      
      return admissionCount;
    };
    
    const admissionCount = getScheduleRuleSummary();
    const showAwardColumn = sortedResults.some((_, i) => ranks[i] !== '-' && ranks[i] <= admissionCount);

    const isDivingResults = sortedResults.some((result) => result.details?.scoringType === 'diving' && Array.isArray(result.details?.dives));
    if (isDivingResults) {
      const maxRounds = Math.max(1, ...sortedResults.map((result) => result.details?.dives?.length || 0));
      const eventDate = competition.startDate ? new Date(competition.startDate).toLocaleDateString() : '';
      return (
        <Box sx={{ mb: 4, pageBreakInside: 'avoid' }} key={scheduleName}>
          <Box sx={{ textAlign: 'center', mb: 1.5, fontFamily: '"SimSun", "宋体", serif' }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 'bold', fontFamily: '"SimHei", "黑体", sans-serif' }}>{competition.name}</Typography>
            <Typography sx={{ fontSize: '16px', fontWeight: 'bold', fontFamily: '"SimHei", "黑体", sans-serif' }}>成绩公告</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', mt: 0.5 }}><span>跳水</span><span>{eventDate}</span></Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>{scheduleName}</span><span>{competition.location || ''}</span></Box>
          </Box>
          <TableContainer sx={{ border: '1px solid black' }}>
            <Table size="small" sx={{
              '& .MuiTableCell-root': {
                borderBottom: '1px solid black', borderRight: '1px solid black', padding: '3px 5px',
                color: 'black', fontSize: '11px', fontFamily: '"SimSun", "宋体", serif', whiteSpace: 'nowrap'
              },
              '& .MuiTableCell-root:last-child': { borderRight: 'none' }
            }}>
              <TableHead><TableRow>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>姓名</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>单位</TableCell>
                {Array.from({ length: maxRounds }, (_, index) => <TableCell key={index} align="center" sx={{ fontWeight: 'bold' }}>第{index + 1}轮</TableCell>)}
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>总分</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>名次</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>备注</TableCell>
              </TableRow></TableHead>
              <TableBody>{sortedResults.map((result, index) => {
                const participant = result.participant;
                const dives = result.details?.dives || [];
                const isAbsent = result.details?.isAbsent || false;
                const name = participant?.isVirtualTeam ? (participant.teamMembers || []).map((member) => member.name).join('、') : (participant?.teamName || participant?.name || participant?.user?.name || '未知');
                const unit = participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-';
                const score = typeof result.finalScore === 'number' ? result.finalScore : (typeof result.score === 'number' ? result.score : parseFloat(result.score) || 0);
                return <React.Fragment key={result._id || index}>
                  <TableRow>
                    <TableCell rowSpan={2} align="center">{name}</TableCell>
                    <TableCell rowSpan={2} align="center">{unit}</TableCell>
                    {Array.from({ length: maxRounds }, (_, diveIndex) => <TableCell key={diveIndex} align="center">{dives[diveIndex]?.actionName || dives[diveIndex]?.actionCode || '-'}</TableCell>)}
                    <TableCell rowSpan={2} align="center">{isAbsent ? '弃权' : score.toFixed(2)}</TableCell>
                    <TableCell rowSpan={2} align="center">{ranks[index]}</TableCell>
                    <TableCell rowSpan={2} align="center" />
                  </TableRow>
                  <TableRow>{Array.from({ length: maxRounds }, (_, diveIndex) => <TableCell key={diveIndex} align="center">{dives[diveIndex] ? Number(dives[diveIndex].score || 0).toFixed(2) : '-'}</TableCell>)}</TableRow>
                </React.Fragment>;
              })}</TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    }

    return (
      <Box sx={{ mb: 6, pageBreakInside: 'avoid' }} key={scheduleName}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center', fontFamily: '"SimHei", "黑体", sans-serif' }}>
          {scheduleName}
        </Typography>
        <TableContainer sx={{ border: '2px solid black' }}>
          <Table size="small" sx={{ 
            '& .MuiTableCell-root': { 
              borderBottom: '1px solid black',
              borderRight: '1px solid black',
              padding: '6px 16px',
              color: 'black',
              fontFamily: '"SimSun", "宋体", serif'
            },
            '& .MuiTableCell-root:last-child': {
              borderRight: 'none'
            }
          }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" width="80" sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>奖项</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>姓名/代表队</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>单位</TableCell>
                <TableCell align="center" width="100" sx={{ fontWeight: 'bold', bgcolor: '#ffffff' }}>最终得分</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedResults.map((r, index) => {
                const isAbsent = r.details?.isAbsent || false;
                const score = typeof r.finalScore === 'number' ? r.finalScore : (typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0);
                const rank = ranks[index];
                
                let displayName = '未知';
                const p = r.participant;
                if (p?.isVirtualTeam && p?.teamMembers && p.teamMembers.length > 0) {
                  displayName = p.teamMembers.map(m => m.name).join('、');
                } else if (p?.type === 'team' && p?.teamName) {
                  displayName = p.teamName;
                } else if (p?.name) {
                  displayName = p.name;
                } else if (p?.user && p.user.name) {
                  displayName = p.user.name;
                }
                
                const schoolName = p?.schoolName || p?.teamName || '-';

                return (
                  <TableRow key={r._id || index}>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {isAbsent ? '-' : getAwardLevel(rank)}
                    </TableCell>
                    <TableCell align="center">{displayName}</TableCell>
                    <TableCell align="center">{schoolName}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      {isAbsent ? '缺席/弃权' : (score > 0 ? score.toFixed(2) : '-')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Render team rankings table
  const renderTeamRankingsTable = () => {
    if (!teamRankings || teamRankings.length === 0) return null;
    
    // Only take top 8
    const topTeams = teamRankings.slice(0, 8);
    
    return (
      <Box sx={{ mb: 6, pageBreakInside: 'avoid' }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center', fontFamily: '"SimHei", "黑体", sans-serif' }}>
          团体总分榜
        </Typography>
        <TableContainer sx={{ border: '2px solid black' }}>
          <Table size="small" sx={{ 
            '& .MuiTableCell-root': { 
              borderBottom: '1px solid black',
              borderRight: '1px solid black',
              padding: '8px 16px',
              color: 'black',
              fontFamily: '"SimSun", "宋体", serif'
            },
            '& .MuiTableCell-root:last-child': {
              borderRight: 'none'
            }
          }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" width="100" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: '16px' }}>名次</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: '16px' }}>单位</TableCell>
                <TableCell align="center" width="120" sx={{ fontWeight: 'bold', bgcolor: '#ffffff', fontSize: '16px' }}>总分</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topTeams.map((team, index) => (
                <TableRow key={team.schoolName}>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: '16px' }}>
                    {getChineseRank(index + 1)}
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: '16px' }}>{team.schoolName}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '16px' }}>{team.totalPoints} 分</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{
        sx: {
          minHeight: '80vh',
          '@media print': {
            maxWidth: 'none',
            width: '100%',
            height: 'auto',
            minHeight: 'auto',
            boxShadow: 'none',
            overflow: 'visible'
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', '@media print': { display: 'none' } }}>
        <Typography variant="h6">打印总成绩册</Typography>
        <Box>
          <Button 
            variant="contained" 
            startIcon={<PrintIcon />} 
            onClick={handlePrint}
          >
            打印
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ 
        bgcolor: '#f5f5f5',
        '@media print': {
          padding: 0,
          border: 'none',
          bgcolor: 'white',
          overflow: 'visible'
        }
      }}>
        <Box sx={{ mb: 2, '@media print': { display: 'none' } }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            提示：您可以上传总裁判长电子签名，该签名将显示在成绩册的末尾。
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" component="label" size="small">
              上传裁判长电子签
              <input type="file" hidden accept="image/*" onChange={handleSignatureUpload} />
            </Button>
            {signatureImage && (
              <Button variant="text" color="error" size="small" onClick={() => {
                setSignatureImage('');
                localStorage.removeItem('chief_signature');
              }}>
                清除
              </Button>
            )}
          </Box>
        </Box>

        <Box 
          className="printable-content"
          sx={{ 
            p: 4, 
            bgcolor: 'white', 
            color: 'black',
            '@media print': {
              margin: '0',
              padding: '0',
              border: 'none',
            }
          }}
        >
          <style>
            {`
              @media print {
                /* 隐藏页面上除了打印内容以外的所有元素 */
                body * {
                  visibility: hidden;
                }
                
                /* 恢复打印内容的可见性 */
                .printable-content, .printable-content * {
                  visibility: visible;
                }
                
                /* 将打印内容移到最顶层并重置位置 */
                .printable-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: white;
                  padding: 20mm !important; /* 给内容增加内边距，避免贴边 */
                  box-sizing: border-box;
                }
                
                /* 设置打印页面的默认边距 */
                @page {
                  margin: 0; /* 使用 padding 控制边距更稳定 */
                }
                
                /* 彻底移除对话框的黑色/灰色背景遮罩的占位 */
                .MuiBackdrop-root {
                  display: none !important;
                }
                
                /* 确保各级容器背景都为纯白，防止透出底色 */
                html, body, #root, .MuiDialog-root, .MuiDialog-container {
                  background-color: white !important;
                }
              }
            `}
          </style>

          {/* Cover / Title */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2, fontFamily: '"SimHei", "黑体", sans-serif' }}>
              {competition.name}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2, fontFamily: '"SimHei", "黑体", sans-serif' }}>
              总成绩册
            </Typography>
            <Typography variant="h6" sx={{ mt: 4, fontFamily: '"SimSun", "宋体", serif' }}>
              日期：{
                competition.startDate && competition.endDate 
                  ? `${new Date(competition.startDate).toLocaleDateString()} ~ ${new Date(competition.endDate).toLocaleDateString()}`
                  : (competition.startDate ? new Date(competition.startDate).toLocaleDateString() : '')
              } 
            </Typography>
            <Typography variant="h6" sx={{ mt: 1, fontFamily: '"SimSun", "宋体", serif' }}>
              地点：{competition.location || ''}
            </Typography>
          </Box>

          {/* All schedules */}
          {Object.keys(groupedResults).map(scheduleName => 
            renderScheduleTable(scheduleName, groupedResults[scheduleName])
          )}

          {/* Team Rankings */}
          {teamRankings && teamRankings.length > 0 && (
            <>
              <Box sx={{ pageBreakBefore: 'always', mt: 4 }} />
              {renderTeamRankingsTable()}
            </>
          )}

          {/* Signature */}
          <Box sx={{ mt: 6, display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid' }}>
            <Box sx={{ textAlign: 'center', minWidth: '200px' }}>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold', color: 'black' }}>总裁判长签名：</Typography>
              {signatureImage ? (
                <img src={signatureImage} alt="总裁判长签名" style={{ maxWidth: '150px', maxHeight: '60px', objectFit: 'contain' }} />
              ) : (
                <Box sx={{ borderBottom: '1px solid black', width: '150px', margin: '0 auto', height: '40px' }} />
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ '@media print': { display: 'none' } }}>
        <Button onClick={onClose}>取消</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintAllResultsModal;
