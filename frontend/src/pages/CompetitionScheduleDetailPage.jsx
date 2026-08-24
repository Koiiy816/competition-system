import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, CircularProgress, Alert, 
  Container, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, FormControlLabel, Chip
} from '@mui/material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SyncIcon from '@mui/icons-material/Sync';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import scheduleService from '../services/scheduleService';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';

const CompetitionScheduleDetailPage = () => {
  const { id, scheduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [nextSchedule, setNextSchedule] = useState(null);
  const [prevSchedule, setPrevSchedule] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);

  const isCollectiveSchedule = Boolean(
    schedule && (
      String(schedule.name || '').includes('集体') ||
      participants.some((participant) => participant.isVirtualTeam || participant.type === 'team')
    )
  );

  useEffect(() => {
    fetchData();
  }, [scheduleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const schedRes = await scheduleService.getSchedule(id, scheduleId);
      setSchedule(schedRes.data);
      // Fetch full participant details if they are virtual teams (need their members' names)
      const parts = schedRes.data.participants || [];
      setParticipants(parts);
      
      const compRes = await competitionService.getCompetition(id);
      setCompetition(compRes.data);

      // 获取所有赛程以计算“上/下一个比赛项目”
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
      setError('加载数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(participants);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setParticipants(items);
    setHasChanges(true);
  };

  // --- 新增：同步最新参赛者到当前赛程 ---
  const handleSyncParticipants = async () => {
    try {
      const res = await scheduleService.appendNewParticipants(id, scheduleId);
      if (res.success) {
        if (res.addedCount > 0) {
          // 如果有新人加入，需要更新列表，且保持测试人员在最后
          const newScheduleList = res.data.participants;
          // 重新洗牌，将测试人员放最后，更新序号
          const normalItems = newScheduleList.filter(item => !item.isTest);
          const testItems = newScheduleList.filter(item => item.isTest);
          
          const sortedList = [...normalItems, ...testItems].map((item, index) => ({
             ...item,
             order: index + 1
          }));

          setParticipants(sortedList);
          setHasChanges(true); // 提示用户保存
          setSuccess(`成功同步了 ${res.addedCount} 名新参赛者，请点击保存生效！`);
        } else {
          setSuccess('当前已经是最新名单，没有遗漏的参赛者。');
        }
      }
    } catch (err) {
      console.error('同步参赛者失败:', err);
      setError(err.response?.data?.error || err.message || '同步失败，请重试');
    }
  };

  // --- 新增：仅在前端随机打乱当前列表的顺序 ---
  const handleShuffleList = () => {
    // 过滤出正式选手和测试选手
    const testItems = participants.filter(item => item.isTest);
    let normalItems = participants.filter(item => !item.isTest);

    // 仅打乱正式选手（Fisher-Yates 算法）
    for (let i = normalItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [normalItems[i], normalItems[j]] = [normalItems[j], normalItems[i]];
    }

    // 将测试选手垫底追加回去
    const shuffledArray = [...normalItems, ...testItems];

    setParticipants(shuffledArray);
    setHasChanges(true);
    setSuccess('当前名单已随机打乱，点击保存新顺序即可生效');
  };

  const handleOpenAddParticipants = async () => {
    if (hasChanges) {
      setError('请先保存当前的顺序调整，再加入选手，避免覆盖尚未保存的排序。');
      return;
    }

    setError('');
    setSuccess('');
    setParticipantSearch('');
    setSelectedParticipantIds([]);
    setAddDialogOpen(true);
    setLoadingCandidates(true);
    try {
      const response = await scheduleService.getAvailableParticipants(id, scheduleId);
      setAvailableParticipants(response.data || []);
    } catch (err) {
      setAddDialogOpen(false);
      setError(err.message || '读取可加入选手失败，请重试');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleToggleCandidate = (participantId) => {
    setSelectedParticipantIds((currentIds) => (
      currentIds.includes(participantId)
        ? currentIds.filter((id) => id !== participantId)
        : [...currentIds, participantId]
    ));
  };

  const handleSelectUnitCandidates = (schoolName) => {
    const unitIds = availableParticipants
      .filter((participant) => String(participant.schoolName || '未填写代表单位') === schoolName)
      .map((participant) => participant._id);
    setSelectedParticipantIds((currentIds) => [...new Set([...currentIds, ...unitIds])]);
  };

  const handleAddSelectedParticipants = async () => {
    if (selectedParticipantIds.length === 0) return;

    setAddingParticipants(true);
    setError('');
    try {
      const response = isCollectiveSchedule
        ? await scheduleService.addCollectiveTeamsToSchedule(id, scheduleId, selectedCollectiveTeams)
        : await scheduleService.addParticipantsToSchedule(id, scheduleId, selectedParticipantIds);
      if (response.data?.participants) {
        setParticipants(response.data.participants);
        setSchedule(response.data);
      } else {
        await fetchData();
      }
      setAddDialogOpen(false);
      setHasChanges(false);
      setSuccess(response.message || (isCollectiveSchedule
        ? `已新增 ${selectedCollectiveTeams.length} 支队伍`
        : `已加入 ${response.addedCount || selectedParticipantIds.length} 名选手到当前赛程`));
    } catch (err) {
      setError(err.response?.data?.message || err.message || '加入选手失败，请重试');
    } finally {
      setAddingParticipants(false);
    }
  };

  const selectedCollectiveTeams = [];
  if (isCollectiveSchedule) {
    const teamsByUnit = new Map();
    availableParticipants
      .filter((participant) => selectedParticipantIds.includes(participant._id))
      .forEach((participant) => {
        const teamName = String(participant.schoolName || '未填写代表单位').trim() || '未填写代表单位';
        if (!teamsByUnit.has(teamName)) {
          teamsByUnit.set(teamName, { teamName, memberIds: [] });
        }
        teamsByUnit.get(teamName).memberIds.push(participant._id);
      });
    selectedCollectiveTeams.push(...teamsByUnit.values());
  }

  const filteredAvailableParticipants = availableParticipants.filter((participant) => {
    const keyword = participantSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [participant.name, participant.schoolName, participant.ageGroup, participant.event]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
  const handleRemoveParticipant = (participantId, participantName) => {
    if (window.confirm(`确定要将 "${participantName}" 从本赛程中移除吗？\n移除后请记得点击“保存新顺序”。`)) {
      setParticipants(prev => prev.filter(p => p._id !== participantId));
      setHasChanges(true);
    }
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const participantIds = participants.map(p => p._id);
      await scheduleService.updateSchedule(id, scheduleId, {
        participants: participantIds
      });
      setSuccess('出场顺序已保存');
      setHasChanges(false);
    } catch (err) {
      setError('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isAdminOrOrganizer = user && (
    user.roles.includes('admin') || user.roles.includes('chief_referee') ||
    (competition && competition.organizer && (competition.organizer._id === user.id || competition.organizer === user.id))
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (!schedule) return <Alert severity="error">未找到赛程信息</Alert>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4, '@media print': { maxWidth: 'none', width: '100%', mt: 0, mb: 0, p: 0 } }}>
      {/* 打印样式 */}
      <style>
        {`
          @media print {
            body {
              background-color: white;
            }
            @page {
              size: A4;
              margin: 2cm;
            }
            /* 强制隐藏页面底部的版权信息 */
            footer, .footer, [class*="footer"], #footer {
              display: none !important;
            }
          }
        `}
      </style>

      {/* 屏幕显示区域 */}
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${id}/start-list`)} sx={{ mb: 2 }}>
          返回所有赛程
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            {schedule.name} - 出场顺序管理
          </Typography>
          
          <Box>
              {isAdminOrOrganizer && (
                <>
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<SyncIcon />}
                    onClick={handleSyncParticipants}
                    sx={{ mr: 2 }}
                  >
                    同步新参赛者
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PersonAddIcon />}
                    onClick={handleOpenAddParticipants}
                    sx={{ mr: 2 }}
                  >
                    加入选手
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<ShuffleIcon />}
                    onClick={handleShuffleList}
                    disabled={participants.length === 0}
                    sx={{ mr: 2 }}
                  >
                    随机打乱顺序
                  </Button>
                </>
              )}

              <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ mr: 2 }}
            >
              打印当前名单
            </Button>
            
            {isAdminOrOrganizer && hasChanges && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveOrder}
                disabled={saving}
              >
                {saving ? '保存中...' : '保存新顺序'}
              </Button>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {hasChanges && <Alert severity="info" sx={{ mb: 2 }}>顺序已修改，请记得点击保存按钮。</Alert>}

        <Paper sx={{ p: 2 }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="participants-list">
              {(provided) => (
                <TableContainer {...provided.droppableProps} ref={provided.innerRef}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width="50"></TableCell>
                        <TableCell width="80">序号</TableCell>
                        <TableCell>姓名</TableCell>
                        <TableCell>单位</TableCell>
                        <TableCell>组别</TableCell>
                        {isAdminOrOrganizer && <TableCell width="80" align="center">操作</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {participants.map((p, index) => {
                        // 针对集体项目的展示逻辑：如果是虚拟队伍，每5个人换行显示
                        let displayNameContent = p.name || (p.user && p.user.name) || '未知';
                        if (p.isVirtualTeam && p.teamMembers && p.teamMembers.length > 0) {
                          const names = p.teamMembers.map(m => m.name);
                          const chunks = [];
                          for (let i = 0; i < names.length; i += 3) {
                            let chunkStr = names.slice(i, i + 3).join('、');
                            if (i + 3 < names.length) {
                              chunkStr += '、'; // 如果还有下一行，末尾加上顿号
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
                          <Draggable 
                            key={p._id} 
                            draggableId={p._id} 
                            index={index}
                            isDragDisabled={!isAdminOrOrganizer}
                          >
                            {(provided, snapshot) => (
                              <TableRow
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                sx={{
                                  bgcolor: snapshot.isDragging ? 'action.hover' : 'inherit',
                                  '& td': { borderBottom: snapshot.isDragging ? 'none' : undefined }
                                }}
                              >
                                <TableCell>
                                  {isAdminOrOrganizer && (
                                    <Box {...provided.dragHandleProps} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                      <DragIndicatorIcon color="action" />
                                    </Box>
                                  )}
                                </TableCell>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '300px', lineHeight: '1.8' }}>
                                  {displayNameContent}
                                </TableCell>
                                <TableCell>{p.schoolName || (p.user && p.user.schoolName) || '-'}</TableCell>
                                <TableCell>{p.ageGroup || '-'}</TableCell>
                                {isAdminOrOrganizer && (
                                  <TableCell align="center">
                                    <Tooltip title="从本赛程中移除该选手">
                                      <IconButton 
                                        color="error" 
                                        size="small"
                                        onClick={() => handleRemoveParticipant(p._id, p.name || (p.user && p.user.name) || '该选手')}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                )}
                              </TableRow>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Droppable>
          </DragDropContext>
        </Paper>
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {isAdminOrOrganizer ? '提示：拖动左侧的手柄图标可调整选手出场顺序。调整后请点击右上角的"保存"按钮。' : ''}
          </Typography>
        </Box>

        {/* 上一个/下一个比赛项目按钮 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, mb: 4 }} className="no-print">
          <Box>
            {prevSchedule && (
              <Button 
                variant="outlined" 
                color="primary"
                onClick={() => navigate(`/competitions/${id}/schedule/${prevSchedule._id}`)}
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
                onClick={() => navigate(`/competitions/${id}/schedule/${nextSchedule._id}`)}
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', boxShadow: 3 }}
              >
                下一个比赛项目：{nextSchedule.name}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* 打印专用区域 */}
      <Box id="print-area" sx={{ display: 'none', '@media print': { display: 'block' } }}>
        <Typography variant="h3" align="center" gutterBottom sx={{ mb: 6, pt: 2, fontWeight: 'bold', fontFamily: '"SimHei", "黑体", sans-serif' }}>
          上场顺序
        </Typography>
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', fontFamily: '"SimSun", "宋体", serif', mb: 1, fontSize: '18px' }}>
            1. {schedule.name} ({participants.length} 人)
          </Typography>
          
          <TableContainer sx={{ border: '1px solid #ccc' }}>
            <Table size="small">
              <TableBody>
                {participants.map((p, index) => {
                  let displayNameContent = p.name || (p.user && p.user.name) || '';
                  if (p.isVirtualTeam && p.teamMembers && p.teamMembers.length > 0) {
                    displayNameContent = p.teamMembers.map(m => m.name).join('、');
                  }
                    
                  return (
                    <TableRow key={p._id} sx={{ '& td': { borderBottom: '1px dotted #ccc', py: 1 } }}>
                      <TableCell width="15%" align="center" sx={{ fontSize: '16px', fontFamily: '"SimSun", "宋体", serif' }}>
                        {index + 1}
                      </TableCell>
                      <TableCell width="40%" sx={{ fontSize: '16px', fontFamily: '"SimSun", "宋体", serif', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                        {displayNameContent}
                      </TableCell>
                      <TableCell width="45%" align="center" sx={{ fontSize: '16px', fontFamily: '"SimSun", "宋体", serif' }}>
                        {p.schoolName || p.teamName || (p.user && p.user.schoolName) || ''}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      <Dialog
        open={addDialogOpen}
        onClose={() => !addingParticipants && setAddDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{isCollectiveSchedule ? `加入队员到「${schedule.name}」` : `加入选手到「${schedule.name}」`}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            {isCollectiveSchedule
              ? '集体项目会按「代表单位」自动组成队伍：同一单位本次勾选的所有选手只会新增为一支队伍，不会逐名成为出场队伍。原始报名资料和照片不会被修改。'
              : '这里仅将已报名选手加入当前赛程，不会修改其原始报名项目、报名资料或照片。'}
          </Alert>
          <TextField
            fullWidth
            autoFocus
            label="搜索姓名、代表单位、组别或报名项目"
            value={participantSearch}
            onChange={(event) => setParticipantSearch(event.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filteredAvailableParticipants.length > 0 && filteredAvailableParticipants.every((participant) => selectedParticipantIds.includes(participant._id))}
                indeterminate={filteredAvailableParticipants.some((participant) => selectedParticipantIds.includes(participant._id)) && !filteredAvailableParticipants.every((participant) => selectedParticipantIds.includes(participant._id))}
                onChange={(event) => setSelectedParticipantIds((currentIds) => {
                  const visibleIds = filteredAvailableParticipants.map((participant) => participant._id);
                  return event.target.checked
                    ? [...new Set([...currentIds, ...visibleIds])]
                    : currentIds.filter((participantId) => !visibleIds.includes(participantId));
                })}
              />
            }
            label={isCollectiveSchedule
              ? `本次已选择 ${selectedParticipantIds.length} 名队员，将按代表单位组成 ${selectedCollectiveTeams.length} 支队伍；可加入 ${filteredAvailableParticipants.length} 名`
              : `本次已选择 ${selectedParticipantIds.length} 名；可加入 ${filteredAvailableParticipants.length} 名`}
          />
          {loadingCandidates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : (
            <TableContainer sx={{ maxHeight: 420, border: 1, borderColor: 'divider', mt: 1 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>姓名</TableCell>
                    <TableCell>{isCollectiveSchedule ? '代表单位（同单位自动成队）' : '代表单位'}</TableCell>
                    <TableCell>组别</TableCell>
                    <TableCell>原报名项目</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAvailableParticipants.map((participant, index) => {
                    const unitName = String(participant.schoolName || '未填写代表单位');
                    const previousUnitName = index > 0
                      ? String(filteredAvailableParticipants[index - 1].schoolName || '未填写代表单位')
                      : null;
                    const showUnitHeader = isCollectiveSchedule && unitName !== previousUnitName;

                    return (
                      <React.Fragment key={participant._id}>
                        {showUnitHeader && (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ bgcolor: 'action.hover', py: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="body2" fontWeight="bold">{unitName}</Typography>
                                <Button size="small" onClick={() => handleSelectUnitCandidates(unitName)}>全选本单位</Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow hover onClick={() => handleToggleCandidate(participant._id)} sx={{ cursor: 'pointer' }}>
                          <TableCell padding="checkbox">
                            <Checkbox checked={selectedParticipantIds.includes(participant._id)} onClick={(event) => event.stopPropagation()} onChange={() => handleToggleCandidate(participant._id)} />
                          </TableCell>
                          <TableCell>{participant.name || '-'}</TableCell>
                          <TableCell>{participant.schoolName || '-'}</TableCell>
                          <TableCell>{participant.ageGroup || '-'}</TableCell>
                          <TableCell>
                            {participant.event || '-'}
                            {participant.isTest && <Chip label="测试" size="small" sx={{ ml: 1 }} />}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {!loadingCandidates && filteredAvailableParticipants.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center">没有符合条件、且尚未加入本赛程的选手</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={addingParticipants}>取消</Button>
          <Button variant="contained" onClick={handleAddSelectedParticipants} disabled={addingParticipants || selectedParticipantIds.length === 0}>
            {addingParticipants ? '加入中…' : (isCollectiveSchedule
              ? `按单位组成 ${selectedCollectiveTeams.length} 支队伍`
              : `加入 ${selectedParticipantIds.length} 名选手`)}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CompetitionScheduleDetailPage;
