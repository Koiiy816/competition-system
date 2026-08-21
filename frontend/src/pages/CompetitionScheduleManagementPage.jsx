import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Grid, Card, CardContent,
  CircularProgress, Alert, List, ListItem, ListItemText,
  Divider, Chip, Container, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, Checkbox
} from '@mui/material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SyncIcon from '@mui/icons-material/Sync';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import * as XLSX from 'xlsx';
import PreviewIcon from '@mui/icons-material/Preview';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import scheduleService from '../services/scheduleService';
import competitionService from '../services/competitionService';
import participantService from '../services/participantService';
import { useAuth } from '../contexts/AuthContext';

const parseScheduleExcel = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const workbook = XLSX.read(event.target.result, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      const rawDate = rows.flatMap((row) => row).find((value) => typeof value === 'number' && value > 40000 && value < 60000);
      const dateParts = rawDate && XLSX.SSF.parse_date_code(rawDate);
      if (!dateParts) throw new Error('未能在 Excel 中识别比赛日期');
      const scheduleDate = `${dateParts.y}-${String(dateParts.m).padStart(2, '0')}-${String(dateParts.d).padStart(2, '0')}`;
      let court = '';
      let timeHeaders = ['', ''];
      const items = [];
      rows.forEach((row) => {
        if (String(row[0] || '').includes('场地')) court = String(row[0]).trim();
        if (String(row[1] || '').includes('午') || String(row[3] || '').includes('午')) {
          timeHeaders = [String(row[1] || ''), String(row[3] || '')];
        }
        [[1, 0], [3, 1]].forEach(([column, timeIndex]) => {
          const name = String(row[column] || '').trim();
          if (!court || !/（\d+(人|队)）/.test(name)) return;
          const header = timeHeaders[timeIndex] || '';
          const timeSlot = header.includes('下午') ? '下午' : header.includes('晚上') ? '晚上' : '上午';
          items.push({
            name,
            scheduleDate,
            court,
            timeSlot,
            exactTime: header.replace(/^(上午|下午|晚上)/, '').trim()
          });
        });
      });
      if (!items.length) throw new Error('未在 Excel 中找到日程项目');
      resolve(items);
    } catch (error) { reject(error); }
  };
  reader.onerror = () => reject(new Error('读取 Excel 失败'));
  reader.readAsArrayBuffer(file);
});
const parseStartOrderExcel = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const workbook = XLSX.read(event.target.result, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      const entries = [];
      let scheduleName = '';
      let headers = null;
      let currentTeam = null;
      rows.forEach((row) => {
        const values = row.map((cell) => String(cell || '').trim());
        const first = values[0] || '';
        if (/^\d+[、.].*[（(]\d+(?:人|队)[）)]/.test(first)) {
          scheduleName = first.replace(/^\d+[、.]/, '').trim();
          headers = null;
          currentTeam = null;
          return;
        }
        const nameIndex = values.indexOf('姓名');
        if (nameIndex >= 0) {
          headers = {
            name: nameIndex,
            gender: values.indexOf('性别'),
            ageGroup: values.indexOf('组别'),
            event: values.indexOf('项目'),
            schoolName: values.indexOf('单位'),
            teamTable: values.includes('人数') && values.includes('单位')
          };
          currentTeam = null;
          return;
        }
        if (!scheduleName || !headers || !values[headers.name]) return;
        if (headers.teamTable && values[0] && values[headers.schoolName]) {
          currentTeam = {
            key: `${scheduleName}|${values[0]}|${values[headers.schoolName]}`,
            name: values[headers.schoolName]
          };
        }
        entries.push({
          scheduleName,
          name: values[headers.name],
          gender: headers.gender >= 0 ? values[headers.gender] : '',
          ageGroup: headers.ageGroup >= 0 ? values[headers.ageGroup] : '',
          event: headers.event >= 0 ? values[headers.event] : '',
          schoolName: headers.teamTable ? (currentTeam?.name || '') : (headers.schoolName >= 0 ? values[headers.schoolName] : ''),
          teamKey: currentTeam?.key || '',
          teamName: currentTeam?.name || ''
        });
      });
      if (!entries.length) throw new Error('未在上场顺序 Excel 中识别到选手名单');
      resolve(entries);
    } catch (error) { reject(error); }
  };
  reader.onerror = () => reject(new Error('读取上场顺序 Excel 失败'));
  reader.readAsArrayBuffer(file);
});

// 提取弹窗组件以避免父组件在输入时重新渲染
const AssignScheduleDialog = memo(({ open, schedule, initialForm, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: '',
    scheduleDate: '',
    timeSlot: '上午',
    exactTime: '',
    court: '一号场地'
  });

  useEffect(() => {
    if (open) {
      setForm(initialForm);
    }
  }, [open, initialForm]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>编辑比赛项目</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            已编排选手: {schedule?.participants?.length || 0} 人（修改项目资料不会改变选手名单）
          </Typography>
          <TextField
            label="比赛项目名称"
            required
            fullWidth
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="日期 (例如 2026-06-05 或 6月5日)"
            fullWidth
            value={form.scheduleDate}
            onChange={(e) => setForm({ ...form, scheduleDate: e.target.value })}
          />
          <TextField
            select
            label="时间段"
            fullWidth
            value={form.timeSlot}
            onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
          >
            <MenuItem value="上午">上午</MenuItem>
            <MenuItem value="下午">下午</MenuItem>
            <MenuItem value="晚上">晚上</MenuItem>
          </TextField>
          <TextField
            label="具体时间 (例如 14:00-17:00，选填)"
            fullWidth
            value={form.exactTime || ''}
            onChange={(e) => setForm({ ...form, exactTime: e.target.value })}
          />
          <TextField
            label="场地 (例如 一号场地, 二号场地)"
            fullWidth
            value={form.court}
            onChange={(e) => setForm({ ...form, court: e.target.value })}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit">取消</Button>
        <Button onClick={() => onSave(form)} variant="contained" color="primary">保存修改</Button>
      </DialogActions>
    </Dialog>
  );
});

// 提取独立的赛程卡片组件，实现列表级别的记忆化隔离，避免不必要的重新渲染
const ScheduleCard = memo(({ schedule, competitionId, isAdminOrOrganizer, onOpenAssignDialog, onDeleteSchedule }) => {
  const navigate = useNavigate();
  
  const isGroupEvent = (schedule.participants || []).some((participant) => participant.isVirtualTeam || participant.type === 'team') || String(schedule.name || '').includes('集体');
  const participantCountText = isGroupEvent 
    ? `${schedule.participants.length}队` 
    : `${schedule.participants.length}人`;

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
        transition: '0.3s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)'
        }
      }}
      onClick={() => navigate(`/competitions/${competitionId}/schedule/${schedule._id}`)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', flex: 1, pr: 1 }}>
            {schedule.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
            <Chip label={participantCountText} size="small" color="primary" variant="outlined" />
            {isAdminOrOrganizer && (
              <Button 
                size="small" 
                variant="outlined" 
                onClick={(e) => onOpenAssignDialog(schedule, e)}
              >
                编辑
              </Button>
            )}
            {isAdminOrOrganizer && (
              <IconButton 
                size="small" 
                color="error" 
                onClick={(e) => onDeleteSchedule(schedule._id, schedule.name, e)}
                title="删除该项目赛程"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
        
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {schedule.scheduleDate && <Chip size="small" label={schedule.scheduleDate} />}
          {schedule.timeSlot && <Chip size="small" label={schedule.timeSlot} color="secondary" />}
          {schedule.court && <Chip size="small" label={schedule.court} color="info" />}
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="primary">
            点击查看详情/更改顺序/打印 &gt;
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <List dense sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {schedule.participants.map((p, index) => (
            <React.Fragment key={p._id || index}>
              <ListItem alignItems="flex-start">
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" component="span">
                      <Box component="span" sx={{ fontWeight: 'bold', mr: 1, minWidth: '24px', display: 'inline-block' }}>
                        {index + 1}.
                      </Box>
                      {p.name || (p.user && p.user.name) || '未知选手'}
                    </Typography>
                  }
                  secondary={
                    <React.Fragment>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                      >
                        {p.schoolName || (p.user && p.user.schoolName) || ''}
                      </Typography>
                      {p.teamName && ` - ${p.teamName}`}
                    </React.Fragment>
                  }
                />
              </ListItem>
              {index < schedule.participants.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
});

const CompetitionScheduleManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [competition, setCompetition] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // 网页日程表分页选项卡状态
  const [activeDateTab, setActiveDateTab] = useState(null);

  // 分配赛程相关的状态
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [assignForm, setAssignForm] = useState({
    scheduleDate: '',
    timeSlot: '上午',
    exactTime: '',
    court: '一号场地'
  });

  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [groupPreviewOpen, setGroupPreviewOpen] = useState(false);
  const [groupPreviewLoading, setGroupPreviewLoading] = useState(false);
  const [groupPreview, setGroupPreview] = useState([]);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelScheduleItems, setExcelScheduleItems] = useState([]);
  const [excelPreview, setExcelPreview] = useState(null);
  const [manualAssignments, setManualAssignments] = useState({});
  const [startOrderRoster, setStartOrderRoster] = useState([]);
  const [collectiveImportOpen, setCollectiveImportOpen] = useState(false);
  const [collectiveImportLoading, setCollectiveImportLoading] = useState(false);
  const [collectiveImporting, setCollectiveImporting] = useState(false);
  const [collectiveRoster, setCollectiveRoster] = useState([]);
  const [collectivePreview, setCollectivePreview] = useState(null);
  const [unassignedDialogOpen, setUnassignedDialogOpen] = useState(false);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [unassignedParticipants, setUnassignedParticipants] = useState([]);
  const [unassignedSummary, setUnassignedSummary] = useState(null);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectCandidatesLoading, setProjectCandidatesLoading] = useState(false);
  const [projectCreating, setProjectCreating] = useState(false);
  const [projectCandidates, setProjectCandidates] = useState([]);
  const [projectCandidateSearch, setProjectCandidateSearch] = useState('');
  const [selectedProjectParticipantIds, setSelectedProjectParticipantIds] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', scheduleDate: '', timeSlot: '上午', exactTime: '', court: '一号场地', eventMode: 'individual' });

  useEffect(() => {
    fetchData();
    // 恢复之前的 Tab 状态
    const savedTab = sessionStorage.getItem('scheduleActiveTab');
    if (savedTab !== null) {
      setTabValue(parseInt(savedTab, 10));
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 获取比赛详情
      const compRes = await competitionService.getCompetition(id);
      setCompetition(compRes.data);

      // 获取赛程列表
      const schedRes = await scheduleService.getSchedules(id, { limit: 1000 });
      setSchedules(schedRes.data);
    } catch (err) {
      setError('加载数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelScheduleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setExcelImportLoading(true);
    setExcelPreview(null);
    setManualAssignments({});
    setStartOrderRoster([]);
    setError('');
    try {
      const items = await parseScheduleExcel(file);
      const response = await scheduleService.previewExcelScheduleImport(id, items);
      setExcelScheduleItems(items);
      setExcelPreview(response.data);
    } catch (err) {
      setExcelScheduleItems([]);
      setExcelPreview(null);
      setManualAssignments({});
      setError(err.message || '读取或匹配 Excel 日程失败');
    } finally {
      setExcelImportLoading(false);
    }
  };

  const handleStartOrderFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !excelScheduleItems.length) return;
    setExcelImportLoading(true);
    setError('');
    try {
      const roster = await parseStartOrderExcel(file);
      const response = await scheduleService.previewExcelScheduleImport(id, excelScheduleItems, roster);
      setExcelPreview(response.data);
      setManualAssignments({});
      setStartOrderRoster(roster);
    } catch (err) {
      setError(err.message || '读取或自动匹配上场顺序 Excel 失败');
    } finally {
      setExcelImportLoading(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelScheduleItems.length) return;
    if (!window.confirm('确认创建这些赛程吗？已存在赛程时系统会拒绝导入，避免重复。')) return;
    setExcelImporting(true);
    setError('');
    try {
      const response = await scheduleService.importExcelSchedule(id, excelScheduleItems, manualAssignments, startOrderRoster);
      setSuccess(response.message || 'Excel 日程已导入');
      setExcelImportOpen(false);
      setExcelPreview(null);
      setExcelScheduleItems([]);
      setManualAssignments({});
      setStartOrderRoster([]);
      await fetchData();
    } catch (err) {
      setError(err.message || '导入 Excel 日程失败');
    } finally {
      setExcelImporting(false);
    }
  };
  const handleCollectiveRosterFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCollectiveImportLoading(true);
    setCollectivePreview(null);
    setCollectiveRoster([]);
    setError('');
    setSuccess('');
    try {
      const roster = await parseStartOrderExcel(file);
      const response = await scheduleService.previewCollectiveRosterImport(id, roster);
      setCollectiveRoster(roster);
      setCollectivePreview(response.data);
    } catch (err) {
      setError(err.message || '读取或匹配集体项目 Excel 失败');
    } finally {
      setCollectiveImportLoading(false);
    }
  };

  const handleConfirmCollectiveRosterImport = async () => {
    if (!collectiveRoster.length || !collectivePreview) return;
    if (!window.confirm('确认后，Excel 中同名的集体项目会更新；没有同名项目时会新建“待编排”项目。泛称集体项目、原始报名资料和照片均不会被改动，是否继续？')) return;
    setCollectiveImporting(true);
    setError('');
    try {
      const response = await scheduleService.importCollectiveRoster(id, collectiveRoster);
      setSuccess(response.message || '集体项目名单已导入');
      setCollectiveImportOpen(false);
      setCollectivePreview(null);
      setCollectiveRoster([]);
      await fetchData();
    } catch (err) {
      setError(err.message || '导入集体项目名单失败');
    } finally {
      setCollectiveImporting(false);
    }
  };
  const handleGenerateStartList = async () => {
    if (!window.confirm('确定要重新生成出场顺序吗？这将覆盖现有的排序。')) {
      return;
    }
    
    setGenerating(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await scheduleService.generateStartList(id);
      setSuccess(response.message || '出场顺序已成功生成');
      // 重新加载数据
      const schedRes = await scheduleService.getSchedules(id, { limit: 1000 });
      setSchedules(schedRes.data);
    } catch (err) {
      setError(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handlePreviewGroups = async () => {
    setGroupPreviewOpen(true);
    setGroupPreviewLoading(true);
    setError('');
    try {
      const response = await scheduleService.getGroupPreview(id);
      setGroupPreview(response.data || []);
    } catch (err) {
      setGroupPreview([]);
      setError(err.message || '读取项目分组预览失败');
    } finally {
      setGroupPreviewLoading(false);
    }
  };

  const handleSyncNewParticipants = async () => {
    setSyncing(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await scheduleService.syncNewParticipants(id);
      setSuccess(res.message || '已成功将新参赛者追加到对应赛程中');
      // 重新加载数据
      const schedRes = await scheduleService.getSchedules(id, { limit: 1000 });
      setSchedules(schedRes.data);
    } catch (err) {
      setError(err.message || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenUnassignedParticipants = async () => {
    setUnassignedDialogOpen(true);
    setUnassignedLoading(true);
    setUnassignedSearch('');
    setError('');
    try {
      const response = await scheduleService.getUnassignedParticipants(id);
      setUnassignedParticipants(response.data || []);
      setUnassignedSummary(response.summary || null);
    } catch (err) {
      setUnassignedParticipants([]);
      setUnassignedSummary(null);
      setError(err.message || '读取未编排选手失败');
    } finally {
      setUnassignedLoading(false);
    }
  };

  const filteredUnassignedParticipants = unassignedParticipants.filter((participant) => {
    const keyword = unassignedSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [participant.name, participant.schoolName, participant.ageGroup, participant.event]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
  const handleOpenCreateProject = async () => {
    setCreateProjectOpen(true);
    setProjectCandidatesLoading(true);
    setProjectCandidateSearch('');
    setSelectedProjectParticipantIds([]);
    setNewProject({
      name: '',
      scheduleDate: competition?.startDate ? competition.startDate.split('T')[0] : '',
      timeSlot: '上午',
      exactTime: '',
      court: '一号场地',
      eventMode: 'individual'
    });
    try {
      const response = await participantService.getParticipants(id, { limit: 1000 });
      setProjectCandidates((response.data || []).filter((participant) => !participant.isVirtualTeam && participant.status !== 'rejected'));
    } catch (err) {
      setCreateProjectOpen(false);
      setError(err.message || '读取参赛选手失败');
    } finally {
      setProjectCandidatesLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      setError('请填写比赛项目名称');
      return;
    }
    if (!newProject.scheduleDate) {
      setError('请填写比赛日期');
      return;
    }
    if (!selectedProjectParticipantIds.length) {
      setError(newProject.eventMode === 'collective' ? '请至少选择一名集体项目队员' : '请至少选择一名选手');
      return;
    }

    setProjectCreating(true);
    setError('');
    try {
      const date = newProject.scheduleDate;
      const selectedMembers = projectCandidates.filter((participant) => selectedProjectParticipantIds.includes(participant._id));
      const collectiveTeams = newProject.eventMode === 'collective'
        ? Object.values(selectedMembers.reduce((groups, participant) => {
          const teamName = String(participant.schoolName || '未填写代表单位').trim() || '未填写代表单位';
          if (!groups[teamName]) groups[teamName] = { teamName, memberIds: [] };
          groups[teamName].memberIds.push(participant._id);
          return groups;
        }, {}))
        : undefined;
      const response = await scheduleService.createSchedule(id, {
        name: newProject.name.trim(),
        participants: newProject.eventMode === 'collective' ? [] : selectedProjectParticipantIds,
        collectiveTeams,
        eventMode: newProject.eventMode,
        scheduleDate: date,
        timeSlot: newProject.timeSlot,
        exactTime: newProject.exactTime,
        court: newProject.court,
        startTime: `${date}T08:00:00`,
        endTime: `${date}T18:00:00`,
        location: newProject.court || '待定',
        type: 'other',
        status: 'scheduled'
      });
      setCreateProjectOpen(false);
      setSuccess(newProject.eventMode === 'collective'
        ? `已建立「${response.data?.name || newProject.name.trim()}」，并按代表单位组成 ${collectiveTeams.length} 支集体队伍、加入 ${selectedProjectParticipantIds.length} 名队员。`
        : `已建立「${response.data?.name || newProject.name.trim()}」，并加入 ${selectedProjectParticipantIds.length} 名选手。`);
      await fetchData();
    } catch (err) {
      setError(err.message || '建立比赛项目失败');
    } finally {
      setProjectCreating(false);
    }
  };

  const filteredProjectCandidates = projectCandidates.filter((participant) => {
    const keyword = projectCandidateSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [participant.name, participant.schoolName, participant.ageGroup, participant.event]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
  const handleClearAllSchedules = async () => {
    if (!window.confirm('危险操作！这将会彻底删除本比赛下的【所有赛程安排】，且无法恢复。是否继续？')) {
      return;
    }

    setClearing(true);
    setError('');
    setSuccess('');

    try {
      await scheduleService.clearAllSchedules(id);
      setSuccess('所有赛程已被成功清空');
      setSchedules([]);
    } catch (err) {
      setError(err.message || '清空赛程失败');
    } finally {
      setClearing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };
  const handleExportStartOrderExcel = () => {
    const orderedSchedules = [...schedules]
      .filter((schedule) => schedule.scheduleDate && schedule.timeSlot && schedule.court)
      .sort((a, b) => String(a.scheduleDate || '').localeCompare(String(b.scheduleDate || '')) || String(a.timeSlot || '').localeCompare(String(b.timeSlot || ''), 'zh-CN') || String(a.court || '').localeCompare(String(b.court || ''), 'zh-CN') || (a.order || 0) - (b.order || 0));
    if (!orderedSchedules.length) {
      setError('暂无已排程的出场顺序可导出。');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const workbook = XLSX.utils.book_new();
      const rows = [];
      const merges = [];
      const rowHeights = [];
      const rowTypes = [];
      const baseStyle = {
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        font: { name: '宋体', sz: 10 },
        border: {
          top: { style: 'thin', color: { rgb: '808080' } },
          bottom: { style: 'thin', color: { rgb: '808080' } },
          left: { style: 'thin', color: { rgb: '808080' } },
          right: { style: 'thin', color: { rgb: '808080' } }
        }
      };
      const titleStyle = { ...baseStyle, font: { name: '黑体', sz: 18, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
      const subtitleStyle = { ...baseStyle, font: { name: '黑体', sz: 14, bold: true } };
      const sectionStyle = { ...baseStyle, font: { name: '黑体', sz: 12, bold: true } };
      const eventStyle = { ...baseStyle, font: { name: '宋体', sz: 12, bold: true }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } };
      const headerStyle = { ...baseStyle, font: { name: '宋体', sz: 10, bold: true } };
      const appendMergedRow = (value, type, height = 25) => {
        const rowIndex = rows.length;
        rows.push([value, '', '', '', '', '']);
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
        rowHeights.push({ hpt: height });
        rowTypes.push(type);
      };
      const appendTableRow = (values, type = 'body') => {
        rows.push(values);
        rowHeights.push({ hpt: 25 });
        rowTypes.push(type);
      };
      const formatDate = (value) => String(value || '').replace(/T.*$/, '');
      const getEventName = (schedule) => String(schedule.name || '').replace(/[（(]\d+(?:人|队)[）)]\s*$/, '').trim() || '-';
      const isTeamParticipant = (participant) => participant.isVirtualTeam || participant.type === 'team' || ['集体', '集体项目', '混合集体'].includes(String(participant.ageGroup || ''));
      const isCollectiveSchedule = (schedule) => /集体/.test(String(schedule.name || '')) || (schedule.participants || []).some(isTeamParticipant);
      const getCountLabel = (schedule) => `${(schedule.participants || []).length}${isCollectiveSchedule(schedule) ? '队' : '人'}`;
      const participantRow = (participant, schedule, index) => {
        const isTeam = isTeamParticipant(participant);
        const teamMembers = participant.teamMembers || [];
        const teamName = participant.teamName || participant.schoolName || participant.name || participant.user?.name || '-';
        return [
          index + 1,
          isTeam ? teamName : (participant.name || participant.user?.name || '-'),
          isTeam ? '集体' : (participant.gender || participant.user?.gender || '-'),
          isTeam ? '集体' : (participant.ageGroup || participant.user?.ageGroup || '-'),
          isTeam ? `${getEventName(schedule)}${teamMembers.length ? `（${teamMembers.length}人）` : ''}` : (participant.event || getEventName(schedule)),
          participant.schoolName || participant.teamName || participant.user?.schoolName || '-'
        ];
      };

      appendMergedRow(competition?.name || '比赛', 'title', 55);
      appendMergedRow('上场秩序', 'subtitle', 25);
      const dates = [...new Set(orderedSchedules.map((schedule) => formatDate(schedule.scheduleDate)))];
      const slots = ['上午', '下午', '晚上'];
      dates.forEach((date) => {
        appendMergedRow(date, 'section', 25);
        const daySchedules = orderedSchedules.filter((schedule) => formatDate(schedule.scheduleDate) === date);
        const courts = [...new Set(daySchedules.map((schedule) => schedule.court))].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
        courts.forEach((court) => {
          appendMergedRow(court, 'section', 25);
          slots.forEach((timeSlot) => {
            const slotSchedules = daySchedules.filter((schedule) => schedule.court === court && schedule.timeSlot === timeSlot);
            if (!slotSchedules.length) return;
            const exactTime = slotSchedules.find((schedule) => schedule.exactTime)?.exactTime || '';
            appendMergedRow(`${timeSlot}${exactTime ? exactTime : ''}`, 'section', 25);
            let itemNumber = 0;
            slotSchedules.forEach((schedule) => {
              itemNumber += 1;
              const displayName = String(schedule.name || '未命名项目');
              const eventTitle = /[（(]\d+(?:人|队)[）)]\s*$/.test(displayName)
                ? displayName
                : `${displayName}（${getCountLabel(schedule)}）`;
              appendMergedRow(`${itemNumber}、${eventTitle}`, 'event', 25);
              appendTableRow(['序号', '姓名', '性别', '组别', '项目', '单位'], 'header');
              const participants = schedule.participants || [];
              if (participants.length) {
                participants.forEach((participant, participantIndex) => appendTableRow(participantRow(participant, schedule, participantIndex)));
              } else {
                appendTableRow(['-', '暂无已编排选手', '', '', getEventName(schedule), '']);
              }
              appendTableRow(['', '', '', '', '', ''], 'blank');
            });
          });
        });
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!merges'] = merges;
      worksheet['!cols'] = [{ wch: 5 }, { wch: 17 }, { wch: 5 }, { wch: 7 }, { wch: 20 }, { wch: 40 }];
      worksheet['!rows'] = rowHeights;
      worksheet['!pageSetup'] = { orientation: 'portrait', paperSize: '9', fitToWidth: 1, fitToHeight: 0 };
      worksheet['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        if (!worksheet[address]) worksheet[address] = { t: 's', v: '' };
        const type = rowTypes[rowIndex];
        worksheet[address].s = type === 'title' ? titleStyle
          : type === 'subtitle' ? subtitleStyle
            : type === 'section' ? sectionStyle
              : type === 'event' ? eventStyle
                : type === 'header' ? headerStyle
                  : baseStyle;
      }));
      XLSX.utils.book_append_sheet(workbook, worksheet, '上场顺序');
      XLSX.writeFile(workbook, `${String(competition?.name || '比赛').replace(/[\\/:*?"<>|]/g, '_')}-上场顺序.xlsx`, { compression: true });
      setSuccess('出场顺序 Excel 已生成并开始下载。');
    } catch (err) {
      console.error('出场顺序 Excel 导出失败:', err);
      setError('出场顺序 Excel 导出失败，请重试。');
    }
  };
  const handleExportScheduleExcel = () => {
    const assigned = schedules
      .filter((schedule) => schedule.scheduleDate && schedule.timeSlot && schedule.court)
      .sort((a, b) => String(a.scheduleDate).localeCompare(String(b.scheduleDate)) || String(a.court || '').localeCompare(String(b.court || ''), 'zh-CN') || (a.order || 0) - (b.order || 0));
    if (!assigned.length) {
      setError('暂无已排程的比赛日程可导出。');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const dates = [...new Set(assigned.map((schedule) => schedule.scheduleDate))].sort();
      const workbook = XLSX.utils.book_new();
      const cellStyle = { alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, font: { name: 'Microsoft YaHei', sz: 10 }, border: { top: { style: 'thin', color: { rgb: 'B7C3D0' } }, bottom: { style: 'thin', color: { rgb: 'B7C3D0' } }, left: { style: 'thin', color: { rgb: 'B7C3D0' } }, right: { style: 'thin', color: { rgb: 'B7C3D0' } } } };
      const titleStyle = { ...cellStyle, font: { name: 'Microsoft YaHei', sz: 16, bold: true } };
      const headingStyle = { ...cellStyle, font: { name: 'Microsoft YaHei', sz: 11, bold: true }, fill: { fgColor: { rgb: 'EAF2F8' } } };

      dates.forEach((date, index) => {
        const dateSchedules = assigned.filter((schedule) => schedule.scheduleDate === date);
        const courts = [...new Set(dateSchedules.map((schedule) => schedule.court))]
          .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
        const rows = [
          [`${competition?.name || '比赛'} - 比赛日程表`],
          [date]
        ];
        const merges = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
        ];
        const rowHeights = [{ hpt: 38 }, { hpt: 24 }];

        courts.forEach((court) => {
          const morning = dateSchedules.filter((schedule) => schedule.court === court && schedule.timeSlot === '上午');
          const afternoon = dateSchedules.filter((schedule) => schedule.court === court && schedule.timeSlot === '下午');
          const evening = dateSchedules.filter((schedule) => schedule.court === court && !['上午', '下午'].includes(schedule.timeSlot));
          const courtHeadingRow = rows.length;
          rows.push([court]);
          merges.push({ s: { r: courtHeadingRow, c: 0 }, e: { r: courtHeadingRow, c: 3 } });
          rowHeights.push({ hpt: 24 });
          rows.push(['', '上午9:00-12:00', '', '下午14:00-17:00']);
          rowHeights.push({ hpt: 22 });

          const count = Math.max(morning.length, afternoon.length, 1);
          for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
            rows.push([
              morning[itemIndex] ? `${itemIndex + 1}、` : '',
              morning[itemIndex]?.name || '',
              afternoon[itemIndex] ? `${itemIndex + 1}、` : '',
              afternoon[itemIndex]?.name || ''
            ]);
            rowHeights.push({ hpt: 18 });
          }

          if (evening.length) {
            const eveningHeadingRow = rows.length;
            rows.push([`${court}／其他时段`]);
            merges.push({ s: { r: eveningHeadingRow, c: 0 }, e: { r: eveningHeadingRow, c: 3 } });
            rowHeights.push({ hpt: 22 });
            evening.forEach((schedule, itemIndex) => {
              rows.push([`${itemIndex + 1}、`, schedule.name, '', schedule.timeSlot || '其他时段']);
              rowHeights.push({ hpt: 18 });
            });
          }
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!merges'] = merges;
        worksheet['!cols'] = [{ wch: 5 }, { wch: 43 }, { wch: 5 }, { wch: 43 }];
        worksheet['!rows'] = rowHeights;
        rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          if (!worksheet[address]) worksheet[address] = { t: 's', v: '' };
          worksheet[address].s = rowIndex === 0 ? titleStyle : (rowIndex === 1 || merges.some((merge) => merge.s.r === rowIndex) || (rowIndex > 1 && row[1] === '上午9:00-12:00')) ? headingStyle : cellStyle;
        }));
        XLSX.utils.book_append_sheet(workbook, worksheet, dates.length === 1 ? '比赛日程表' : `日程${index + 1}-${date}`.slice(0, 31));
      });

      XLSX.writeFile(workbook, `${String(competition?.name || '比赛').replace(/[\\/:*?"<>|]/g, '_')}-比赛日程表.xlsx`);
      setSuccess('可编辑的比赛日程 Excel 已生成并开始下载。');
    } catch (err) {
      console.error('比赛日程 Excel 导出失败:', err);
      setError('比赛日程 Excel 导出失败，请重试。');
    }
  };  const handleOpenAssignDialog = useCallback((schedule, e) => {
    e.stopPropagation(); // 阻止卡片点击跳转
    setCurrentSchedule(schedule);
    setAssignForm({
      name: schedule.name || '',
      scheduleDate: schedule.scheduleDate || (competition?.startDate ? competition.startDate.split('T')[0] : ''),
      timeSlot: schedule.timeSlot || '上午',
      exactTime: schedule.exactTime || '',
      court: schedule.court || '一号场地'
    });
    setAssignDialogOpen(true);
  }, [competition]);

  const handleCloseAssignDialog = useCallback(() => {
    setAssignDialogOpen(false);
    setCurrentSchedule(null);
  }, []);

  const handleAssignSave = useCallback(async (formValues) => {
    try {
      if (!formValues.name?.trim()) {
        setError('请输入比赛项目名称');
        return;
      }
      await scheduleService.updateSchedule(id, currentSchedule._id, formValues);
      setSuccess('比赛项目已修改');
      handleCloseAssignDialog();
      fetchData(); // 重新加载数据
    } catch (err) {
      setError(err.message || '保存失败');
    }
  }, [id, currentSchedule, handleCloseAssignDialog]);

  const handleDeleteSchedule = async (scheduleId, scheduleName, e) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除赛程 "${scheduleName}" 吗？删除后该赛程内的所有安排将不可恢复！`)) return;
    try {
      await scheduleService.deleteSchedule(id, scheduleId);
      setSuccess('赛程删除成功');
      setSchedules(prev => prev.filter(s => s._id !== scheduleId));
    } catch (err) {
      setError(err.message || '删除赛程失败');
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const [sourceDate, sourceSlot, sourceCourt] = source.droppableId.split('|');
    const [destDate, destSlot, destCourt] = destination.droppableId.split('|');

    // 获取并更新本地 schedules
    const newSchedules = Array.from(schedules);
    const movedScheduleIndex = newSchedules.findIndex(s => s._id === draggableId);
    
    if (movedScheduleIndex === -1) return;
    
    const movedSchedule = { ...newSchedules[movedScheduleIndex] };

    // 如果跨格子拖拽，更新时间场地信息
    if (source.droppableId !== destination.droppableId) {
      movedSchedule.scheduleDate = destDate;
      movedSchedule.timeSlot = destSlot;
      movedSchedule.court = destCourt;
    }

    // 从原位置移除
    newSchedules.splice(movedScheduleIndex, 1);

    // 找到目标格子的所有元素，按 order 或原始顺序排列
    let destSchedules = newSchedules.filter(s => 
      s.scheduleDate === destDate && 
      s.timeSlot === destSlot && 
      s.court === destCourt
    ).sort((a, b) => (a.order || 0) - (b.order || 0));

    // 插入到目标位置
    destSchedules.splice(destination.index, 0, movedSchedule);

    // 重新分配目标格子内所有元素的 order
    destSchedules.forEach((s, idx) => {
      s.order = idx;
      // 在总列表中找到并更新它
      const idxInTotal = newSchedules.findIndex(item => item._id === s._id);
      if (idxInTotal !== -1) {
        newSchedules[idxInTotal] = s;
      } else {
        newSchedules.push(s);
      }
    });

    setSchedules(newSchedules);
    setHasOrderChanges(true);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setError('');
    setSuccess('');
    
    try {
      // 提取所有分配了日期场地且有 order 的 schedule
      const schedulesToUpdate = schedules
        .filter(s => s.scheduleDate && s.timeSlot && s.court)
        .map((s) => ({
          id: s._id,
          order: s.order || 0,
          scheduleDate: s.scheduleDate,
          timeSlot: s.timeSlot,
          court: s.court
        }));

      await scheduleService.updateSchedulesOrder(id, schedulesToUpdate);
      setSuccess('赛程排版顺序已成功保存！');
      setHasOrderChanges(false);
      fetchData();
    } catch (err) {
      setError(err.message || '保存顺序失败');
    } finally {
      setSavingOrder(false);
    }
  };

  const isAdminOrOrganizer = user && (
    user.roles.includes('admin') || user.roles.includes('chief_referee') ||
    (competition && competition.organizer && (competition.organizer._id === user.id || competition.organizer === user.id))
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4, '@media print': { maxWidth: 'none', width: '100%', mt: 0, mb: 0, p: 0 } }}>
      {/* 打印样式 */}
      <style>
        {`
          @media print {
            body, html, #root {
              height: auto !important;
              min-height: auto !important;
              background-color: white;
              display: block !important;
            }
            @page {
              size: A4;
              margin: 1.5cm 2cm;
            }
            table {
              border-collapse: collapse;
            }
            td {
              border-bottom: 1px dotted #999 !important;
            }
            /* 解决可能由 TableContainer 带来的分页问题 */
            .MuiTableContainer-root {
              overflow: visible !important;
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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${id}`)} sx={{ mb: 2 }}>
          返回比赛详情
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            {competition?.name} - 出场顺序编排
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {schedules.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
              >
                打印
              </Button>
            )}
            {schedules.length > 0 && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<FileDownloadIcon />}
                onClick={tabValue === 1 ? handleExportScheduleExcel : handleExportStartOrderExcel}
              >
                {tabValue === 1 ? '导出日程 Excel' : '导出出场顺序 Excel'}
              </Button>
            )}

            {tabValue === 1 && isAdminOrOrganizer && hasOrderChanges && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<SaveIcon />}
                onClick={handleSaveOrder}
                disabled={savingOrder}
              >
                {savingOrder ? '保存中...' : '保存赛程排版顺序'}
              </Button>
            )}
            
            {isAdminOrOrganizer && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleOpenCreateProject}
              >
                新建比赛项目
              </Button>
            )}            {isAdminOrOrganizer && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<UploadFileIcon />}
                onClick={() => setExcelImportOpen(true)}
              >
                导入日程表（Excel）
              </Button>
            )}
            {isAdminOrOrganizer && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<UploadFileIcon />}
                onClick={() => setCollectiveImportOpen(true)}
              >
                导入集体项目（Excel）
              </Button>
            )}
            {isAdminOrOrganizer && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PreviewIcon />}
                onClick={handlePreviewGroups}
              >
                预览项目分组
              </Button>
            )}
            {isAdminOrOrganizer && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<PersonSearchIcon />}
                onClick={handleOpenUnassignedParticipants}
              >
                未编排选手
              </Button>
            )}            {isAdminOrOrganizer && (
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={handleClearAllSchedules}
                disabled={clearing}
              >
                {clearing ? '清空中...' : '一键清空赛程'}
              </Button>
            )}
            
            {isAdminOrOrganizer && (
              <Button
                variant="contained"
                color="info"
                startIcon={<SyncIcon />}
                onClick={handleSyncNewParticipants}
                disabled={syncing}
                title="仅按已导入 Excel 日程的项目、性别和合并年龄组追加选手；不会创建新项目"
              >
                {syncing ? '同步中...' : '同步到导入日程'}
              </Button>
            )}
            
            {isAdminOrOrganizer && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<ShuffleIcon />}
                onClick={handleGenerateStartList}
                disabled={generating}
              >
                {generating ? '生成中...' : (schedules.length > 0 ? '随机已导入项目顺序' : '随机生成出场顺序')}
              </Button>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => {
            setTabValue(newValue);
            sessionStorage.setItem('scheduleActiveTab', newValue.toString());
          }}>
            <Tab label="出场顺序编排" />
            <Tab label="比赛日程表" />
          </Tabs>
        </Box>

        {tabValue === 0 && (
          schedules.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                暂无赛程安排。{isAdminOrOrganizer ? '请点击右上角按钮生成出场顺序。' : ''}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {schedules.map((schedule) => (
                <Grid item xs={12} md={6} lg={4} key={schedule._id}>
                  <ScheduleCard 
                    schedule={schedule}
                    competitionId={id}
                    isAdminOrOrganizer={isAdminOrOrganizer}
                    onOpenAssignDialog={handleOpenAssignDialog}
                    onDeleteSchedule={handleDeleteSchedule}
                  />
                </Grid>
              ))}
            </Grid>
          )
        )}

        {tabValue === 1 && (
          <Box>
            {isAdminOrOrganizer && (
              <Alert severity="info" sx={{ mb: 2 }}>
                提示：您可以直接<b>拖拽</b>各个赛程卡片来调整它们的出场顺序，甚至可以<b>跨越场地</b>或<b>跨越时间段</b>进行拖拽分配！调整完成后请务必点击右上角的"保存赛程排版顺序"。
              </Alert>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
            {(() => {
              // 注意这里需要按 order 排序以保证显示正确
              const assigned = schedules.filter(s => s.scheduleDate && s.timeSlot && s.court).sort((a, b) => (a.order || 0) - (b.order || 0));
              const dates = [...new Set(assigned.map(s => s.scheduleDate))].sort();
              const timeSlots = ['上午', '下午', '晚上'];
              const courts = [...new Set(assigned.map(s => s.court))].sort();

              if (assigned.length === 0) {
                return (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">
                      暂无已排程的比赛日程。请在“出场顺序编排”中为赛程分配日期、时间段和场地。
                    </Typography>
                  </Paper>
                );
              }

              return (
                <Box>
                  <Tabs 
                    value={activeDateTab || dates[0]} 
                    onChange={(e, newValue) => setActiveDateTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
                  >
                    {dates.map(date => (
                      <Tab key={date} label={date} value={date} />
                    ))}
                  </Tabs>
                  
                  {dates.map(date => (
                    <Box 
                      key={date} 
                      sx={{ 
                        display: (activeDateTab || dates[0]) === date ? 'block' : 'none',
                        mb: 4, 
                        // 打印时强制显示所有日期并分页
                        '@media print': {
                          display: 'block !important',
                          pageBreakAfter: 'always'
                        }
                      }}
                    >
                      <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', display: 'none', '@media print': { display: 'block' } }}>
                        {date}
                      </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table sx={{ border: '1px solid #e0e0e0' }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                          <TableCell width="10%" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>时间段</TableCell>
                          {courts.map(court => (
                            <TableCell key={court} align="center" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>{court}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {timeSlots.map(slot => {
                          const hasAnySchedule = courts.some(court => 
                            assigned.some(s => s.scheduleDate === date && s.timeSlot === slot && s.court === court)
                          );
                          if (!hasAnySchedule) return null;

                          return (
                            <TableRow key={slot}>
                              <TableCell sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold', bgcolor: '#fafafa' }}>{slot}</TableCell>
                              {courts.map(court => {
                                const cellSchedules = assigned.filter(s => s.scheduleDate === date && s.timeSlot === slot && s.court === court);
                                const droppableId = `${date}|${slot}|${court}`;
                                return (
                                  <TableCell key={court} align="center" sx={{ borderRight: '1px solid #e0e0e0', verticalAlign: 'top', width: `${100 / courts.length}%` }}>
                                    <Droppable droppableId={droppableId}>
                                      {(provided, snapshot) => (
                                        <Box 
                                          ref={provided.innerRef} 
                                          {...provided.droppableProps}
                                          sx={{ 
                                            minHeight: '100px', 
                                            height: '100%',
                                            bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                                            transition: 'background-color 0.2s ease',
                                            p: 1
                                          }}
                                        >
                                          {cellSchedules.map((s, index) => (
                                            <Draggable key={s._id} draggableId={s._id} index={index} isDragDisabled={!isAdminOrOrganizer}>
                                              {(provided, snapshot) => (
                                                <Paper 
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  {...provided.dragHandleProps}
                                                  elevation={snapshot.isDragging ? 4 : 1}
                                                  sx={{ 
                                                    p: 1.5, 
                                                    mb: 1.5, 
                                                    bgcolor: '#e3f2fd', 
                                                    position: 'relative',
                                                    border: '1px solid #90caf9',
                                                    transition: '0.2s',
                                                    '&:hover': { bgcolor: '#bbdefb' },
                                                    ...(snapshot.isDragging && {
                                                      opacity: 0.8,
                                                      transform: 'scale(1.02)'
                                                    })
                                                  }}
                                                >
                                                  <Box onClick={() => navigate(`/competitions/${id}/schedule/${s._id}`)} sx={{ cursor: 'pointer', pt: 1, pb: 1 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                                                      {/* 添加项目编号 */}
                                                      <span style={{ 
                                                        display: 'inline-block', 
                                                        backgroundColor: '#1976d2', 
                                                        color: 'white', 
                                                        borderRadius: '4px', 
                                                        padding: '1px 6px', 
                                                        marginRight: '6px',
                                                        fontSize: '0.85em'
                                                      }}>
                                                        {index + 1}
                                                      </span>
                                                      {s.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                      {((s.participants || []).some((participant) => participant.isVirtualTeam || participant.type === 'team') || String(s.name || '').includes('集体'))
                                                        ? `${s.participants?.length || 0}队`
                                                        : `${s.participants?.length || 0}人`}
                                                    </Typography>
                                                  </Box>
                                                  {isAdminOrOrganizer && (
                                                    <Button 
                                                      size="small" 
                                                      color="primary"
                                                      sx={{ 
                                                        position: 'absolute', 
                                                        top: 2, 
                                                        right: 2, 
                                                        minWidth: 'auto', 
                                                        p: '2px 6px',
                                                        fontSize: '0.7rem'
                                                      }}
                                                      onClick={(e) => handleOpenAssignDialog(s, e)}
                                                    >
                                                      调排程
                                                    </Button>
                                                  )}
                                                </Paper>
                                              )}
                                            </Draggable>
                                          ))}
                                          {provided.placeholder}
                                        </Box>
                                      )}
                                    </Droppable>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ))}
              </Box>
            );
          })()}
          </DragDropContext>
          </Box>
        )}
      </Box>

      <Dialog open={createProjectOpen} onClose={() => !projectCreating && setCreateProjectOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>新建比赛项目</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            个人项目会直接加入所选选手；集体项目会按「代表单位」自动组成队伍后加入赛程。两种方式都不会修改原始报名资料或照片。
          </Alert>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, mb: 2 }}>
            <TextField select label="项目类型" value={newProject.eventMode} onChange={(event) => setNewProject((current) => ({ ...current, eventMode: event.target.value }))}>
              <MenuItem value="individual">个人项目</MenuItem><MenuItem value="collective">集体项目（按代表单位成队）</MenuItem>
            </TextField>
            <TextField label="比赛项目名称" required fullWidth value={newProject.name} onChange={(event) => setNewProject((current) => ({ ...current, name: event.target.value }))} />
            <TextField label="比赛日期" required type="date" InputLabelProps={{ shrink: true }} value={newProject.scheduleDate} onChange={(event) => setNewProject((current) => ({ ...current, scheduleDate: event.target.value }))} />
            <TextField select label="时间段" value={newProject.timeSlot} onChange={(event) => setNewProject((current) => ({ ...current, timeSlot: event.target.value }))}>
              <MenuItem value="上午">上午</MenuItem><MenuItem value="下午">下午</MenuItem><MenuItem value="晚上">晚上</MenuItem>
            </TextField>
            <TextField label="场地" value={newProject.court} onChange={(event) => setNewProject((current) => ({ ...current, court: event.target.value }))} />
            <TextField label="具体时间（可选）" value={newProject.exactTime} onChange={(event) => setNewProject((current) => ({ ...current, exactTime: event.target.value }))} />
          </Box>
          <TextField fullWidth label="搜索姓名、代表单位、组别或报名项目" value={projectCandidateSearch} onChange={(event) => setProjectCandidateSearch(event.target.value)} sx={{ mb: 1 }} />
          {newProject.eventMode === 'collective' && <Alert severity="info" sx={{ mb: 1 }}>同一代表单位的勾选队员会自动组成一支队伍；如需分成多支队伍，请分别建立项目或使用集体项目 Excel。</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>已选择 {selectedProjectParticipantIds.length} 名{newProject.eventMode === 'collective' ? '队员' : '选手'}</Typography>
          {projectCandidatesLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box> : (
            <TableContainer sx={{ maxHeight: 380, border: 1, borderColor: 'divider' }}>
              <Table stickyHeader size="small"><TableHead><TableRow><TableCell padding="checkbox" /><TableCell>姓名</TableCell><TableCell>代表单位</TableCell><TableCell>组别</TableCell><TableCell>报名项目</TableCell></TableRow></TableHead>
                <TableBody>{filteredProjectCandidates.map((participant) => (<TableRow key={participant._id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedProjectParticipantIds((current) => current.includes(participant._id) ? current.filter((participantId) => participantId !== participant._id) : [...current, participant._id])}><TableCell padding="checkbox"><Checkbox checked={selectedProjectParticipantIds.includes(participant._id)} onClick={(event) => event.stopPropagation()} onChange={() => setSelectedProjectParticipantIds((current) => current.includes(participant._id) ? current.filter((participantId) => participantId !== participant._id) : [...current, participant._id])} /></TableCell><TableCell>{participant.name || '-'}</TableCell><TableCell>{participant.schoolName || '-'}</TableCell><TableCell>{participant.ageGroup || '-'}</TableCell><TableCell>{participant.event || '-'}</TableCell></TableRow>))}{!projectCandidatesLoading && filteredProjectCandidates.length === 0 && <TableRow><TableCell colSpan={5} align="center">没有符合条件的选手</TableCell></TableRow>}</TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions><Button disabled={projectCreating} onClick={() => setCreateProjectOpen(false)}>取消</Button><Button variant="contained" disabled={projectCreating || !selectedProjectParticipantIds.length} onClick={handleCreateProject}>{projectCreating ? '建立中…' : newProject.eventMode === 'collective' ? `建立集体项目并加入 ${selectedProjectParticipantIds.length} 名队员` : `建立并加入 ${selectedProjectParticipantIds.length} 名选手`}</Button></DialogActions>
      </Dialog>
      <Dialog open={unassignedDialogOpen} onClose={() => setUnassignedDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>未编排选手查核</DialogTitle>
        <DialogContent dividers>
          <Alert severity={unassignedSummary?.unassignedCount ? 'warning' : 'success'} sx={{ mb: 2 }}>
            {unassignedSummary
              ? `可编排选手 ${unassignedSummary.totalEligible} 名，已编入赛程 ${unassignedSummary.scheduledCount} 名，尚未编排 ${unassignedSummary.unassignedCount} 名。`
              : '正在读取目前赛程与报名资料…'}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            集体项目会按实际队员核对；此处只显示尚未出现在任何赛程的选手，不会修改报名资料或照片。
          </Typography>
          <TextField
            fullWidth
            label="搜索姓名、代表单位、组别或报名项目"
            value={unassignedSearch}
            onChange={(event) => setUnassignedSearch(event.target.value)}
            sx={{ mb: 2 }}
          />
          {unassignedLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : (
            <TableContainer sx={{ maxHeight: 480, border: 1, borderColor: 'divider' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>姓名</TableCell>
                    <TableCell>代表单位</TableCell>
                    <TableCell>组别</TableCell>
                    <TableCell>报名项目</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUnassignedParticipants.map((participant) => (
                    <TableRow key={participant._id}>
                      <TableCell>{participant.name || '-'}</TableCell>
                      <TableCell>{participant.schoolName || '-'}</TableCell>
                      <TableCell>{participant.ageGroup || '-'}</TableCell>
                      <TableCell>{participant.event || '-'}</TableCell>
                      <TableCell>{participant.status === 'approved' ? '已通过' : '待审核'}</TableCell>
                    </TableRow>
                  ))}
                  {!unassignedLoading && filteredUnassignedParticipants.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center">没有未编排选手</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnassignedDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={excelImportOpen} onClose={() => !excelImporting && setExcelImportOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>导入日程表（Excel）</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            上传后会按系统当前报名资料进行匹配，只显示预览，不会写入数据库。确认导入时仅创建赛程，不修改报名资料或照片；已有赛程时会拒绝导入以避免重复。
          </Alert>
          <Button component="label" variant="contained" startIcon={<UploadFileIcon />} disabled={excelImportLoading || excelImporting}>
            选择日程表 Excel
            <input hidden type="file" accept=".xlsx,.xls" onChange={handleExcelScheduleFile} />
          </Button>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={!excelPreview || excelImportLoading || excelImporting} sx={{ ml: 1 }}>
            选择上场顺序名单（可选）
            <input hidden type="file" accept=".xlsx,.xls" onChange={handleStartOrderFile} />
          </Button>
          {excelImportLoading && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}><CircularProgress size={20} /><Typography>正在比对系统报名资料…</Typography></Box>}
          {excelPreview && <Box sx={{ mt: 3 }}>
            <Alert severity={excelPreview.summary.approvedUnmatchedEntries ? 'warning' : 'success'} sx={{ mb: 2 }}>
              识别 {excelPreview.summary.scheduleCount} 个日程项目；系统报名 {excelPreview.summary.participantEntries} 笔，已匹配 {excelPreview.summary.matchedEntries} 笔，未匹配 {excelPreview.summary.unmatchedEntries} 笔（其中已通过 {excelPreview.summary.approvedUnmatchedEntries} 笔）。
            </Alert>
            {excelPreview.summary.roster?.providedRows > 0 && <Alert severity="info" sx={{ mb: 2 }}>
              已读取上场顺序名单 {excelPreview.summary.roster.providedRows} 笔，自动安排 {excelPreview.summary.roster.autoAssignedEntries} 笔；仍需核对 {excelPreview.summary.roster.ambiguousRows + excelPreview.summary.roster.unmatchedRows} 笔。自动安排可在下方随时修改。
            </Alert>}
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>日程匹配预览</Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader><TableHead><TableRow><TableCell>日程项目</TableCell><TableCell>场地／时段</TableCell><TableCell align="right">匹配</TableCell><TableCell align="right">名单自动安排</TableCell><TableCell align="right">已通过</TableCell><TableCell align="right">待审核</TableCell></TableRow></TableHead>
                <TableBody>{excelPreview.items.map((item) => <TableRow key={`${item.index}-${item.name}`}><TableCell>{item.name}</TableCell><TableCell>{item.court}／{item.timeSlot}</TableCell><TableCell align="right">{item.matchedCount}</TableCell><TableCell align="right">{item.rosterAutoAssignedCount || 0}</TableCell><TableCell align="right">{item.approvedCount}</TableCell><TableCell align="right">{item.pendingCount}</TableCell></TableRow>)}</TableBody>
              </Table>
            </TableContainer>
            {excelPreview.unmatchedParticipants.length > 0 && <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="warning.main" sx={{ mb: 1 }}>未排入日程的选手：请选择要手动加入的日程项目</Typography>
              <Alert severity="info" sx={{ mb: 1 }}>手动安排只影响本次导入的赛程归属，不会修改选手的原始报名项目或照片。</Alert>
              <TableContainer component={Paper} sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell>选手</TableCell><TableCell>单位／状态</TableCell><TableCell>手动加入日程（可选）</TableCell></TableRow></TableHead>
                  <TableBody>{excelPreview.unmatchedParticipants.map((participant) => <TableRow key={participant.id}>
                    <TableCell>{`${participant.name}｜${participant.gender} ${participant.ageGroup}｜${participant.event}`}</TableCell>
                    <TableCell>{`${participant.schoolName}｜${participant.status}`}</TableCell>
                    <TableCell sx={{ minWidth: 320 }}><TextField select size="small" fullWidth value={manualAssignments[participant.id] ?? ''} onChange={(event) => setManualAssignments((current) => ({ ...current, [participant.id]: event.target.value }))}>
                      <MenuItem value="">暂不安排</MenuItem>
                      {excelPreview.items.map((item) => <MenuItem key={item.index} value={item.index}>{`${item.court}／${item.timeSlot}｜${item.name}`}</MenuItem>)}
                    </TextField></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </TableContainer>
            </Box>}          </Box>}
        </DialogContent>
        <DialogActions><Button onClick={() => setExcelImportOpen(false)} disabled={excelImporting}>取消</Button><Button variant="contained" onClick={handleConfirmExcelImport} disabled={!excelPreview || excelImporting}>{excelImporting ? '导入中…' : '确认导入赛程'}</Button></DialogActions>
      </Dialog>
      <Dialog open={collectiveImportOpen} onClose={() => !collectiveImporting && setCollectiveImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>导入集体项目名单（Excel）</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            请选择集体项目上场名单 Excel。系统会按 Excel 中的完整项目名称精确匹配：同名项目更新；没有同名项目时新建“待编排”项目。不会把多组别塞进泛称集体项目，也不会修改个人报名资料或照片。
          </Alert>
          <Button component="label" variant="contained" startIcon={<UploadFileIcon />} disabled={collectiveImportLoading || collectiveImporting}>
            选择集体项目 Excel
            <input hidden type="file" accept=".xlsx,.xls" onChange={handleCollectiveRosterFile} />
          </Button>
          {collectiveImportLoading && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}><CircularProgress size={20} /><Typography>正在匹配集体赛程与队员名单…</Typography></Box>}
          {collectivePreview && <Box sx={{ mt: 3 }}>
            <Alert severity={collectivePreview.summary.unmatchedMembers || collectivePreview.summary.ambiguousMembers ? 'warning' : 'success'} sx={{ mb: 2 }}>
              Excel 识别 {collectivePreview.summary.sourceProjectCount} 个集体项目、{collectivePreview.summary.providedRows} 名队员；将更新 {collectivePreview.summary.existingProjectCount} 个同名项目，并新建 {collectivePreview.summary.newProjectCount} 个待编排项目。已匹配系统报名 {collectivePreview.summary.matchedMembers} 名，另有 {collectivePreview.summary.directImportMembers || 0} 名将按 Excel 直接建立为集体成员；无法识别项目归属 {collectivePreview.summary.unmatchedMembers} 名。
            </Alert>
            {collectivePreview.summary.ambiguousProjectNames?.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>发现重复的同名集体赛程，请先处理后再导入：{collectivePreview.summary.ambiguousProjectNames.join('、')}</Alert>}
            <TableContainer component={Paper} sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow><TableCell>集体项目</TableCell><TableCell>处理方式</TableCell><TableCell align="right">队伍</TableCell><TableCell align="right">系统匹配</TableCell><TableCell align="right">Excel 直接导入</TableCell><TableCell>队伍／单位</TableCell></TableRow></TableHead>
                <TableBody>{collectivePreview.items.map((item) => <TableRow key={item.scheduleId || item.name}>
                  <TableCell>{item.name}</TableCell><TableCell>{item.ambiguous ? '需先处理重复项目' : item.willCreate ? '新建待编排' : '更新同名项目'}</TableCell><TableCell align="right">{item.teamCount}</TableCell><TableCell align="right">{item.matchedCount}</TableCell><TableCell align="right">{item.directImportMemberCount || 0}</TableCell>
                  <TableCell>{item.rosterTeams.length ? item.rosterTeams.map((team) => `${team.teamName}（${team.memberCount}人）`).join('；') : '—'}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </TableContainer>
          </Box>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectiveImportOpen(false)} disabled={collectiveImporting}>取消</Button>
          <Button variant="contained" onClick={handleConfirmCollectiveRosterImport} disabled={!collectivePreview || collectiveImporting}>{collectiveImporting ? '导入中…' : '确认导入集体名单'}</Button>
        </DialogActions>
      </Dialog>
      {/* 分配赛程弹窗 */}
      <AssignScheduleDialog
        open={assignDialogOpen}
        schedule={currentSchedule}
        initialForm={assignForm}
        onClose={handleCloseAssignDialog}
        onSave={handleAssignSave}
      />
      <Dialog open={groupPreviewOpen} onClose={() => setGroupPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>项目分组预览</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>此预览不会创建赛程、不会打乱出场顺序，也不会修改任何报名资料。请先在参赛者编辑页填写「人工项目分组」，确认无误后再生成出场顺序。</Alert>
          {groupPreviewLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
            groupPreview.length === 0 ? <Typography color="text.secondary">暂无可预览的参赛者。</Typography> : (
              <List dense>
                {groupPreview.map((group) => <React.Fragment key={group.key}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={<><Typography component="span" fontWeight={700}>{group.name}</Typography><Chip label={`${group.count}人`} size="small" color="primary" sx={{ ml: 1 }} /></>}
                      secondary={group.participants.map((participant) => `${participant.name}（${participant.schoolName}）`).join('、')}
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>)}
              </List>
            )
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setGroupPreviewOpen(false)}>关闭</Button></DialogActions>
      </Dialog>

      {/* 打印专用区域 */}
      <Box 
        sx={{ 
          display: 'none', 
          '@media print': { 
            display: 'block',
            '& *': {
              visibility: 'visible',
            },
            width: '100%',
            backgroundColor: '#fff',
            m: 0,
            p: 0,
            // 隐藏全局 Footer
            '& ~ footer, & ~ .footer, & ~ div[class*="footer"]': {
              display: 'none !important'
            }
          } 
        }}
      >
        <Typography variant="h4" align="center" sx={{ fontWeight: 'bold', mb: 2, fontFamily: '"SimHei", "黑体", sans-serif' }}>
          上场顺序
        </Typography>

        {/* 动态渲染所有已分配场地的赛程 */}
        {Object.entries(
          schedules
            .filter(s => s.scheduleDate && s.timeSlot && s.court && s.participants && s.participants.length > 0)
            .sort((a, b) => {
              if (a.scheduleDate !== b.scheduleDate) return a.scheduleDate.localeCompare(b.scheduleDate);
              const slotOrder = { 'morning': 1, 'afternoon': 2, 'evening': 3 };
              if (slotOrder[a.timeSlot] !== slotOrder[b.timeSlot]) return slotOrder[a.timeSlot] - slotOrder[b.timeSlot];
              if (a.court !== b.court) return a.court.localeCompare(b.court);
              return 0;
            })
            .reduce((acc, schedule) => {
              const dateStr = new Date(schedule.scheduleDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
              
              // 判断具体的 timeSlot 并映射为中文
              let slotStr = '';
              if (schedule.timeSlot === 'morning' || schedule.timeSlot === '上午') slotStr = '上午';
              else if (schedule.timeSlot === 'afternoon' || schedule.timeSlot === '下午') slotStr = '下午';
              else if (schedule.timeSlot === 'evening' || schedule.timeSlot === '晚上') slotStr = '晚上';
              else slotStr = schedule.timeSlot; // 如果是自定义输入的，直接显示
              
              // 提取具体的时间段（如果排程时填了时间）
              let exactTimeStr = schedule.exactTime ? ` ${schedule.exactTime} ` : ' ';
              let courtStr = schedule.court || '';
              
              const headerKey = `${dateStr} ${slotStr}${exactTimeStr}${courtStr}`; 
              
              if (!acc[headerKey]) {
                acc[headerKey] = [];
              }
              acc[headerKey].push(schedule);
              return acc;
            }, {})
        ).map(([headerKey, groupSchedules], groupIndex) => (
          <Box key={groupIndex} sx={{ mb: 4 }}>
            <Typography variant="h6" align="center" sx={{ fontWeight: 'bold', mb: 2, mt: groupIndex === 0 ? 0 : 4, fontFamily: '"SimHei", "黑体", sans-serif', fontSize: '18px' }}>
              {headerKey}
            </Typography>

            {groupSchedules.map((schedule, sIndex) => {
              const isGroupEvent = (schedule.participants || []).some((participant) => participant.isVirtualTeam || participant.type === 'team') || String(schedule.name || '').includes('集体');
              
              const participantCount = isGroupEvent
                ? `${schedule.participants?.length || 0}队`
                : `${schedule.participants?.length || 0}人`;

              return (
                <Box key={schedule._id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: '"SimSun", "宋体", serif', mb: 0.5, fontWeight: 'bold', fontSize: '16px' }}>
                    {sIndex + 1}. {schedule.name} ({participantCount})
                  </Typography>
                  <TableContainer sx={{ border: '1px solid #ccc', overflow: 'visible' }}>
                    <Table size="small">
                      <TableBody>
                        {schedule.participants.map((p, index) => {
                          let displayNameContent = p.name || (p.user && p.user.name) || '';
                          if (p.isVirtualTeam && p.teamMembers && p.teamMembers.length > 0) {
                            displayNameContent = p.teamMembers.map(m => m.name).join('、');
                          }

                          return (
                            <TableRow key={p._id || index} sx={{ '& td': { borderBottom: '1px dotted #ccc', py: 1 } }}>
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
              );
            })}
          </Box>
        ))}
      </Box>
    </Container>
  );
};

export default CompetitionScheduleManagementPage;
