import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  TablePagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
  Edit as EditIcon,
  Photo as PhotoIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import participantService from '../services/participantService';
import competitionService from '../services/competitionService';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ScienceIcon from '@mui/icons-material/Science'; // Import icon for test participant
import AddParticipantModal from '../components/participants/AddParticipantModal';

// 标签面板组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`participants-tabpanel-${index}`}
      aria-labelledby={`participants-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ParticipantsPage = ({ myRegistrations = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // 状态
  const [participants, setParticipants] = useState([]);
  const [groupedParticipants, setGroupedParticipants] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGrouped, setLoadingGrouped] = useState(false);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 分页状态
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [uniqueParticipantCount, setUniqueParticipantCount] = useState(0);

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoDialogUrl, setPhotoDialogUrl] = useState('');
  const [photoDialogParticipant, setPhotoDialogParticipant] = useState(null);
  
  // 导入Excel相关状态
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // 手动添加参赛者模态框状态
  const [addParticipantDialogOpen, setAddParticipantDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
  
  // 过滤和搜索状态
  const [filters, setFilters] = useState({
    search: '',
    competitionId: '',
    status: '',
    type: ''
  });
  
  // 显示过滤器
  const [showFilters, setShowFilters] = useState(false);
  
  // 检查用户是否是管理员或比赛主裁判
  const isAdminOrChiefReferee = user?.roles?.includes('admin') || user?.roles?.includes('chief_referee');
  
  // 决定是否能查看标签页和列表（管理员/主裁 或 开启了"我的报名"功能）
  const canViewParticipants = isAdminOrChiefReferee || myRegistrations;
  
  // 导出参赛者（按单位格式，仅在按单位分组标签下有效）
  const handleExportSchoolFormat = async () => {
    if (!filters.competitionId) {
      setError('请先选择一个比赛');
      return;
    }

    try {
      setActionLoading(true);
      
      // 直接使用前端已经加载好的分组数据，避免后端路由或网络问题
      if (!groupedParticipants || groupedParticipants.length === 0) {
        throw new Error('当前没有可导出的数据，请确保列表已加载。');
      }

      // 遍历前端数据，自行组装 Excel 需要的格式
      const exportData = groupedParticipants.map(group => {
        let leader = '';
        let leaderPhone = '';
        let coach = '';
        let coachPhone = '';
        const maleNames = new Set();
        const femaleNames = new Set();

        (group.participants || []).forEach(p => {
          // 提取领队教练
          if (p.teamLeader && !leader) leader = p.teamLeader;
          if (p.leaderPhone && !leaderPhone) leaderPhone = p.leaderPhone;
          if (p.coach && !coach) coach = p.coach;
          if (p.coachPhone && !coachPhone) coachPhone = p.coachPhone;

          // 不再区分集体项目，全部按性别填入选手名单
          const name = p.name || '未知姓名';
          if (p.gender === 'male' || p.gender === '男') {
            maleNames.add(name);
          } else if (p.gender === 'female' || p.gender === '女') {
            femaleNames.add(name);
          } else {
            maleNames.add(name); // 默认放入男子
          }
        });

        return {
          '报名单位': group.schoolName || group.displayName || '未知单位',
          '领队信息': leader ? `${leader} (${leaderPhone})` : '无',
          '教练信息': coach ? `${coach} (${coachPhone})` : '无',
          '男子选手': Array.from(maleNames).join(' '),
          '女子选手': Array.from(femaleNames).join(' ')
        };
      });

      // 创建工作表
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '参赛代表队名单');
      
      // 获取当前比赛的名称
      const currentComp = competitions.find(c => c._id === filters.competitionId);
      const compName = currentComp ? currentComp.name : '比赛';
      
      // 设置列宽使其更美观
      const colWidths = [
        { wch: 20 }, // 报名单位
        { wch: 20 }, // 领队信息
        { wch: 20 }, // 教练信息
        { wch: 40 }, // 男子选手 (加宽一点以容纳更多名字)
        { wch: 40 }  // 女子选手 (加宽一点以容纳更多名字)
      ];
      ws['!cols'] = colWidths;

      // 导出Excel
      XLSX.writeFile(wb, `${compName}_参赛代表队名单.xlsx`);
      
      setSuccessMessage('参赛代表队名单导出成功！');
    } catch (error) {
      console.error('Export error:', error);
      setError(error.message || '导出失败');
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // 导出人员统计一览表
  const handleExportStatisticsFormat = async () => {
    if (!filters.competitionId) {
      setError('请先选择一个比赛');
      return;
    }

    try {
      setActionLoading(true);
      
      if (!groupedParticipants || groupedParticipants.length === 0) {
        throw new Error('当前没有可导出的数据，请确保列表已加载。');
      }

      const statsData = [];
      let index = 1;
      
      // 用于计算总计的变量
      let totalMaleAthletes = 0;
      let totalFemaleAthletes = 0;
      let totalMaleLeaders = 0;
      let totalMaleCoaches = 0;
      let grandTotal = 0;

      groupedParticipants.forEach(group => {
        let maleAthletes = new Set();
        let femaleAthletes = new Set();
        let leaders = new Set();
        let coaches = new Set();

        (group.participants || []).forEach(p => {
          // 统计选手
          const name = p.name || '未知姓名';
          if (p.gender === 'male' || p.gender === '男') {
            maleAthletes.add(name);
          } else if (p.gender === 'female' || p.gender === '女') {
            femaleAthletes.add(name);
          } else {
            maleAthletes.add(name); // 默认放男列
          }

          // 统计领队 (以名字区分，无性别字段，默认放男列，女列留空)
          if (p.teamLeader && p.teamLeader.trim() !== '') {
            leaders.add(p.teamLeader.trim());
          }

          // 统计教练
          if (p.coach && p.coach.trim() !== '') {
            coaches.add(p.coach.trim());
          }
        });

        const maleCount = maleAthletes.size;
        const femaleCount = femaleAthletes.size;
        const leaderCount = leaders.size;
        const coachCount = coaches.size;
        
        // 我们没有医生的数据，全部为0
        const total = maleCount + femaleCount + leaderCount + coachCount;

        if (total > 0) {
          // 累加到总计
          totalMaleAthletes += maleCount;
          totalFemaleAthletes += femaleCount;
          totalMaleLeaders += leaderCount;
          totalMaleCoaches += coachCount;
          grandTotal += total;

          statsData.push([
            index++,
            group.schoolName || group.displayName || '未知单位',
            maleCount > 0 ? maleCount : '-',
            femaleCount > 0 ? femaleCount : '-',
            leaderCount > 0 ? leaderCount : '-',
            '-', // 领队 女
            coachCount > 0 ? coachCount : '-',
            '-', // 教练 女
            '-', // 随队队医 男
            '-', // 随队队医 女
            total
          ]);
        }
      });

      // 添加总计行
      if (statsData.length > 0) {
        statsData.push([
          '总计', // 将覆盖序号和参赛队两列
          null,
          totalMaleAthletes > 0 ? totalMaleAthletes : '-',
          totalFemaleAthletes > 0 ? totalFemaleAthletes : '-',
          totalMaleLeaders > 0 ? totalMaleLeaders : '-',
          '-',
          totalMaleCoaches > 0 ? totalMaleCoaches : '-',
          '-',
          '-',
          '-',
          grandTotal
        ]);
      }

      const currentComp = competitions.find(c => c._id === filters.competitionId);
      const compName = currentComp ? currentComp.name : '比赛';
      const title = `${compName} 人员统计一览表`;

      // 构造工作表数组 (AOA - Array of Arrays)
      const wsData = [
        [title, null, null, null, null, null, null, null, null, null, null],
        ['序号', '参赛队', '选手', null, '领队', null, '教练', null, '随队队医', null, '总数'],
        [null, null, '男', '女', '男', '女', '男', '女', '男', '女', null],
        ...statsData
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 合并单元格
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // 标题跨所有列
        { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }, // 序号
        { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }, // 参赛队
        { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // 选手
        { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }, // 领队
        { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } }, // 教练
        { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } }, // 随队队医
        { s: { r: 1, c: 10 }, e: { r: 2, c: 10 } } // 总数
      ];

      // 如果有总计行，合并总计行的前两列 (序号和参赛队)
      if (statsData.length > 0) {
        const totalRowIndex = 3 + statsData.length - 1; // 标题1 + 表头2 + 数据行数 - 1 (索引从0开始)
        merges.push({ s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 1 } });
      }

      ws['!merges'] = merges;

      // 设置列宽
      ws['!cols'] = [
        { wch: 8 },  // 序号
        { wch: 30 }, // 参赛队
        { wch: 8 },  // 选手男
        { wch: 8 },  // 选手女
        { wch: 8 },  // 领队男
        { wch: 8 },  // 领队女
        { wch: 8 },  // 教练男
        { wch: 8 },  // 教练女
        { wch: 10 }, // 医生男
        { wch: 10 }, // 医生女
        { wch: 10 }  // 总数
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '人员统计一览表');
      
      XLSX.writeFile(wb, `${compName}_人员统计一览表.xlsx`);
      
      setSuccessMessage('人员统计一览表导出成功！');
    } catch (error) {
      console.error('Export error:', error);
      setError(error.message || '导出失败');
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };


  // 导出项目人数统计表
  const handleExportEventStatistics = async () => {
    if (!filters.competitionId) {
      setError('请先选择一个比赛');
      return;
    }

    try {
      setActionLoading(true);
      
      if (!groupedParticipants || groupedParticipants.length === 0) {
        throw new Error('当前没有可导出的数据，请确保列表已加载。');
      }

      // 统计数据
      const eventStats = {};
      let totalParticipants = 0;
      let totalTeams = 0;

      groupedParticipants.forEach(group => {
        // displayName 示例: "初级南拳 (男子U10组)" 或 "某某学校 - 集体项目"
        const eventName = group.event || '未分类项目';
        const isCollective = eventName.includes('集体') || (group.ageGroup || '').includes('混合集体') || eventName.includes('武术操');
        
        // 我们以具体的项目名称+组别作为统计维度
        // 如果是集体项目，同一个 displayName 通常就代表一支队伍
        let key = group.displayName || eventName;
        
        // 修正集体项目的显示名称
        if (isCollective) {
          // 为了更好看，我们把集体项目归类
          // 假设我们要统计具体集体项目（如“小学组武术操”）总共有多少队，多少人
          key = `${eventName}`;
          if (group.ageGroup) {
            key += ` (${group.ageGroup})`;
          }
        }

        if (!eventStats[key]) {
          eventStats[key] = {
            name: key,
            isCollective: isCollective,
            peopleCount: 0,
            teamCount: 0
          };
        }

        const count = (group.participants || []).length;
        eventStats[key].peopleCount += count;
        totalParticipants += count;

        if (isCollective) {
          eventStats[key].teamCount += 1;
          totalTeams += 1;
        }
      });

      // 转换为数组并排序 (先个人项目，后集体项目)
      const statsArray = Object.values(eventStats).sort((a, b) => {
        if (a.isCollective && !b.isCollective) return 1;
        if (!a.isCollective && b.isCollective) return -1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });

      // 构造 Excel 数据
      const wsData = [
        ['项目人数统计表'],
        ['序号', '项目名称', '参赛类型', '参赛人数', '参赛队伍数 (仅集体项目)']
      ];

      let index = 1;
      statsArray.forEach(stat => {
        wsData.push([
          index++,
          stat.name,
          stat.isCollective ? '集体项目' : '个人项目',
          stat.peopleCount,
          stat.isCollective ? stat.teamCount : '-'
        ]);
      });

      // 添加总计
      wsData.push([
        '总计',
        null,
        null,
        totalParticipants,
        totalTeams > 0 ? totalTeams : '-'
      ]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 合并单元格
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // 标题
        { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 2 } } // 总计行合并前三列
      ];
      ws['!merges'] = merges;

      // 列宽
      ws['!cols'] = [
        { wch: 8 },  // 序号
        { wch: 40 }, // 项目名称
        { wch: 15 }, // 参赛类型
        { wch: 15 }, // 参赛人数
        { wch: 25 }  // 队伍数
      ];

      const currentComp = competitions.find(c => c._id === filters.competitionId);
      const compName = currentComp ? currentComp.name : '比赛';
      const wb = XLSX.utils.book_new();
      
      XLSX.utils.book_append_sheet(wb, ws, '项目人数统计');
      XLSX.writeFile(wb, `${compName}_项目人数统计表.xlsx`);
      
      setSuccessMessage('项目人数统计表导出成功！');
    } catch (error) {
      console.error('Export error:', error);
      setError(error.message || '导出失败');
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // 导出完整报名表 (纯前端生成，避免后端报错)
  const handleExport = async (format) => {
    if (!filters.competitionId) {
      setError('请先选择一个比赛');
      return;
    }

    try {
      setActionLoading(true);
      
      // 直接使用前端已经加载好的所有数据进行导出，不依赖后端
      const competitionId = filters.competitionId;
      // 临时拉取该比赛所有人的列表（不分页）
      const response = await participantService.getParticipants(competitionId, { limit: 10000 });
      const allData = response.data || [];
      
      if (allData.length === 0) {
        throw new Error('没有可导出的数据');
      }

      // 将数据格式化为 Excel 需要的格式
      const exportData = allData.map((p, index) => {
        let genderStr = p.gender;
        if (genderStr === 'male') genderStr = '男';
        if (genderStr === 'female') genderStr = '女';
        
        let statusStr = p.status;
        if (statusStr === 'pending') statusStr = '待审核';
        if (statusStr === 'approved') statusStr = '已通过';
        if (statusStr === 'rejected') statusStr = '已拒绝';

        return {
          '序号': index + 1,
          '姓名': p.type === 'team' ? p.teamName : (p.name || ''),
          '性别': genderStr || '-',
          '身份证号': p.idCard || '-',
          '年龄组别': p.ageGroup || p.grade || '-',
          '比赛项目': p.event || '-',
          '项目详情': p.additionalInfo?.eventDetail || '-',
          '代表单位': p.schoolName || '-',
          '领队': p.teamLeader || '-',
          '领队电话': p.leaderPhone || '-',
          '教练': p.coach || '-',
          '教练电话': p.coachPhone || '-',
          '是否测试人员': p.isTest ? '是' : '否',
          '报名状态': statusStr,
          '报名时间': new Date(p.registrationDate).toLocaleString()
        };
      });

      // 创建工作表
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '完整报名表');
      
      // 获取当前比赛的名称
      const currentComp = competitions.find(c => c._id === filters.competitionId);
      const compName = currentComp ? currentComp.name : '比赛';
      
      // 设置列宽
      ws['!cols'] = [
        { wch: 8 },  // 序号
        { wch: 15 }, // 姓名
        { wch: 8 },  // 性别
        { wch: 20 }, // 身份证号
        { wch: 15 }, // 年龄组别
        { wch: 25 }, // 比赛项目
        { wch: 30 }, // 项目详情
        { wch: 25 }, // 代表单位
        { wch: 12 }, // 领队
        { wch: 15 }, // 领队电话
        { wch: 12 }, // 教练
        { wch: 15 }, // 教练电话
        { wch: 15 }, // 是否测试人员
        { wch: 12 }, // 报名状态
        { wch: 22 }  // 报名时间
      ];

      // 导出Excel
      XLSX.writeFile(wb, `${compName}_完整报名表.xlsx`);
      
      setSuccessMessage('完整报名表导出成功！');
    } catch (error) {
      console.error('Export error:', error);
      setError(error.message || '导出完整报名表失败');
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // 下载导入模板
  const handleDownloadTemplate = () => {
    const templateData = [
      ['姓名', '性别(男/女)', '年龄组别', '身份证号', '比赛项目', '代表单位', '领队', '教练', '是否测试人员(是/否)'],
      ['张三', '男', 'U16组', '440304201001011234', '自选长拳', '福田区代表队', '王教练', '李教练', '否'],
      ['李四', '女', '小学乙组', '440304201001011235', '初级刀术', '南山实验教育集团', '张领队', '赵教练', '是']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '参赛名单模板');
    XLSX.writeFile(wb, '参赛名单导入模板.xlsx');
  };

  // 处理文件上传
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!filters.competitionId) {
      setError('请先在上方选择一个要导入的比赛！');
      return;
    }

    setImporting(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      // 跳过表头
      const dataRows = rows.slice(1).filter(row => row.length > 0 && row[0]);
      
      if (dataRows.length === 0) {
        throw new Error('未找到有效的数据行');
      }

      setImportProgress({ current: 0, total: dataRows.length, success: 0, fail: 0 });
      
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
        
        try {
          // 根据模板映射字段
          // 判断是否是集体项目
          // 从下拉框选中的比赛信息中查找该项目是否被标记为集体项目
          let isGroupEvent = (row[4] || '').includes('集体'); 
          
          if (filters.competitionId && competitions.length > 0) {
             const currentComp = competitions.find(c => c._id === filters.competitionId);
             if (currentComp && currentComp.events) {
                const eventConfig = currentComp.events.find(e => e.name === row[4]);
                if (eventConfig && eventConfig.isGroupEvent) {
                   isGroupEvent = true;
                }
             }
          }

          // 处理特殊的年龄组别，尝试将其标准化为比赛配置的组别
          let parsedAgeGroup = row[2] || ''; // 年龄组别在第3列 (C列)
          
          // 如果比赛配置了具体的年龄组别，尝试模糊匹配
          if (filters.competitionId && competitions.length > 0) {
            const currentComp = competitions.find(c => c._id === filters.competitionId);
            if (currentComp && currentComp.ageGroups && currentComp.ageGroups.length > 0) {
              const excelStr = parsedAgeGroup;
              // 寻找包含组别名称的配置项
              const matchedGroup = currentComp.ageGroups.find(g => {
                const standardName = g.name; 
                // 提取核心关键字，如 "U16组" 或 "小学乙组"
                const coreMatch = standardName.match(/([^组]+组)/i);
                if (coreMatch && excelStr.includes(coreMatch[1])) {
                  return true;
                }
                return standardName === excelStr || standardName.includes(excelStr);
              });
              
              if (matchedGroup) {
                parsedAgeGroup = matchedGroup.name; // 替换为标准名称
              }
            }
          }
          
          const participantData = {
            name: row[0] || '',
            gender: row[1] === '女' ? 'female' : 'male', // 性别在第2列 (B列)
            ageGroup: parsedAgeGroup,
            grade: parsedAgeGroup, // 同时存入 grade 字段兼容
            idCard: row[3] ? String(row[3]) : '', // 身份证在第4列 (D列)
            event: row[4] || '', // 比赛项目在第5列 (E列)
            schoolName: row[5] || '', // 代表单位在第6列 (F列)
            teamLeader: row[6] || '', // 领队在第7列 (G列)
            coach: row[7] || '', // 教练在第8列 (H列)
            insuranceConfirmed: true, // 默认已确认保险
            type: 'individual',
            isTest: row[8] === '是' // 测试人员在第9列 (I列)
          };
          
          // 如果是集体项目，将其转换为队伍报名模式
          if (isGroupEvent) {
            participantData.teamName = participantData.schoolName;
            participantData.members = [{ name: participantData.name }];
            // 保留 type: 'individual' 以便复用现在的赛程聚合逻辑，或者如果必须走 team 模式则：
            // participantData.type = 'team'; 
            // （根据我们目前的架构，前台保持 individual，后台聚并即可）
          }
          
          // 如果出生日期需要从身份证推算，也可以在这里加上逻辑
          if (participantData.idCard && participantData.idCard.length >= 14) {
            const birthStr = participantData.idCard.substring(6, 14);
            const year = birthStr.substring(0, 4);
            const month = birthStr.substring(4, 6);
            const day = birthStr.substring(6, 8);
            participantData.birthDate = new Date(`${year}-${month}-${day}`);
          }

          await participantService.addParticipant(filters.competitionId, participantData);
          successCount++;
        } catch (err) {
          console.error(`第 ${i + 2} 行导入失败:`, err);
          failCount++;
        }
      }

      setImportProgress(prev => ({ ...prev, success: successCount, fail: failCount }));
      setSuccessMessage(`批量导入完成！成功: ${successCount} 条，失败: ${failCount} 条。`);
      
      // 刷新列表
      await refreshLists();

    } catch (err) {
      setError(err.message || '读取 Excel 文件失败');
    } finally {
      setImporting(false);
      setImportDialogOpen(false);
      // 重置 input
      event.target.value = null;
    }
  };

  // 刷新单个列表或全列表的方法
  const refreshLists = async () => {
    try {
      const competitionId = filters.competitionId || (competitions.length > 0 ? competitions[0]._id : null);
      if (!competitionId) return;

      // 刷新主列表
      const params = {
        search: filters.search || undefined,
        status: filters.status || undefined,
        type: filters.type || undefined,
        page: page + 1,
        limit: rowsPerPage,
        ...(myRegistrations ? { myRegistrations: true } : {})
      };
      const response = await participantService.getParticipants(competitionId, params);
      setParticipants(response.data);
      setTotalCount(response.total || 0);
      setUniqueParticipantCount(response.uniqueParticipantTotal || response.total || 0);

      // 如果按项目分组或按单位分组页签打开，刷新分组列表
      const isEventGroupTab = canViewParticipants && tabValue === 1;
      const isSchoolGroupTab = canViewParticipants && !myRegistrations && tabValue === 2;
      
      if (isEventGroupTab || isSchoolGroupTab) {
        const groupParams = {
          search: filters.search || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined,
          groupBy: isSchoolGroupTab ? 'school' : 'event',
          limit: 5000,
          ...(myRegistrations ? { myRegistrations: true } : {})
        };
        const groupResponse = await participantService.getParticipants(competitionId, groupParams);
        setGroupedParticipants(groupResponse.data || []);
      }
    } catch (error) {
      console.error('刷新列表失败:', error);
    }
  };

  // 获取比赛列表
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const params = {
          limit: 100
        };
        
        // 如果是“我的报名”视图（参赛单位查看），则仅显示“报名中”和“进行中”的比赛
        if (myRegistrations) {
          params.status = ['registration', 'ongoing'];
        }
        
        const response = await competitionService.getCompetitions(params);
        setCompetitions(response.data);
      } catch (error) {
        console.error('获取比赛列表失败:', error);
      }
    };
    
    fetchCompetitions();
  }, [myRegistrations]);

  // 处理 URL 参数中的 competitionId
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const competitionIdParam = searchParams.get('competitionId');
    if (competitionIdParam) {
      setFilters(prev => ({ ...prev, competitionId: competitionIdParam }));
    }
  }, [location.search]);
  
  // 当过滤器改变时重置分页
  useEffect(() => {
    setPage(0);
  }, [filters.search, filters.status, filters.type, filters.competitionId]);

  // 获取参赛者列表
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!filters.competitionId && competitions.length === 0) return;
      
      setLoading(true);
      setError('');
      
      try {
        // 构建查询参数
        const params = {
          search: filters.search || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined,
          page: page + 1,
          limit: rowsPerPage,
          ...(myRegistrations ? { myRegistrations: true } : {})
        };
        
        // 如果选择了比赛，获取该比赛的参赛者
        if (filters.competitionId) {
          const response = await participantService.getParticipants(filters.competitionId, params);
          setParticipants(response.data);
          setTotalCount(response.total || 0);
          setUniqueParticipantCount(response.uniqueParticipantTotal || response.total || 0);
        } else if (competitions.length > 0) {
          // 获取第一个比赛的参赛者
          const response = await participantService.getParticipants(competitions[0]._id, params);
          setParticipants(response.data);
          setTotalCount(response.total || 0);
          setUniqueParticipantCount(response.uniqueParticipantTotal || response.total || 0);
          setFilters(prev => ({ ...prev, competitionId: competitions[0]._id }));
        } else {
          setParticipants([]);
          setTotalCount(0);
          setUniqueParticipantCount(0);
        }
      } catch (error) {
        setError(error.message || '获取参赛者列表失败');
        console.error('获取参赛者列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchParticipants();
  }, [filters.competitionId, filters.status, filters.type, filters.search, competitions, page, rowsPerPage]);

  // 获取按项目或按单位分组的参赛者列表
  useEffect(() => {
    const fetchGrouped = async () => {
      if (!filters.competitionId && competitions.length === 0) return;
      
      // 判断当前是不是在“按项目分组(index 1)”或“按单位分组(index 2)”
      const isEventGroupTab = canViewParticipants && tabValue === 1;
      const isSchoolGroupTab = canViewParticipants && !myRegistrations && tabValue === 2;
      
      if (!isEventGroupTab && !isSchoolGroupTab) return;

      setLoadingGrouped(true);
      setError('');

      try {
        const params = {
          search: filters.search || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined,
          groupBy: isSchoolGroupTab ? 'school' : 'event',
          limit: 5000, // 获取所有数据以进行分组显示
          ...(myRegistrations ? { myRegistrations: true } : {})
        };

        const competitionId = filters.competitionId || (competitions[0] && competitions[0]._id);
        if (!competitionId) {
          setGroupedParticipants([]);
        } else {
          const response = await participantService.getParticipants(competitionId, params);
          // 后端返回的数据如果不是数组，尝试从 data 属性获取
          const groupData = Array.isArray(response) ? response : (response.data || []);
          setGroupedParticipants(groupData);
        }
      } catch (error) {
        setError(error.message || '获取分组参赛者失败');
        console.error('获取分组参赛者失败:', error);
      } finally {
        setLoadingGrouped(false);
      }
    };

    fetchGrouped();
  }, [tabValue, filters.competitionId, filters.status, filters.type, filters.search, competitions, canViewParticipants]);
  
  // 处理标签切换
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // 处理过滤器变化
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 处理分页变化
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 处理搜索
  const handleSearch = (e) => {
    e.preventDefault();
    // 搜索已经通过状态变化触发了数据获取
  };
  
  // 处理重置过滤器
  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: '',
      type: ''
    });
  };
  
  // 打开确认对话框
  const openDialog = (action, participant) => {
    setDialogAction(action);
    setSelectedParticipant(participant);
    setDialogOpen(true);
  };
  
  // 关闭确认对话框
  const closeDialog = () => {
    setDialogOpen(false);
    setDialogAction(null);
    setSelectedParticipant(null);
  };
  
  // 处理下载报名表
  const handleViewPhoto = async (participant) => {
    try {
      const competitionId = typeof participant.competition === 'object' ? participant.competition._id : participant.competition;
      const blob = await participantService.getParticipantPhoto(competitionId, participant._id);
      if (photoDialogUrl) window.URL.revokeObjectURL(photoDialogUrl);
      setPhotoDialogUrl(window.URL.createObjectURL(blob));
      setPhotoDialogParticipant(participant); setPhotoDialogOpen(true);
    } catch (viewError) { setError(viewError?.message || '\u65e0\u6cd5\u8bfb\u53d6\u8fd0\u52a8\u5458\u7167\u7247'); }
  };

  const handleClosePhoto = () => { if (photoDialogUrl) window.URL.revokeObjectURL(photoDialogUrl); setPhotoDialogUrl(''); setPhotoDialogParticipant(null); setPhotoDialogOpen(false); };

  const handleExportPhotos = async () => {
    if (!filters.competitionId) { setError('\u8bf7\u5148\u9009\u62e9\u8d5b\u4e8b'); return; }
    try {
      setActionLoading(true);
      const blob = await participantService.exportParticipantsWithPhotos(filters.competitionId);
      const url = window.URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'registration_photos.zip'; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
      setSuccessMessage('\u62a5\u540d\u8d44\u6599\u548c\u53bb\u91cd\u540e\u7684\u7167\u7247\u4e0b\u8f7d\u5df2\u5f00\u59cb');
    } catch (exportError) { setError(exportError?.message || '\u7167\u7247\u5bfc\u51fa\u5931\u8d25'); } finally { setActionLoading(false); }
  };

  const handleDownload = async (participant) => {
    try {
      // 确保有比赛ID
      const competitionId = typeof participant.competition === 'object' ? participant.competition._id : participant.competition;
      
      const blob = await participantService.downloadRegistrationForm(competitionId, participant._id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 获取扩展名
      let extension = 'pdf';
      if (participant.registrationFormFile) {
        const parts = participant.registrationFormFile.split('.');
        if (parts.length > 1) {
          extension = parts.pop();
        }
      }
      
      const participantName = participant.type === 'team' ? participant.teamName : (participant.name || participant.user?.name || '参赛者');
      link.setAttribute('download', `${participantName}_报名表.${extension}`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      setError(error.message || '下载报名表失败');
    }
  };

  // 处理切换测试人员状态
  const handleToggleTest = async (participant) => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const competitionId = typeof participant.competition === 'object' ? participant.competition._id : participant.competition;
      const newIsTest = !participant.isTest;
      await participantService.updateParticipant(competitionId, participant._id, { isTest: newIsTest });
      
      // 更新参赛者列表
      setParticipants(prev => 
        prev.map(p => 
          p._id === participant._id ? { ...p, isTest: newIsTest } : p
        )
      );
      
      // 更新分组数据
      setGroupedParticipants(prev => {
        return prev.map(group => {
          return {
            ...group,
            participants: (group.participants || []).map(p => 
              p._id === participant._id ? { ...p, isTest: newIsTest } : p
            )
          };
        });
      });
      
      const participantName = participant.type === 'team' ? participant.teamName : (participant.name || participant.user?.name || '参赛者');
      setSuccessMessage(`已将 ${participantName} 标记为${newIsTest ? '测试人员' : '正式人员'}`);
    } catch (error) {
      setError(error.message || '更新测试状态失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 处理审核通过
  const handleApprove = async (participant) => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const competitionId = typeof participant.competition === 'object' ? participant.competition._id : participant.competition;
      await participantService.approveParticipant(competitionId, participant._id);
      
      // 更新参赛者列表
      setParticipants(prev => 
        prev.map(p => 
          p._id === participant._id ? { ...p, status: 'approved' } : p
        )
      );
      
      // 同时也更新分组数据中的状态（如果需要的话）
      setGroupedParticipants(prev => {
        return prev.map(group => {
          return {
            ...group,
            participants: (group.participants || []).map(p => 
              p._id === participant._id ? { ...p, status: 'approved' } : p
            )
          };
        });
      });
      
      const participantName = participant.type === 'team' ? participant.teamName : (participant.name || participant.user?.name || '参赛者');
      setSuccessMessage(`已通过 ${participantName} 的参赛申请`);
    } catch (error) {
      setError(error.message || '审核参赛者失败');
    } finally {
      setActionLoading(false);
      closeDialog();
    }
  };
  
  // 处理审核拒绝
  const handleReject = async (participant) => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const competitionId = typeof participant.competition === 'object' ? participant.competition._id : participant.competition;
      await participantService.rejectParticipant(competitionId, participant._id);
      
      // 更新参赛者列表
      setParticipants(prev => 
        prev.map(p => 
          p._id === participant._id ? { ...p, status: 'rejected' } : p
        )
      );
      
      // 更新分组数据中的状态
      setGroupedParticipants(prev => {
        return prev.map(group => {
          return {
            ...group,
            participants: (group.participants || []).map(p => 
              p._id === participant._id ? { ...p, status: 'rejected' } : p
            )
          };
        });
      });
      
      const participantName = participant.type === 'team' ? participant.teamName : (participant.name || participant.user?.name || '参赛者');
      setSuccessMessage(`已拒绝 ${participantName} 的参赛申请`);
    } catch (error) {
      setError(error.message || '拒绝参赛者失败');
    } finally {
      setActionLoading(false);
      closeDialog();
    }
  };
  
  // 处理删除参赛者
  const handleDelete = async (participant) => {
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const competitionId = typeof participant.competition === 'object' ? participant.competition._id : participant.competition;
      await participantService.deleteParticipant(competitionId, participant._id);
      
      // 更新参赛者列表
      setParticipants(prev => 
        prev.filter(p => p._id !== participant._id)
      );
      
      // 更新分组数据中的状态
      setGroupedParticipants(prev => {
        return prev.map(group => {
          return {
            ...group,
            participants: (group.participants || []).filter(p => p._id !== participant._id)
          };
        });
      });
      
      const participantName = participant.type === 'team' ? participant.teamName : (participant.name || participant.user?.name || '参赛者');
      setSuccessMessage(`已删除 ${participantName} 的参赛记录`);
    } catch (error) {
      setError(error.message || '删除参赛者失败');
    } finally {
      setActionLoading(false);
      closeDialog();
    }
  };
  
  // 处理确认对话框的操作
  const handleConfirmAction = () => {
    if (!selectedParticipant && dialogAction !== 'bulk_delete' && dialogAction !== 'bulk_approve') return;
    
    switch (dialogAction) {
      case 'approve':
        handleApprove(selectedParticipant);
        break;
      case 'reject':
        handleReject(selectedParticipant);
        break;
      case 'delete':
        handleDelete(selectedParticipant);
        break;
      case 'bulk_delete':
        handleBulkDelete();
        break;
      case 'bulk_approve':
        handleBulkApprove();
        break;
      default:
        closeDialog();
    }
  };
  
  const handleBulkApprove = async () => {
    if (!filters.competitionId) return;
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await participantService.bulkApproveParticipants(filters.competitionId);
      setSuccessMessage(response.message || `成功通过了参赛者`);
      await refreshLists();
    } catch (error) {
      setError(error.message || '一键通过参赛者失败');
    } finally {
      setActionLoading(false);
      closeDialog();
    }
  };

  const handleBulkDelete = async () => {
    if (!filters.competitionId) return;
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await participantService.bulkDeleteParticipants(filters.competitionId);
      setSuccessMessage(response.message || `成功清空了参赛者`);
      await refreshLists();
    } catch (error) {
      setError(error.message || '清空参赛者失败');
    } finally {
      setActionLoading(false);
      closeDialog();
    }
  };

  // 获取参赛者状态的中文名称和颜色
  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { name: '待审核', color: 'warning' },
      'approved': { name: '已通过', color: 'success' },
      'rejected': { name: '已拒绝', color: 'error' }
    };
    
    return statusMap[status] || { name: status, color: 'default' };
  };
  
  // 获取参赛类型的中文名称和图标
  const getTypeInfo = (type) => {
    const typeMap = {
      'individual': { name: '个人', icon: <PersonIcon /> },
      'team': { name: '团队', icon: <GroupIcon /> }
    };
    
    return typeMap[type] || { name: type, icon: null };
  };

  // 获取性别的中文名称
  const getGenderLabel = (gender) => {
    const genderMap = {
      'male': '男',
      'female': '女'
    };
    return genderMap[gender] || gender || '-';
  };
  
  // 渲染参赛者列表
  const renderParticipants = () => {
    if (participants.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到符合条件的参赛者
          </Typography>
          {(filters.search || filters.status || filters.type) && (
            <Button onClick={handleResetFilters} sx={{ mt: 2 }}>
              清除过滤条件
            </Button>
          )}
        </Box>
      );
    }
    
    return (
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="参赛者表">
          <TableHead>
            <TableRow>
              <TableCell>参赛者</TableCell>
              <TableCell>照片</TableCell>
              <TableCell>所属单位</TableCell>
              <TableCell>性别</TableCell>
              <TableCell>年龄组别</TableCell>
              <TableCell>参赛项目</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>备注</TableCell>
              <TableCell>报名时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {participants.map((participant) => {
              const statusInfo = getStatusInfo(participant.status);
              const typeInfo = getTypeInfo(participant.type);
              const participantName = participant.type === 'team' ? 
                participant.teamName : 
                (participant.name || participant.user?.name || '未知参赛者');
              
              return (
                <TableRow key={participant._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {typeInfo.icon}
                      <Typography sx={{ ml: 1 }}>
                        {participantName}
                      </Typography>
                      {participant.isTest && (
                        <Chip label="测试" color="secondary" size="small" sx={{ ml: 1, height: 20 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {participant.photoFile ? (
                      <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => handleViewPhoto(participant)}>
                        {'\u67e5\u770b\u7167\u7247'}
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">{'\u672a\u4e0a\u4f20'}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{participant.schoolName || '-'}</TableCell>
                  <TableCell>{getGenderLabel(participant.gender)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{participant.ageGroup || participant.grade || '-'}</TableCell>
                        <TableCell>{participant.event || '-'}</TableCell>
                  <TableCell>{typeInfo.name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={statusInfo.name} 
                      color={statusInfo.color} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {participant.additionalInfo?.notes ? (
                      <Tooltip title={participant.additionalInfo.notes}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 150, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}
                        >
                          {participant.additionalInfo.notes}
                        </Typography>
                      </Tooltip>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(participant.registrationDate).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {participant.registrationFormFile && (
                        <Tooltip title="下载报名表">
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => handleDownload(participant)}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {isAdminOrChiefReferee && (
                        <Tooltip title={participant.isTest ? "设为正式人员" : "设为测试人员"}>
                          <IconButton
                            color={participant.isTest ? "secondary" : "default"}
                            size="small"
                            onClick={() => handleToggleTest(participant)}
                          >
                            <ScienceIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {isAdminOrChiefReferee && (
                        <Tooltip title="编辑">
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => {
                              setEditingParticipant(participant);
                              setAddParticipantDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {isAdminOrChiefReferee && participant.status === 'pending' && (
                        <>
                          <Tooltip title="通过">
                            <IconButton 
                              color="success" 
                              size="small"
                              onClick={() => openDialog('approve', participant)}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="拒绝">
                            <IconButton 
                              color="error" 
                              size="small"
                              onClick={() => openDialog('reject', participant)}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      
                      <Tooltip title="删除">
                        <IconButton 
                          color="default" 
                          size="small"
                          onClick={() => openDialog('delete', participant)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每页行数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
        />
      </TableContainer>
    );
  };
  
  // 渲染按项目分组的参赛者
  const renderGroupedByEvent = () => {
    if (!groupedParticipants || groupedParticipants.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到分组数据或没有符合条件的参赛者
          </Typography>
        </Box>
      );
    }
    
    // 计算总人数
    const totalGrouped = groupedParticipants.reduce((acc, group) => acc + (group.participants || []).length, 0);

  return (
    <Box>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" color="primary">
            当前报名项目数: {totalGrouped}
          </Typography>
        </Box>
        {groupedParticipants.map((group) => (
          <Accordion key={group.displayName || group.event} TransitionProps={{ unmountOnExit: true }} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">{group.displayName || group.event || '未分类项目'}</Typography>
                  {group.ageGroup && (
                    <Chip 
                      label={group.ageGroup} 
                      color="primary" 
                      variant="outlined" 
                      size="small" 
                    />
                  )}
                  {group.schoolName && group.schoolName !== '未知单位' && tabValue !== 2 && (
                    <Chip 
                      label={group.schoolName} 
                      color="secondary" 
                      variant="outlined" 
                      size="small" 
                    />
                  )}
                </Box>
                <Chip label={`人数：${(group.participants || []).length}`} variant="outlined" size="small" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {(group.participants || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">该项目暂无参赛者</Typography>
              ) : (
                <TableContainer component={Paper} elevation={0} variant="outlined">
                  <Table size="small" aria-label={`项目 ${group.event} 参赛者表`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>参赛者</TableCell>
                      <TableCell>所属单位</TableCell>
                      <TableCell>性别</TableCell>
                      <TableCell>年龄组别</TableCell>
                      <TableCell>类型</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>备注</TableCell>
                      <TableCell>报名时间</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.participants.map((participant) => {
                      const statusInfo = getStatusInfo(participant.status);
                      const typeInfo = getTypeInfo(participant.type);
                      const participantName = participant.type === 'team' ? 
                        participant.teamName : 
                        (participant.name || participant.user?.name || '未知参赛者');

                      return (
                        <TableRow key={participant._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {typeInfo.icon}
                              <Typography sx={{ ml: 1 }}>
                                {participantName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{participant.schoolName || '-'}</TableCell>
                          <TableCell>{getGenderLabel(participant.gender)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{participant.ageGroup || participant.grade || '-'}</TableCell>
                          <TableCell>{typeInfo.name}</TableCell>
                          <TableCell>
                            <Chip 
                              label={statusInfo.name} 
                              color={statusInfo.color} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            {participant.additionalInfo?.notes ? (
                              <Tooltip title={participant.additionalInfo.notes}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    maxWidth: 150, 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap' 
                                  }}
                                >
                                  {participant.additionalInfo.notes}
                                </Typography>
                              </Tooltip>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(participant.registrationDate).toLocaleString()}
                          </TableCell>
                          <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {participant.registrationFormFile && (
                              <Tooltip title="下载报名表">
                                <IconButton
                                  color="primary"
                                  size="small"
                                  onClick={() => handleDownload(participant)}
                                >
                                  <DownloadIcon />
                                </IconButton>
                              </Tooltip>
                            )}

                            {isAdminOrChiefReferee && (
                              <Tooltip title="编辑">
                                <IconButton
                                  color="primary"
                                  size="small"
                                  onClick={() => {
                                    setEditingParticipant(participant);
                                    setAddParticipantDialogOpen(true);
                                  }}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                            )}

                            {isAdminOrChiefReferee && participant.status === 'pending' && (
                              <>
                                <Tooltip title="通过">
                                    <IconButton 
                                      color="success" 
                                      size="small"
                                      onClick={() => openDialog('approve', participant)}
                                    >
                                      <CheckCircleIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="拒绝">
                                    <IconButton 
                                      color="error" 
                                      size="small"
                                      onClick={() => openDialog('reject', participant)}
                                    >
                                      <CancelIcon />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                              <Tooltip title="删除">
                                <IconButton 
                                  color="default" 
                                  size="small"
                                  onClick={() => openDialog('delete', participant)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  // 渲染确认对话框
  const renderConfirmDialog = () => {
    if (!selectedParticipant && dialogAction !== 'bulk_delete' && dialogAction !== 'bulk_approve') return null;
    
    let participantName = '未知参赛者';
    if (selectedParticipant) {
      participantName = selectedParticipant.type === 'team' ? 
        selectedParticipant.teamName : 
        (selectedParticipant.name || selectedParticipant.user?.name || '未知参赛者');
    }
    
    let title = '';
    let content = '';
    let confirmButtonText = '';
    let confirmButtonColor = 'primary';
    
    switch (dialogAction) {
      case 'approve':
        title = '通过参赛申请';
        content = `您确定要通过 ${participantName} 的参赛申请吗？`;
        confirmButtonText = '通过';
        confirmButtonColor = 'success';
        break;
      case 'reject':
        title = '拒绝参赛申请';
        content = `您确定要拒绝 ${participantName} 的参赛申请吗？`;
        confirmButtonText = '拒绝';
        confirmButtonColor = 'error';
        break;
      case 'delete':
        title = '删除参赛记录';
        content = `您确定要删除 ${participantName} 的参赛记录吗？此操作无法撤销。`;
        confirmButtonText = '删除';
        confirmButtonColor = 'error';
        break;
      case 'bulk_delete':
        title = '一键清空所有参赛者';
        content = `警告：您确定要清空当前比赛的所有参赛者吗？此操作将不可逆地删除所有已导入或已报名的参赛记录！`;
        confirmButtonText = '确认清空';
        confirmButtonColor = 'error';
        break;
      case 'bulk_approve':
        title = '一键通过所有待审核参赛者';
        content = `您确定要一键通过当前比赛的所有“待审核”参赛者吗？`;
        confirmButtonText = '确认通过';
        confirmButtonColor = 'success';
        break;
      default:
        return null;
    }
    
    return (
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {content}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={actionLoading}>
            取消
          </Button>
          <Button 
            onClick={handleConfirmAction} 
            color={confirmButtonColor} 
            disabled={actionLoading}
            variant="contained"
          >
            {actionLoading ? <CircularProgress size={24} /> : confirmButtonText}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        参赛管理
      </Typography>
      
      {/* 成功消息 */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}
      
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* 视图切换标签 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          {canViewParticipants && (
            <Tab label={myRegistrations ? "我的报名名单" : "参赛者管理"} />
          )}
          {canViewParticipants && (
            <Tab label="按项目分组" />
          )}
          {canViewParticipants && !myRegistrations && (
            <Tab label="按单位分组" />
          )}
        </Tabs>
      </Paper>
      
      {/* 参赛者管理标签 */}
      {canViewParticipants && (
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" color="primary">
              报名项目数: {totalCount}　｜　去重后参赛选手数: {uniqueParticipantCount}
            </Typography>
          </Box>
          {/* 搜索和过滤 */}
          <Box sx={{ mb: 4 }}>
            <form onSubmit={handleSearch}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="搜索参赛者..."
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: filters.search && (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                            size="small"
                          >
                            ×
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel id="competition-label">选择比赛</InputLabel>
                    <Select
                      labelId="competition-label"
                      id="competitionId"
                      name="competitionId"
                      value={filters.competitionId}
                      label="选择比赛"
                      onChange={handleFilterChange}
                    >
                      {competitions.map(competition => (
                        <MenuItem key={competition._id} value={competition._id}>
                          {competition.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={5}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Tooltip title="显示更多过滤选项">
                      <Button
                        variant="outlined"
                        startIcon={<FilterListIcon />}
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        过滤
                      </Button>
                    </Tooltip>
                    {isAdminOrChiefReferee && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PersonAddIcon />}
                        onClick={() => {
                          if (!filters.competitionId) {
                            setError('请先在筛选条件中选择一个比赛！');
                            setShowFilters(true);
                            return;
                          }
                          setEditingParticipant(null);
                          setAddParticipantDialogOpen(true);
                        }}
                      >
                        添加参赛者
                      </Button>
                    )}
                    {isAdminOrChiefReferee && (
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<UploadFileIcon />}
                        onClick={() => {
                          if (!filters.competitionId) {
                            setError('请先在筛选条件中选择一个比赛！');
                            setShowFilters(true);
                            return;
                          }
                          setImportDialogOpen(true);
                        }}
                      >
                        批量导入
                      </Button>
                    )}
                    {isAdminOrChiefReferee && (
                      <Button variant="contained" color="info" startIcon={<PhotoIcon />} onClick={handleExportPhotos} disabled={actionLoading}>{'\u5bfc\u51fa\u62a5\u540d\u8d44\u6599\u53ca\u7167\u7247'}</Button>
                    )}
                    {isAdminOrChiefReferee && (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => {
                          if (!filters.competitionId) {
                            setError('请先在筛选条件中选择一个比赛！');
                            setShowFilters(true);
                            return;
                          }
                          openDialog('bulk_approve', null);
                        }}
                      >
                        一键通过
                      </Button>
                    )}
                    {isAdminOrChiefReferee && (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => {
                          if (!filters.competitionId) {
                            setError('请先在筛选条件中选择一个比赛！');
                            setShowFilters(true);
                            return;
                          }
                          openDialog('bulk_delete', null);
                        }}
                      >
                        一键清空
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </form>
            
            {/* 过滤器 */}
            {showFilters && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  过滤选项
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="status-label">参赛状态</InputLabel>
                      <Select
                        labelId="status-label"
                        id="status"
                        name="status"
                        value={filters.status}
                        label="参赛状态"
                        onChange={handleFilterChange}
                      >
                        <MenuItem value="">所有状态</MenuItem>
                        <MenuItem value="pending">待审核</MenuItem>
                        <MenuItem value="approved">已通过</MenuItem>
                        <MenuItem value="rejected">已拒绝</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="type-label">参赛类型</InputLabel>
                      <Select
                        labelId="type-label"
                        id="type"
                        name="type"
                        value={filters.type}
                        label="参赛类型"
                        onChange={handleFilterChange}
                      >
                        <MenuItem value="">所有类型</MenuItem>
                        <MenuItem value="individual">个人</MenuItem>
                        <MenuItem value="team">团队</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={handleResetFilters}>
                    重置过滤器
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
          
          {/* 加载中 */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderParticipants()
          )}
        </TabPanel>
      )}

      {/* 按项目分组标签 */}
      {canViewParticipants && (
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {isAdminOrChiefReferee && (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportEventStatistics}
                  disabled={!filters.competitionId || actionLoading}
                >
                  项目人数统计表 (Excel)
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('xlsx')}
                  disabled={!filters.competitionId || actionLoading}
                >
                  导出完整报名表 (Excel)
                </Button>
              </>
            )}
          </Box>
          
          {loadingGrouped ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderGroupedByEvent()
          )}
        </TabPanel>
      )}

      {/* 按参赛单位分组标签 */}
      {canViewParticipants && !myRegistrations && (
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {isAdminOrChiefReferee && (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportStatisticsFormat}
                  disabled={!filters.competitionId || actionLoading}
                >
                  人员统计一览表 (Excel)
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportSchoolFormat}
                  disabled={!filters.competitionId || actionLoading}
                >
                  参赛代表队名单 (Excel)
                </Button>
              </>
            )}
          </Box>
          
          {loadingGrouped ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderGroupedByEvent()
          )}
        </TabPanel>
      )}
      
      {/* 确认对话框 */}
            <Dialog open={photoDialogOpen} onClose={handleClosePhoto} maxWidth="sm" fullWidth>
        <DialogTitle>{'\u8fd0\u52a8\u5458\u7167\u7247'}{photoDialogParticipant ? ' - ' + (photoDialogParticipant.name || photoDialogParticipant.teamName || '') : ''}</DialogTitle>
        <DialogContent dividers sx={{ textAlign: 'center' }}>{photoDialogUrl && <Box component="img" src={photoDialogUrl} alt="participant photo" sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />}</DialogContent>
        <DialogActions><Button onClick={handleClosePhoto}>{'\u5173\u95ed'}</Button></DialogActions>
      </Dialog>

{renderConfirmDialog()}

      {/* 导入名单对话框 */}
      <Dialog
        open={importDialogOpen}
        onClose={() => !importing && setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>批量导入参赛名单</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              请先下载模板，按照模板格式填写参赛者信息，然后再上传填写好的 Excel 文件。
            </Typography>
            <Button
              variant="outlined"
              onClick={handleDownloadTemplate}
              sx={{ mb: 3 }}
            >
              下载模板
            </Button>
            
            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="body1" gutterBottom fontWeight="bold">
              上传数据文件
            </Typography>
            <Button
              variant="contained"
              component="label"
              disabled={importing}
              startIcon={<UploadFileIcon />}
            >
              选择 Excel 文件并导入
              <input
                type="file"
                hidden
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
              />
            </Button>
            
            {importing && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <CircularProgress size={30} sx={{ mb: 1 }} />
                <Typography variant="body2">
                  正在导入: {importProgress.current} / {importProgress.total}
                </Typography>
              </Box>
            )}
            
            {importProgress.total > 0 && !importing && (
              <Alert 
                severity={importProgress.fail > 0 ? "warning" : "success"} 
                sx={{ mt: 2 }}
              >
                导入完成。成功: {importProgress.success} 条，失败: {importProgress.fail} 条。
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 添加参赛者模态框 */}
      {filters.competitionId && (
        <AddParticipantModal
          open={addParticipantDialogOpen}
          onClose={() => {
            setAddParticipantDialogOpen(false);
            setEditingParticipant(null);
          }}
          competitionId={filters.competitionId}
          editData={editingParticipant}
          onSuccess={async () => {
            setSuccessMessage(editingParticipant ? '参赛者修改成功' : '参赛者添加成功');
            setAddParticipantDialogOpen(false);
            setEditingParticipant(null);
            await refreshLists(); // 统一调用刷新列表方法
          }}
        />
      )}
    </Box>
  );
};

export default ParticipantsPage;
