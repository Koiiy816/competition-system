import React, { useState, useEffect, useMemo } from 'react';

import { useNavigate } from 'react-router-dom';
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
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  EmojiEvents as EmojiEventsIcon,
  Verified as VerifiedIcon,
  Error as ErrorIcon,
  Flag as FlagIcon,
  Edit as EditIcon, // 导入编辑图标
  Delete as DeleteIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  PresentToAll as PresentToAllIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import resultService from '../services/resultService';
import competitionService from '../services/competitionService';
import scheduleService from '../services/scheduleService';
import { useAuth } from '../contexts/AuthContext'; // 导入 useAuth
import PrintPreviewModal from '../components/PrintPreviewModal';
import PrintAllResultsModal from '../components/PrintAllResultsModal';

// 标签面板组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
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

// 编辑成绩模态框组件
const EditResultModal = ({ open, onClose, result, onResultUpdated }) => {
  const [score, setScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth(); // 使用 AuthContext 获取当前用户

  useEffect(() => {
    if (result) {
      setScore(result.finalScore?.toString() || result.score?.toString() || '0');
    }
  }, [result]);

  const handleSubmit = async () => {
    if (!result) return;

    // 只有管理员可以修改
    const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');
    if (!isAdmin) {
      setError('您没有权限修改成绩');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Parse the score
      const parsedScore = parseFloat(score);
      if (isNaN(parsedScore)) {
        throw new Error('请输入有效的数字成绩');
      }

      const updatedResult = await resultService.updateResult(
        result.competition._id || result.competition,
        result._id,
        { 
          score: parsedScore,
          finalScore: parsedScore // 兼容旧的和新的成绩字段
        }
      );
      onResultUpdated(updatedResult.data || updatedResult);
      onClose();
    } catch (error) {
      setError(error.response?.data?.message || error.message || '更新成绩失败');
      console.error('更新成绩失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!result) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>编辑成绩 - {result?.participant?.name || (result?.participant?.teamMembers ? '集体项目' : '未知')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 如果有详细裁判打分数据，展示裁判分数供参考，但不允许在此直接编辑细项 */}
        {result?.details?.scores && (
          <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>裁判打分记录 (只读)</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              {result.details.scores.map((s, i) => (
                <Chip key={i} label={`裁${i+1}: ${s}`} size="small" variant="outlined" />
              ))}
            </Box>
            {result.details.deduction > 0 && (
              <Typography variant="body2" color="error">扣分: {result.details.deduction}</Typography>
            )}
          </Box>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="最终成绩"
          type="number"
          inputProps={{ step: "0.01" }}
          fullWidth
          variant="outlined"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          disabled={loading}
          helperText="直接修改最终成绩（不影响原始的裁判打分记录）"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const normalizeText = (value = '') => String(value).replace(/\s+/g, '');

const isLuohuTraditionalCompetition = (competition) => {
  const competitionName = normalizeText(competition?.name || '');
  return competitionName.includes('罗湖区青少年传统武术锦标赛竞赛');
};

const getFormalResultCount = (scheduleResults = []) => (
  scheduleResults.filter(result => !result.participant?.isTest).length
);

const isLuohuExcludedTeamScoreEvent = (scheduleName = '') => {
  const normalizedScheduleName = normalizeText(scheduleName);
  return normalizedScheduleName.includes('集体武术操') || normalizedScheduleName.includes('幼儿集体拳');
};

const isPercentAwardCompetition = (competition) => Boolean(competition?.awardRules?.enabled);

const isTop3ThenPercentageCompetition = (competition) => (
  isPercentAwardCompetition(competition)
  && competition?.awardRules?.mode === 'top3_then_percentage'
);

const getCompletedFormalResultCount = (scheduleResults = []) => (
  scheduleResults.filter(result => !result.participant?.isTest && !result.details?.isAbsent).length
);

const getRemainingAwardCounts = (remainingCount, competition) => {
  if (remainingCount <= 0) return { first: 0, second: 0, third: 0 };

  const configured = competition?.awardRules?.remainingPrizePercents || {};
  const weights = [
    { key: 'first', weight: Number(configured.first ?? 50) },
    { key: 'second', weight: Number(configured.second ?? 30) },
    { key: 'third', weight: Number(configured.third ?? 20) }
  ];
  const totalWeight = weights.reduce((sum, item) => sum + Math.max(0, item.weight), 0) || 100;
  const counts = { first: 0, second: 0, third: 0 };
  const remainders = [];
  let assigned = 0;

  weights.forEach((item, index) => {
    const raw = remainingCount * Math.max(0, item.weight) / totalWeight;
    counts[item.key] = Math.floor(raw);
    assigned += counts[item.key];
    remainders.push({ index, key: item.key, fraction: raw - Math.floor(raw) });
  });

  remainders.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainingCount - assigned; index += 1) {
    counts[remainders[index % remainders.length].key] += 1;
  }
  return counts;
};

const getTop3ThenPercentageAwardLevel = (rank, completedCount, competition) => {
  if (!rank || rank === '-' || rank === '\u6d4b\u8bd5' || completedCount <= 0) return null;
  const rankAwardCount = Number(competition?.awardRules?.rankAwardCount ?? 3);
  const minimum = Number(competition?.awardRules?.minParticipantsForRanking ?? 3);
  const hasRanking = completedCount >= minimum;

  if (hasRanking && rank <= rankAwardCount) return `\u7b2c${rank}\u540d`;

  const remainingStart = hasRanking ? rankAwardCount + 1 : 1;
  const remainingRank = rank - remainingStart + 1;
  const remainingCount = Math.max(0, completedCount - (hasRanking ? rankAwardCount : 0));
  if (remainingRank < 1 || remainingRank > remainingCount) return null;

  const counts = getRemainingAwardCounts(remainingCount, competition);
  if (remainingRank <= counts.first) return '\u4e00\u7b49\u5956';
  if (remainingRank <= counts.first + counts.second) return '\u4e8c\u7b49\u5956';
  return '\u4e09\u7b49\u5956';
};

const getTop3ThenPercentageTeamPoints = (rank, awardLevel, competition) => {
  const points = competition?.awardRules?.teamAwardPoints || {};
  if (awardLevel === '\u4e00\u7b49\u5956') return Number(points.firstPrize ?? 3);
  if (awardLevel === '\u4e8c\u7b49\u5956') return Number(points.secondPrize ?? 2);
  if (awardLevel === '\u4e09\u7b49\u5956') return Number(points.thirdPrize ?? 1);
  if (rank === 1) return Number(points.rank1 ?? 6);
  if (rank === 2) return Number(points.rank2 ?? 5);
  if (rank === 3) return Number(points.rank3 ?? 4);
  return 0;
};

const getParticipantScoreKey = (participant) => (
  participant?._id || `${participant?.name || ''}__${participant?.schoolName || participant?.teamName || ''}`
);

const getPercentAwardLevel = (rank, formalCount, competition) => {
  if (!rank || rank === '-' || rank === '\u6d4b\u8bd5' || formalCount <= 0) return null;
  const firstLimit = Math.max(1, Math.ceil(formalCount * ((competition?.awardRules?.firstPrizePercent ?? 30) / 100)));
  const secondLimit = Math.max(firstLimit, Math.ceil(formalCount * ((competition?.awardRules?.secondPrizePercent ?? 60) / 100)));
  if (rank <= firstLimit) return '\u4e00\u7b49\u5956';
  if (rank <= secondLimit) return '\u4e8c\u7b49\u5956';
  return '\u4e09\u7b49\u5956';
};

const isIndividualScoringSchedule = (scheduleName = '') => !/(\u96c6\u4f53|\u53cc\u4eba|\u5bf9\u7ec3)/.test(scheduleName);

const getAdmissionCount = (competition, scheduleName, scheduleResults) => {
  const formalCount = getFormalResultCount(scheduleResults);

  if (formalCount <= 0) return 0;

  if (!isLuohuTraditionalCompetition(competition)) {
    return 8;
  }

  if (isLuohuExcludedTeamScoreEvent(scheduleName)) {
    return Math.min(8, formalCount);
  }

  if (formalCount > 8) {
    return 8;
  }

  if (formalCount === 1) {
    return 1;
  }

  return Math.max(formalCount - 1, 1);
};

const shouldCountForTeamRanking = (competition, scheduleName, scheduleResults) => {
  if (isLuohuTraditionalCompetition(competition)) {
    const formalCount = getFormalResultCount(scheduleResults);
    return !isLuohuExcludedTeamScoreEvent(scheduleName) && formalCount >= 3;
  }

  return null;
};

const getScheduleRuleSummary = (competition, scheduleName, scheduleResults) => {
  if (!isLuohuTraditionalCompetition(competition)) {
    return null;
  }

  const formalCount = getFormalResultCount(scheduleResults);
  const admissionCount = getAdmissionCount(competition, scheduleName, scheduleResults);
  const countsForTeam = shouldCountForTeamRanking(competition, scheduleName, scheduleResults);

  return {
    admissionCount,
    formalCount,
    countsForTeam,
    isCollectiveExcluded: isLuohuExcludedTeamScoreEvent(scheduleName)
  };
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // 获取当前用户信息

  // 状态
  const [results, setResults] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [processedData, setProcessedData] = useState({ groupedResults: {}, teamRankings: [] });
  const [competitions, setCompetitions] = useState([]);
  const [schedules, setSchedules] = useState([]); // 赛程列表，用于配置合并项
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 合并项配置对话框状态
  const [combinedConfigOpen, setCombinedConfigOpen] = useState(false);
  const [newCombinedName, setNewCombinedName] = useState('');
  const [selectedSchedules, setSelectedSchedules] = useState([]);

  // 判断是否为纯观赛者（有 spectator 且没有 admin 权限）
  const isSpectatorOnly = user && user.roles && user.roles.includes('spectator') && !user.roles.includes('admin');

  // 从 sessionStorage 初始化页码，实现刷新时记住 tab 页
  const [tabValue, setTabValue] = useState(() => {
    // 如果是纯观赛者，强制默认锁定为 1
    if (user && user.roles && user.roles.includes('spectator') && !user.roles.includes('admin')) {
      return 1;
    }
    const savedTab = sessionStorage.getItem('resultsActiveTab');
    return savedTab ? parseInt(savedTab, 10) : 0;
  });

  // 当 tab 页改变时，保存到 sessionStorage
  useEffect(() => {
    if (!isSpectatorOnly) {
      sessionStorage.setItem('resultsActiveTab', tabValue.toString());
    }
  }, [tabValue, isSpectatorOnly]);

  // 过滤和搜索状态
  const [filters, setFilters] = useState({
    search: '',
    competitionId: sessionStorage.getItem('lastSelectedCompetitionId') || '',
    status: ''
  });

  // 显示过滤器
  const [showFilters, setShowFilters] = useState(false);

  // 模态框状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printScheduleData, setPrintScheduleData] = useState(null);
  const [printParticipantsData, setPrintParticipantsData] = useState([]);
  const [printResultsData, setPrintResultsData] = useState({});
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [teamPrintModalOpen, setTeamPrintModalOpen] = useState(false);
  const [printAllModalOpen, setPrintAllModalOpen] = useState(false);

  // 自动滚动状态
  const [autoScroll, setAutoScroll] = useState(true);

  // 成绩状态列表
  const [resultStatuses, setResultStatuses] = useState([]);

  // 获取成绩状态
  useEffect(() => {
    const fetchResultStatuses = async () => {
      try {
        const statuses = await resultService.getResultStatuses();
        setResultStatuses(statuses);
      } catch (error) {
        console.error('获取成绩状态失败:', error);
      }
    };

    fetchResultStatuses();
  }, []);

  // 获取所有可用的场地
  const availableCourts = useMemo(() => {
    const courts = new Set();
    schedules.forEach(s => {
      if (s.court) courts.add(s.court);
    });
    return Array.from(courts).sort();
  }, [schedules]);

  // 获取特定项目所在的场地
  const getCourtForSchedule = (scheduleName) => {
    let sched = schedules.find(s => s.name === scheduleName);
    if (sched && sched.court) return sched.court;

    // 如果是合并项目，尝试找它的子项目所在的场地
    const currentCompetition = competitions.find(c => c._id === filters.competitionId);
    if (currentCompetition && currentCompetition.events) {
      for (const ev of currentCompetition.events) {
        if (ev.isCombinedEvent && scheduleName.includes(ev.name)) {
          const firstSub = ev.subEvents?.[0];
          if (firstSub) {
            const prefix = scheduleName.replace(ev.name, '').trim();
            const subSchedName = prefix ? `${prefix} ${firstSub}` : firstSub;
            sched = schedules.find(s => s.name === subSchedName || s.name.includes(firstSub));
            if (sched && sched.court) return sched.court;
          }
        }
      }
    }
    return null;
  };

  // 自动滚动效果实现
  useEffect(() => {
    let scrollInterval;

    if (autoScroll && tabValue === 1 && selectedLocation !== 'all') { // 只在单项排名且选定场地时自动滚动
      const container = document.getElementById('auto-scroll-container');
      if (container) {
        scrollInterval = setInterval(() => {
          // 如果滚动到底部了，就停顿一下然后往回滚，或者直接回到顶部
          if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
            // 触底后回到顶部重新开始
            setTimeout(() => {
              if (container) container.scrollTop = 0;
            }, 3000); // 到底部停留3秒
          } else {
            container.scrollTop += 1; // 每次滚动1像素，平滑滚动
          }
        }, 30); // 速度：每30毫秒滚1像素
      }
    }

    return () => {
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, [autoScroll, tabValue, selectedLocation, results]); // 当这些状态变化时重新绑定滚动

  // 获取比赛列表
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const params = {
          limit: 100
        };

        // 非管理员不允许查看已结束的比赛
        // 注意：后端的 roles 是一个数组还是单个字符串？通常返回的 user 结构里是 user.role 或者 user.roles
        const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');

        if (!isAdmin) {
          params.status = ['ongoing', 'registration', 'draft']; // 获取非结束状态的比赛
          params.exclude_status = 'completed';
        } else {
          // 管理员可以看所有的，完全不要传递 status 数组和 exclude_status，
          // 这样后端就不会做任何状态过滤，直接返回全部比赛。
          // 移除所有可能限制管理员查看的参数
          delete params.status;
          delete params.exclude_status;
        }

        const response = await competitionService.getCompetitions(params);
        setCompetitions(response.data);

        // 当获取到比赛列表后，检查当前 filters 中的比赛是否存在于列表中
        if (response.data.length > 0) {
          setFilters(prev => {
            const currentCompetitionExists = prev.competitionId && response.data.some(c => c._id === prev.competitionId);
            // 如果 prev 里面本来就是空的，或者当前选中的比赛不再列表中，才赋值默认的第一个
            if (!prev.competitionId || !currentCompetitionExists) {
              return {
                ...prev,
                competitionId: response.data[0]._id
              };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('获取比赛列表失败:', error);
      }
    };

    // 当 user 状态就绪时才去拉取比赛列表，避免首次渲染时 user 还为 null 导致被误认为非管理员
    if (user !== undefined) {
      fetchCompetitions();
    }
  }, [user]); // 依赖 user，确保获取到正确的角色信息

  // 获取成绩和赛程列表
  useEffect(() => {
    const fetchResultsAndSchedules = async () => {
      if (!filters.competitionId && competitions.length === 0) return;

      setLoading(true);
      setError('');

      try {
        // 如果选择了比赛，获取该比赛的成绩和赛程
        if (filters.competitionId) {
          const params = {
            search: filters.search || undefined,
            status: filters.status || 'verified', // 默认只拉取已审核(已存)的成绩，观众不能看到实时未保存的
            limit: 5000
          };

          const [resultsRes, schedulesRes] = await Promise.all([
            resultService.getResults(filters.competitionId, params),
            scheduleService.getSchedules(filters.competitionId, { limit: 1000 })
          ]);

          setResults(resultsRes.data || []);
          setSchedules(schedulesRes.data || []);
        } else {
          setResults([]);
          setSchedules([]);
        }
      } catch (error) {
        setError(error.message || '获取数据失败');
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResultsAndSchedules();

    // 增加轮询：每 3 秒刷新一次数据，实现“实时刷新”
    const intervalId = setInterval(() => {
      if (filters.competitionId) {
        resultService.getResults(filters.competitionId, {
          search: filters.search || undefined,
          status: filters.status || 'verified', // 默认只拉取已审核(已存)的成绩
          limit: 5000
        }).then(res => {
          setResults(prev => {
            const newData = res.data || [];
            // 性能优化：只有当数据真正发生变化时才更新 state，避免整个大屏每 3 秒做一次无意义的完整重渲染
            if (JSON.stringify(prev) !== JSON.stringify(newData)) {
              return newData;
            }
            return prev;
          });
        }).catch(err => console.error('Silent refresh failed:', err));
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [filters.competitionId, filters.search, filters.status, competitions]);

  // 处理成绩数据计算排名和团体分
  useEffect(() => {
    if (!results || results.length === 0) {
      setProcessedData({ groupedResults: {}, teamRankings: [] });
      return;
    }

    // 按比赛项目（赛程）分组成绩
    const grouped = results.reduce((groups, result) => {
      const scheduleName = result.schedule?.name || '未分类项目';
      if (!groups[scheduleName]) {
        groups[scheduleName] = [];
      }
      groups[scheduleName].push(result);
      return groups;
    }, {});

    // 处理基于新 Schema 的智能合并项
    const currentCompetition = competitions.find(c => c._id === filters.competitionId);
    if (currentCompetition && currentCompetition.events) {
      currentCompetition.events.forEach(eventConfig => {
        if (eventConfig.isCombinedEvent && eventConfig.subEvents && eventConfig.subEvents.length > 0) {
          const participantsScores = {};
          const validPrefixesForThisEvent = new Set();

          // 找到属于这个合并项目所有子赛程的成绩
          const relevantResults = results.filter(r => {
             if (!r.schedule || !r.schedule.name) return false;
             return eventConfig.subEvents.some(subName => r.schedule.name.includes(subName));
          });

          relevantResults.forEach(r => {
            const p = r.participant;
            if (!p || !p.name) return;

            // 提取年龄组别和性别前缀 (如 "U13组 男子 ")
            let prefix = '';
            for (const subName of eventConfig.subEvents) {
              if (r.schedule.name.includes(subName)) {
                prefix = r.schedule.name.replace(subName, '').trim();
                break;
              }
            }

            // --- 核心校验：这个 prefix 是否应该作为这个合并项目？ ---
            // 1. 检查 eventConfig.ageGroups (如果配置了的话)
            if (eventConfig.ageGroups && eventConfig.ageGroups.length > 0) {
              const matchAg = eventConfig.ageGroups.some(ag => prefix.includes(ag));
              if (!matchAg) return; // 不符合年龄组配置，跳过
            }

            // 2. 特殊业务规则：U10组的 42式太极拳/剑 绝对不是合并项目
            if (prefix.includes('U10') && (eventConfig.name.includes('42式') || eventConfig.subEvents.some(s => s.includes('42式')))) {
              return; // 强制跳过
            }

            // 记录这是一个有效的合并项目前缀
            validPrefixesForThisEvent.add(prefix);

            // 核心修复点：使用 姓名+学校+前缀 作为唯一键。
            // 因为在系统中，同一个选手报多个子项目会生成多个独立的 participant 记录，_id 是不同的！
            const key = `${prefix}_${p.name}_${p.schoolName || p.teamName || ''}`;

            if (!participantsScores[key]) {
              participantsScores[key] = {
                participant: p, // 保留其中一个 participant 作为代表
                scoreCount: 0,
                totalScore: 0,
                prefix: prefix,
                results: [],
                latestUpdate: 0
              };
            }

            const scoreVal = typeof r.finalScore === 'number' ? r.finalScore : 
                           (typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0);

            // 只有当分数大于 0 或者该项被标记为弃权时，才认为该项有记录
            if (scoreVal > 0 || r.details?.isAbsent) {
              participantsScores[key].scoreCount += 1;
              participantsScores[key].totalScore += scoreVal; // 弃权分数为0，不影响总分

              const rUpdate = new Date(r.updatedAt || r.createdAt || 0).getTime();
              if (rUpdate > participantsScores[key].latestUpdate) {
                participantsScores[key].latestUpdate = rUpdate;
              }
            }
            // 保存子项成绩信息供导出和打印使用
            let matchedSubName = eventConfig.subEvents.find(sub => r.schedule.name.includes(sub));
            if (matchedSubName) {
              participantsScores[key].results.push({
                subName: matchedSubName,
                score: scoreVal,
                isAbsent: r.details?.isAbsent || false
              });
            }
          });

          // 从 grouped 中删除子项目，因为它们不应该单独出成绩和算团体分
          eventConfig.subEvents.forEach(subName => {
            Object.keys(grouped).forEach(groupName => {
              // 如果分组名字包含子项目名字，并且属于相关的组别前缀，则删掉
              if (groupName.includes(subName)) {
                let matchPrefix = false;
                for (let validPrefix of validPrefixesForThisEvent) {
                  if (groupName.startsWith(validPrefix)) {
                    matchPrefix = true;
                    break;
                  }
                }
                if (matchPrefix) {
                  delete grouped[groupName];
                }
              }
            });
          });

            // 按组别前缀生成合并成绩
            Object.values(participantsScores).forEach(ps => {
              // 核心修复点：不再强制要求选手必须参加所有子项目。
              // 只要该选手在任意子项目中有成绩（scoreCount > 0），就将其已有成绩相加作为合并项目的总分。
              // 这解决了“某选手只报了其中一个子项目”或“另一个子项目缺考”时无法出总分的问题。
              if (ps.scoreCount > 0) {
                const combinedScheduleName = ps.prefix ? `${ps.prefix} ${eventConfig.name}` : eventConfig.name;

                if (!grouped[combinedScheduleName]) {
                  grouped[combinedScheduleName] = [];
                }

                const combinedScore = Math.round(ps.totalScore * 100) / 100;

                // 将子项成绩转换为对象映射
                const subScores = {};
                let isCompletelyAbsent = true; // 判断是否所有子项都弃权了

                ps.results.forEach(sub => {
                  subScores[sub.subName] = { score: sub.score, isAbsent: sub.isAbsent };
                  if (!sub.isAbsent) {
                    isCompletelyAbsent = false;
                  }
                });

                grouped[combinedScheduleName].push({
                  _id: `combined_${eventConfig._id || Math.random().toString()}_${ps.participant._id || ps.participant}`,
                  schedule: { name: combinedScheduleName },
                  participant: ps.participant,
                  score: combinedScore,
                  finalScore: combinedScore,
                  status: 'verified',
                  isCombined: true,
                  subEvents: eventConfig.subEvents, // 保存子项目列表结构
                  subScores: subScores, // 保存子项目成绩
                  details: {
                    isAbsent: isCompletelyAbsent // 如果所有子项都弃权，总项目才算弃权
                  },
                  updatedAt: new Date(ps.latestUpdate).toISOString()
                });
              }
            });
        }
      });
    }

    const teamScores = {};
    const eligibleTeamParticipantKeys = new Set();
    const selectedCompetitionForRules = competitions.find(c => c._id === filters.competitionId);

    // This competition only adds an athlete's points to the team total when the
    // athlete has completed at least the configured number of individual events.
    if (isTop3ThenPercentageCompetition(selectedCompetitionForRules)) {
      const completedIndividualSchedules = new Map();
      Object.entries(grouped).forEach(([scheduleName, scheduleResults]) => {
        if (!isIndividualScoringSchedule(scheduleName)) return;
        const seenInSchedule = new Set();
        scheduleResults.forEach(result => {
          if (result.participant?.isTest || result.details?.isAbsent) return;
          const participantKey = getParticipantScoreKey(result.participant);
          if (participantKey) seenInSchedule.add(participantKey);
        });
        seenInSchedule.forEach(participantKey => {
          completedIndividualSchedules.set(
            participantKey,
            (completedIndividualSchedules.get(participantKey) || 0) + 1
          );
        });
      });
      const minimumEvents = Number(selectedCompetitionForRules?.awardRules?.teamMinEventsPerParticipant ?? 2);
      completedIndividualSchedules.forEach((count, participantKey) => {
        if (count >= minimumEvents) eligibleTeamParticipantKeys.add(participantKey);
      });
    }

    Object.keys(grouped).forEach(scheduleName => {
      const scheduleResults = grouped[scheduleName];

      // 降序排序，弃权排最后
      scheduleResults.sort((a, b) => {
        const isAbsentA = a.details?.isAbsent || false;
        const isAbsentB = b.details?.isAbsent || false;
        if (isAbsentA && isAbsentB) return 0;
        if (isAbsentA) return 1;
        if (isAbsentB) return -1;

        const scoreA = typeof a.finalScore === 'number' ? a.finalScore : 
                       (typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0);
        const scoreB = typeof b.finalScore === 'number' ? b.finalScore : 
                       (typeof b.score === 'number' ? b.score : parseFloat(b.score) || 0);
        return scoreB - scoreA;
      });

      // 获取当前选中的比赛
      const selectedCompetition = competitions.find(c => c._id === filters.competitionId);

      // 团体分计分规则默认：前8名分别按13, 11, 10, 9, 8, 7, 6, 5计分
      let basePoints = [13, 11, 10, 9, 8, 7, 6, 5];

        // 针对“5月30号那天的比赛”的特殊计分规则 (判断名字中是否包含5月30，或日期是否是5-30)
        if (selectedCompetition) {
          const compName = String(selectedCompetition.name || '');
          const compDate = String(selectedCompetition.startDate || '');
          if (compName.includes('5月30') || compDate.includes('05-30') || compDate.includes('05/30')) {
            basePoints = [9, 7, 6, 5, 4, 3, 2, 1];
          }
        }
      const percentAwardMode = isPercentAwardCompetition(selectedCompetition);
      const top3ThenPercentageMode = isTop3ThenPercentageCompetition(selectedCompetition);
      if (percentAwardMode) basePoints = selectedCompetition.awardRules?.teamPoints || [8, 7, 6, 5, 4, 3, 2, 1];

      const formalCount = getFormalResultCount(scheduleResults);
      const completedFormalCount = getCompletedFormalResultCount(scheduleResults);
      const admissionCount = top3ThenPercentageMode
        ? Math.min(Number(selectedCompetition.awardRules?.rankAwardCount ?? 3), completedFormalCount)
        : (percentAwardMode ? Math.min(8, formalCount) : getAdmissionCount(selectedCompetition, scheduleName, scheduleResults));
      const luohuTeamRule = shouldCountForTeamRanking(selectedCompetition, scheduleName, scheduleResults);

      let currentRankIndex = 0; // 0-7，对应1-8名
      let i = 0;

      while (i < scheduleResults.length) {
        const currentMember = scheduleResults[i];
        if (currentMember.details?.isAbsent) {
          currentMember.dynamicRank = '-';
          currentMember.teamPoints = 0;
          i++;
          continue;
        }

        const currentScore = typeof currentMember.finalScore === 'number' ? currentMember.finalScore : 
                             (typeof currentMember.score === 'number' ? currentMember.score : parseFloat(currentMember.score) || 0);

        // 找到当前分数的所有人员
        let j = i;
        let currentScoreMembers = [];
        while (j < scheduleResults.length) {
          const nextMember = scheduleResults[j];
          if (nextMember.details?.isAbsent) break; // 弃权的都在后面，遇到就停止

          const nextScore = typeof nextMember.finalScore === 'number' ? nextMember.finalScore : 
                            (typeof nextMember.score === 'number' ? nextMember.score : parseFloat(nextMember.score) || 0);
          if (nextScore === currentScore) {
            currentScoreMembers.push(nextMember);
            j++;
          } else {
            break;
          }
        }

        // 区分测试人员和正式人员
        const normalMembers = currentScoreMembers.filter(m => !m.participant?.isTest);
        const testMembers = currentScoreMembers.filter(m => m.participant?.isTest);

        // 测试人员直接标记，不参与名次分配
        testMembers.forEach(m => {
          m.dynamicRank = '测试';
          m.teamPoints = 0;
          m.isAwarded = false;
          m.awardRankLimit = 0;
        });

        // 正式人员参与并列名次和积分计算
        if (normalMembers.length > 0) {
          const tieCount = normalMembers.length;
          const displayRank = currentRankIndex + 1;
          const awardLevel = top3ThenPercentageMode
            ? getTop3ThenPercentageAwardLevel(displayRank, completedFormalCount, selectedCompetition)
            : (percentAwardMode ? getPercentAwardLevel(displayRank, formalCount, selectedCompetition) : null);
          const isWithinAdmissionRange = percentAwardMode ? Boolean(awardLevel) : displayRank <= admissionCount;
          const top3TeamPoints = top3ThenPercentageMode
            ? getTop3ThenPercentageTeamPoints(displayRank, awardLevel, selectedCompetition)
            : null;
          const isWithinTeamPointsRange = top3ThenPercentageMode
            ? top3TeamPoints > 0
            : (percentAwardMode ? displayRank <= 8 : isWithinAdmissionRange);
          let totalPointsForTies = 0;
          let actualPointsAwarded = 0;

          for (let k = 0; k < tieCount; k++) {
            if (isWithinTeamPointsRange && currentRankIndex + k < basePoints.length) {
              totalPointsForTies += basePoints[currentRankIndex + k];
              actualPointsAwarded++;
            }
          }

          // 并列名次得分：空出名次的分值相加后的平均数
          const averagePoints = top3ThenPercentageMode
            ? top3TeamPoints
            : (actualPointsAwarded > 0 ? totalPointsForTies / tieCount : 0);

          // 分配分数并设置显示名次
          normalMembers.forEach(result => {
            result.dynamicRank = displayRank; 
            result.teamPoints = averagePoints;
            result.isAwarded = isWithinAdmissionRange;
            result.awardLevel = awardLevel;
            result.awardRankLimit = admissionCount;

            // 累加到团体分
            const rawSchoolName = result.participant?.schoolName || result.participant?.teamName;

            // 判断当前比赛是否是“第五届南山区中小学教育集团联盟”
            const isTargetCompetition = selectedCompetition && selectedCompetition.name.includes('第五届南山区中小学教育集团联盟');

            // 团体分计入逻辑
            let shouldCountForTeam = false;
            if (top3ThenPercentageMode) {
              shouldCountForTeam = isIndividualScoringSchedule(scheduleName)
                && eligibleTeamParticipantKeys.has(getParticipantScoreKey(result.participant))
                && averagePoints > 0;
            } else if (percentAwardMode) {
              shouldCountForTeam = isIndividualScoringSchedule(scheduleName) && averagePoints > 0;
            } else if (isLuohuTraditionalCompetition(selectedCompetition)) {
              shouldCountForTeam = luohuTeamRule === true && averagePoints > 0;
            } else if (isTargetCompetition) {
              // 特殊规则：传统拳术、传统器械不计入；集体项目要计入
              const isExcludedEvent = scheduleName.includes('传统拳术') || scheduleName.includes('传统器械');
              shouldCountForTeam = !isExcludedEvent;
            } else {
              // 默认规则：如果是集体项目，则不计入团体分
              const isGroupEvent = scheduleName.includes('集体');
              shouldCountForTeam = !isGroupEvent;
            }

            if (rawSchoolName && averagePoints > 0 && shouldCountForTeam) {
              // 针对“第五届南山区中小学教育集团联盟 武术锦标赛竞赛”的特殊集团合并逻辑
              let schoolName = rawSchoolName;
              if (isTargetCompetition) {
                const groupNames = [
                  '蛇口育才教育集团',
                  '南山实验教育集团',
                  '南山外国语学校（集团）',
                  '南山区第二外国语学校（集团）',
                  '南方科技大学教育集团（南山）',
                  '文理实验学校（集团）',
                  '深圳大学附属教育集团',
                  '教育科学研究院附属学校教育集团',
                  '前海创新教育集团'
                ];

                for (const groupName of groupNames) {
                  // 如果原始学校名称包含集团名字（例如：南山实验教育集团1队 包含 南山实验教育集团）
                  if (rawSchoolName.includes(groupName) || groupName.includes(rawSchoolName)) {
                    schoolName = groupName;
                    break;
                  }
                }
              }

              if (!teamScores[schoolName]) {
                teamScores[schoolName] = { schoolName, totalPoints: 0, details: [] };
              }
              teamScores[schoolName].totalPoints += averagePoints;

              let participantName = '未知参赛者';
              if (result.participant) {
                if (result.participant.type === 'team' && result.participant.teamName) {
                  participantName = result.participant.teamName;
                } else if (result.participant.name) {
                  participantName = result.participant.name;
                } else if (result.participant.user && result.participant.user.name) {
                  participantName = result.participant.user.name;
                }
              }

              teamScores[schoolName].details.push({
                participantName,
                scheduleName,
                rank: displayRank,
                points: averagePoints
              });
            }
          });

          // 更新排名索引
          currentRankIndex += tieCount; 
        }

        // 更新外层循环索引
        i = j;
      }

      scheduleResults.forEach(result => {
        if (result.dynamicRank === '-' || result.dynamicRank === '测试') {
          if (result.isAwarded === undefined) result.isAwarded = false;
          if (result.awardRankLimit === undefined) result.awardRankLimit = admissionCount;
        }
      });
    });

    // 将团体分对象转为数组并按总分降序排序
    const teamRankingsArray = Object.values(teamScores).sort((a, b) => b.totalPoints - a.totalPoints);

    setProcessedData({ groupedResults: grouped, teamRankings: teamRankingsArray });
  }, [results, competitions, filters.competitionId]);

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

    // 如果切换了比赛，记录到 sessionStorage 中，防止刷新时丢失
    if (name === 'competitionId') {
      sessionStorage.setItem('lastSelectedCompetitionId', value);
    }
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
      competitionId: '',
      status: ''
    });
  };

  // 处理打开模态框
  const handleOpenModal = (result) => {
    setEditingResult(result);
    setIsModalOpen(true);
  };

  // 处理关闭模态框
  const handleCloseModal = () => {
    setEditingResult(null);
    setIsModalOpen(false);
  };

  // 处理成绩更新
  const handleResultUpdated = (updatedResult) => {
    setResults(results.map(r => r._id === updatedResult._id ? updatedResult : r));
  };

  // 获取成绩状态的中文名称和颜色
  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { name: '待审核', color: 'warning', icon: <FlagIcon /> },
      'verified': { name: '已确认', color: 'success', icon: <VerifiedIcon /> },
      'disputed': { name: '有异议', color: 'error', icon: <ErrorIcon /> }
    };

    return statusMap[status] || { name: status, color: 'default', icon: null };
  };

  // 因为后端 API 不一定返回了状态列表，为了确保过滤功能好用，我们在这里预设好常见状态
  const defaultStatuses = [
    { value: 'pending', label: '待审核' },
    { value: 'verified', label: '已确认' },
    { value: 'disputed', label: '有异议' }
  ];

  const handleExportExcel = (scheduleName, scheduleResults) => {
    // 过滤掉测试人员
    const validResults = scheduleResults.filter(r => !r.participant?.isTest);
    const completedParticipantCount = validResults.filter(result => !result.details?.isAbsent).length;
    const getExportAwardLevel = (rank, isAbsent) => {
      const numericRank = Number(rank);
      if (isAbsent || !Number.isFinite(numericRank) || numericRank < 1 || completedParticipantCount <= 0) return '-';
      const firstPrizeLimit = Math.max(1, Math.ceil(completedParticipantCount * 0.3));
      const secondPrizeLimit = Math.max(firstPrizeLimit, Math.ceil(completedParticipantCount * 0.6));
      if (numericRank <= firstPrizeLimit) return '一等奖';
      if (numericRank <= secondPrizeLimit) return '二等奖';
      return '三等奖';
    };

    // 判断是否为合并项目
    const isCombined = validResults.some(r => r.isCombined);
    const subEventsList = isCombined ? (validResults.find(r => r.isCombined)?.subEvents || []) : [];

    const dataToExport = validResults.map((r) => {
      const p = r.participant;
      const finalScore = typeof r.finalScore === 'number' ? r.finalScore : 
                         (typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0);
      const isAbsent = r.details?.isAbsent || false;

      let displayName = p?.name || (p?.user && p.user.name) || '未知';
      if (p?.isVirtualTeam && p?.teamMembers && p.teamMembers.length > 0) {
        displayName = p.teamMembers.map(m => m.name).join('、');
      } else if (p?.type === 'team' && p?.teamName) {
        displayName = p.teamName;
      }

      const rowData = {
        '奖项': getExportAwardLevel(r.dynamicRank, isAbsent),
        '姓名': displayName,
        '代表队/学校': p?.schoolName || p?.teamName || (p?.user && p?.user.schoolName) || '-'
      };

      // 动态插入子项目成绩列
      if (isCombined && subEventsList.length > 0) {
        subEventsList.forEach(subName => {
          if (r.subScores && r.subScores[subName]) {
            const subData = r.subScores[subName];
            rowData[subName] = subData.isAbsent ? '弃权' : (subData.score > 0 ? subData.score.toFixed(2) : '0');
          } else {
            rowData[subName] = '-'; // 未参加该子项目
          }
        });
      }

      rowData['最终得分'] = isAbsent ? '弃权' : (finalScore > 0 ? finalScore.toFixed(2) : '0');

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "成绩公告");
    XLSX.writeFile(workbook, `${scheduleName} - 成绩公告.xlsx`);
  };

  const handlePrint = (scheduleName, scheduleResults) => {
    const selectedCompetition = competitions.find(c => c._id === filters.competitionId);

    const virtualSchedule = {
      name: scheduleName,
      startTime: selectedCompetition?.startDate || new Date(),
      location: selectedCompetition?.location || ''
    };

    const vParticipants = [];
    const vResults = {};

    // 过滤掉测试人员
    const validResults = scheduleResults.filter(r => !r.participant?.isTest);

    validResults.forEach(r => {
      if (r.participant) {
        // 对于合并项目，participant对象中需要带上额外的 _id 以区分不同前缀但同名同校的人
        // 或者直接将整个 r (包含 subEvents, subScores, isCombined) 存入 vResults
        const participantKey = r.participant._id || r.participant;
        // 如果是合并项目，生成的假 ID 也是唯一的，可以用作 key
        const actualKey = r._id || participantKey; 

        vParticipants.push({ ...r.participant, __printKey: actualKey });
        vResults[actualKey] = r;
      }
    });

    setPrintScheduleData(virtualSchedule);
    setPrintParticipantsData(vParticipants);
    setPrintResultsData(vResults);
    setPrintModalOpen(true);
  };

  // 渲染成绩列表
  const renderResults = () => {
    // 根据状态过滤结果
    const filteredGroupedResults = {};
    Object.keys(processedData.groupedResults).forEach(scheduleName => {
      const scheduleResults = processedData.groupedResults[scheduleName];
      const filteredResults = scheduleResults.filter(result => {
        if (filters.status && result.status !== filters.status) {
          return false;
        }
        // 核心修复点：只显示至少有一个裁判打过分的项目（score > 0）
        // 对于合并项目，之前已经在生成 combined 的时候拦截了，这里主要拦截普通单项
        const scoreVal = typeof result.finalScore === 'number' ? result.finalScore : 
                         (typeof result.score === 'number' ? result.score : parseFloat(result.score) || 0);
        return scoreVal > 0;
      });

      const court = getCourtForSchedule(scheduleName);
      if (filteredResults.length > 0 && (selectedLocation === 'all' || court === selectedLocation)) {
        filteredGroupedResults[scheduleName] = filteredResults;
      }
    });

    if (Object.keys(filteredGroupedResults).length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到符合条件的成绩记录
          </Typography>
          {(filters.search || filters.competitionId || filters.status) && (
            <Button onClick={handleResetFilters} sx={{ mt: 2 }}>
              清除过滤条件
            </Button>
          )}
        </Box>
      );
    }

    return (
      <Box>
        {availableCourts.length > 0 && (
          <Box sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={selectedLocation} 
              onChange={(e, v) => setSelectedLocation(v)}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab label="全部场地" value="all" sx={{ fontWeight: 'bold' }} />
              {availableCourts.map(court => (
                <Tab key={court} label={court} value={court} sx={{ fontWeight: 'bold' }} />
              ))}
            </Tabs>
          </Box>
        )}

        {Object.keys(filteredGroupedResults).map(scheduleName => {
          const court = getCourtForSchedule(scheduleName);
          const ruleSummary = getScheduleRuleSummary(
            competitions.find(c => c._id === filters.competitionId),
            scheduleName,
            filteredGroupedResults[scheduleName]
          );
          return (
          <Box key={scheduleName} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" sx={{ borderLeft: '4px solid #1976d2', pl: 1, color: '#1976d2' }}>
                  {scheduleName}
                </Typography>
                {court && (
                  <Chip 
                    label={court} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                )}
                {ruleSummary && (
                  <Chip
                    label={`录取前${ruleSummary.admissionCount}名${ruleSummary.countsForTeam ? '，计团体总分' : '，不计团体总分'}`}
                    size="small"
                    color={ruleSummary.countsForTeam ? 'success' : 'warning'}
                    variant="outlined"
                  />
                )}
              </Box>
              <Box>
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<PrintIcon />} 
                  onClick={() => handlePrint(scheduleName, filteredGroupedResults[scheduleName])}
                  sx={{ mr: 1 }}
                >
                  打印成绩
                </Button>
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<DownloadIcon />} 
                  onClick={() => handleExportExcel(scheduleName, filteredGroupedResults[scheduleName])}
                >
                  导出Excel
                </Button>
              </Box>
            </Box>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label={`${scheduleName}成绩表`}>
                <TableHead>
                  <TableRow>
                    <TableCell>奖项</TableCell>
                    <TableCell>参赛者</TableCell>
                    <TableCell>代表队/学校</TableCell>

                    <TableCell>最后得分</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredGroupedResults[scheduleName].map((result) => {
                    const statusInfo = getStatusInfo(result.status);

                    // 正确提取参赛者姓名和学校，如果是个人赛则取 participant.name，如果缺失则取 user.name
                    // 团队赛则取 teamName
                    let participantName = '未知参赛者';
                    if (result.participant) {
                      if (result.participant.isVirtualTeam && result.participant.teamMembers && result.participant.teamMembers.length > 0) {
                        participantName = result.participant.teamMembers.map(m => m.name).join('、');
                      } else if (result.participant.type === 'team' && result.participant.teamName) {
                        participantName = result.participant.teamName;
                      } else if (result.participant.name) {
                        participantName = result.participant.name;
                      } else if (result.participant.user && result.participant.user.name) {
                        participantName = result.participant.user.name;
                      }
                    }

                    const schoolName = result.participant?.schoolName || result.participant?.teamName || '-';

                    return (
                      <TableRow key={result._id}>
                        <TableCell><Chip label={result.details?.isAbsent ? '弃权' : (result.awardLevel || '—')} color={result.details?.isAbsent ? 'default' : 'success'} size="small" variant={result.details?.isAbsent ? 'outlined' : 'filled'} /></TableCell>
                        <TableCell>{participantName}</TableCell>
                        <TableCell>{schoolName}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: result.details?.isAbsent ? 'error.main' : 'primary.main', fontSize: '1.1rem' }}>
                          {result.details?.isAbsent ? '弃权' : (
                            result.finalScore !== undefined ? result.finalScore : (
                              typeof result.score === 'object' 
                                ? JSON.stringify(result.score) 
                                : (result.score?.toString() || '-')
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            icon={statusInfo.icon}
                            label={statusInfo.name} 
                            color={statusInfo.color} 
                            size="small" 
                          />
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
    );
  };

  // 渲染排名
  const renderRankings = () => {
    if (!filters.competitionId) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            请选择一个比赛查看排名
          </Typography>
        </Box>
      );
    }

    // 根据状态过滤结果
    const filteredGroupedResults = {};

    // 找出所有正在打分或已经有成绩的项目
    let activeSchedules = [];
    Object.keys(processedData.groupedResults).forEach(scheduleName => {
      const scheduleResults = processedData.groupedResults[scheduleName];
      const filteredResults = scheduleResults.filter(result => {
        if (filters.status && result.status !== filters.status) {
          return false;
        }
        // 核心修复点：只显示至少有一个裁判打过分的项目（score > 0）
        const scoreVal = typeof result.finalScore === 'number' ? result.finalScore : 
                         (typeof result.score === 'number' ? result.score : parseFloat(result.score) || 0);
        return scoreVal > 0;
      });

      const court = getCourtForSchedule(scheduleName);
      if (filteredResults.length > 0 && (selectedLocation === 'all' || court === selectedLocation)) {
        // 检查该项目是否“正在进行”（还有人的状态是 pending，或者还有人没打完分）
        // 在实际业务中，为了只显示“最新”的一个项目，我们可以找带有最近更新时间的项目，或者直接利用你的“本场结束”状态
        // 这里我们采用最符合“大屏”直觉的逻辑：只显示该场地最新有打分动作的那个唯一项目。
        activeSchedules.push({
          name: scheduleName,
          results: filteredResults,
          // 找这个项目里最新一条成绩的更新时间，用来排序
          latestUpdate: Math.max(...filteredResults.map(r => new Date(r.updatedAt || r.createdAt || 0).getTime()))
        });
      }
    });

    // 核心大屏逻辑：如果选择了特定场地（不是"全部场地"），则只显示该场地【最新正在打分】的那唯一一个项目
    if (selectedLocation !== 'all' && activeSchedules.length > 0) {
      // 按最后更新时间降序排列，取第一个（即最新动过分的项目）
      activeSchedules.sort((a, b) => b.latestUpdate - a.latestUpdate);
      const latestSchedule = activeSchedules[0];
      filteredGroupedResults[latestSchedule.name] = latestSchedule.results;
    } else {
      // 如果是“全部场地”，为了全局概览，依然显示所有有成绩的项目
      activeSchedules.forEach(item => {
        filteredGroupedResults[item.name] = item.results;
      });
    }

    // 核心修复：如果选择了某个场地，但该场地当前没有任何打完分的项目，
    // 我们不能直接返回“暂无数据”把整个页面连同 Tabs 一起隐藏掉。
    // 必须让 Tabs 保持可见，以便用户可以切回“全部场地”或其他场地。

    // 获取当前选中的比赛
    const selectedCompetition = competitions.find(c => c._id === filters.competitionId);

    return (
      <Box>
        <Typography variant="h5" gutterBottom sx={{ mb: 4, textAlign: 'center' }}>
          {selectedCompetition?.name || '比赛'} - 单项成绩公告
        </Typography>

        {availableCourts.length > 0 && (
          <Box sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={selectedLocation} 
              onChange={(e, v) => setSelectedLocation(v)}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab label="全部场地" value="all" sx={{ fontWeight: 'bold' }} />
              {availableCourts.map(court => (
                <Tab key={court} label={court} value={court} sx={{ fontWeight: 'bold' }} />
              ))}
            </Tabs>
          </Box>
        )}

        {Object.keys(filteredGroupedResults).length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              暂无符合条件的排名数据
            </Typography>
          </Box>
        ) : (
          Object.keys(filteredGroupedResults).map(scheduleName => {
            // 在单项成绩公告中过滤掉测试人员
            const scheduleResults = filteredGroupedResults[scheduleName].filter(r => !r.participant?.isTest);
            const court = getCourtForSchedule(scheduleName);
            const ruleSummary = getScheduleRuleSummary(selectedCompetition, scheduleName, scheduleResults);

            if (scheduleResults.length === 0) return null;

            return (
              <Box key={scheduleName} sx={{ mb: 6 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ borderLeft: '4px solid #1976d2', pl: 1, color: '#1976d2' }}>
                      {scheduleName}
                    </Typography>
                    {/* Display actual court name */}
                    {court && (
                      <Chip 
                        label={court} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                    )}
                    {ruleSummary && (
                      <Chip
                        label={`录取前${ruleSummary.admissionCount}名${ruleSummary.countsForTeam ? '，计团体总分' : '，不计团体总分'}`}
                        size="small"
                        color={ruleSummary.countsForTeam ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Box>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<PrintIcon />} 
                      onClick={() => handlePrint(scheduleName, scheduleResults)}
                      sx={{ mr: 1 }}
                    >
                      打印成绩
                    </Button>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<DownloadIcon />} 
                      onClick={() => handleExportExcel(scheduleName, scheduleResults)}
                    >
                      导出Excel
                    </Button>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  {scheduleResults.slice(0, 3).map((ranking, index) => {
                    let participantName = '未知参赛者';
                    if (ranking.participant) {
                      if (ranking.participant.isVirtualTeam && ranking.participant.teamMembers && ranking.participant.teamMembers.length > 0) {
                        participantName = ranking.participant.teamMembers.map(m => m.name).join('、');
                      } else if (ranking.participant.type === 'team' && ranking.participant.teamName) {
                        participantName = ranking.participant.teamName;
                      } else if (ranking.participant.name) {
                        participantName = ranking.participant.name;
                      } else if (ranking.participant.user && ranking.participant.user.name) {
                        participantName = ranking.participant.user.name;
                      }
                    }

                    const schoolName = ranking.participant?.schoolName || ranking.participant?.teamName || '';
                    return (
                      <Grid item xs={12} sm={4} key={ranking._id || index}>
                        <Card sx={{ 
                          height: '100%', 
                          bgcolor: index === 0 ? 'gold' : index === 1 ? 'silver' : '#cd7f32',
                          color: 'white'
                        }}>
                          <CardHeader
                            avatar={
                              <Avatar sx={{ bgcolor: 'white', color: 'text.primary' }}>
                                {index + 1}
                              </Avatar>
                            }
                            title={
                              <Typography variant="h6" sx={{ color: 'white' }}>
                                {participantName}
                              </Typography>
                            }
                            subheader={
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                                {schoolName}{ranking.isAwarded ? ' | 录取' : ' | 未录取'}
                              </Typography>
                            }
                          />
                          <CardContent>
                            <Typography variant="h4" align="center">
                              {ranking.details?.isAbsent ? '弃权' : (
                                (ranking.finalScore !== undefined ? ranking.finalScore : (
                                  typeof ranking.score === 'object' && ranking.score !== null
                                    ? JSON.stringify(ranking.score) 
                                    : (ranking.score?.toString() || '0')
                                )) + ' 分'
                              )}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                {scheduleResults.length > 3 && (
                  <TableContainer 
                    component={Paper} 
                    id="auto-scroll-container"
                    sx={{ mt: 3, maxHeight: 400, overflow: 'auto' }}
                    onMouseEnter={() => setAutoScroll(false)} // 鼠标移入暂停滚动
                    onMouseLeave={() => setAutoScroll(true)}  // 鼠标移出恢复滚动
                  >
                    <Table aria-label="排名表" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>排名</TableCell>
                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>参赛者</TableCell>
                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>代表队/学校</TableCell>
                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>是否录取</TableCell>
                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>最后得分</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {scheduleResults.slice(3).map((ranking, index) => {
                          let participantName = '未知参赛者';
                          if (ranking.participant) {
                            if (ranking.participant.isVirtualTeam && ranking.participant.teamMembers && ranking.participant.teamMembers.length > 0) {
                              participantName = ranking.participant.teamMembers.map(m => m.name).join('、');
                            } else if (ranking.participant.type === 'team' && ranking.participant.teamName) {
                              participantName = ranking.participant.teamName;
                            } else if (ranking.participant.name) {
                              participantName = ranking.participant.name;
                            } else if (ranking.participant.user && ranking.participant.user.name) {
                              participantName = ranking.participant.user.name;
                            }
                          }

                          const schoolName = ranking.participant?.schoolName || ranking.participant?.teamName || '-';
                          return (
                            <TableRow key={ranking._id || index + 3}>
                              <TableCell>{ranking.dynamicRank || index + 4}</TableCell>
                              <TableCell>{participantName}</TableCell>
                              <TableCell>{schoolName}</TableCell>
                              <TableCell>{ranking.isAwarded ? '录取' : '未录取'}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: ranking.details?.isAbsent ? 'error.main' : 'inherit' }}>
                                {ranking.details?.isAbsent ? '弃权' : (
                                  ranking.finalScore !== undefined ? ranking.finalScore : (
                                    typeof ranking.score === 'object' && ranking.score !== null
                                      ? JSON.stringify(ranking.score) 
                                      : (ranking.score?.toString() || '0')
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            );
          })
        )}
      </Box>
    );
  };

  const handleExportTeamExcel = () => {
    const { teamRankings } = processedData;
    const selectedCompetition = competitions.find(c => c._id === filters.competitionId);
    const compName = selectedCompetition?.name || '比赛';
    const teamAwardLimit = 8;

    const dataToExport = teamRankings.map((team, index) => ({
      '名次': index + 1,
      '单位': team.schoolName,
      '总分': team.totalPoints
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "团体总分榜");
    XLSX.writeFile(workbook, `${compName} - 团体总分榜.xlsx`);
  };

  const handlePrintTeam = () => {
    setTeamPrintModalOpen(true);
  };

  // 渲染团体分排名
  const renderTeamRankings = () => {
    if (!filters.competitionId) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            请选择一个比赛查看团体分排名
          </Typography>
        </Box>
      );
    }

    const { teamRankings } = processedData;

    if (!teamRankings || teamRankings.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            暂无团体分数据
          </Typography>
        </Box>
      );
    }

    const selectedCompetition = competitions.find(c => c._id === filters.competitionId);

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h5" sx={{ flexGrow: 1, textAlign: 'center' }}>
            {selectedCompetition?.name || '比赛'} - 团体总分榜
          </Typography>
          <Box>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<PrintIcon />} 
              onClick={handlePrintTeam}
              sx={{ mr: 1 }}
            >
              打印团体分
            </Button>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<DownloadIcon />} 
              onClick={handleExportTeamExcel}
            >
              导出Excel
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper} id="team-rankings-print-area">
          <Table sx={{ minWidth: 650 }} aria-label="团体总分表">
            <TableHead>
              <TableRow>
                <TableCell>名次</TableCell>
                <TableCell>代表队/学校</TableCell>
                <TableCell>团体总分</TableCell>
                <TableCell>得分详情</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teamRankings.map((team, index) => (
                <TableRow key={team.schoolName}>
                  <TableCell>
                    {index === 0 && <Chip label="1" sx={{ bgcolor: 'gold', color: 'white', fontWeight: 'bold' }} size="small" />}
                    {index === 1 && <Chip label="2" sx={{ bgcolor: 'silver', color: 'white', fontWeight: 'bold' }} size="small" />}
                    {index === 2 && <Chip label="3" sx={{ bgcolor: '#cd7f32', color: 'white', fontWeight: 'bold' }} size="small" />}
                    {index > 2 && <Typography sx={{ fontWeight: 'bold', ml: 1 }}>{index + 1}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{team.schoolName}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.2rem' }}>
                    {team.totalPoints} 分
                  </TableCell>
                  <TableCell className="details">
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {team.details.map((d, i) => {
                        // 精简得分详情名称，只取第一个前缀，比如 U16组 男子 自选太极拳 -> U16组
                        const shortName = d.scheduleName.split(' ')[0] || d.scheduleName;
                        return (
                          <Tooltip 
                            key={i} 
                            title={`${d.scheduleName} - ${d.participantName} - 第${d.rank}名`}
                          >
                            <Chip 
                              label={`${shortName}: +${d.points}`} 
                              size="small" 
                              variant="outlined"
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  if (!user?.roles?.includes('admin') && !user?.roles?.includes('spectator')) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary">
          抱歉，只有管理员和观赛者有权限查看比赛成绩模块。
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
          比赛成绩
        </Typography>
        {filters.competitionId && !isSpectatorOnly && (
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<PrintIcon />}
            onClick={() => setPrintAllModalOpen(true)}
          >
            生成总成绩册
          </Button>
        )}
        {filters.competitionId && (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PresentToAllIcon />}
            onClick={() => navigate(`/competitions/${filters.competitionId}/live-scoreboard`)}
          >
            大屏即时成绩
          </Button>
        )}
      </Box>

      {/* 搜索和过滤 */}
      <Box sx={{ mb: 4 }}>
        <form onSubmit={handleSearch}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                placeholder="搜索成绩..."
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

            <Grid item xs={12} md={5}>
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
                  <MenuItem value="">所有比赛</MenuItem>
                  {competitions.map(competition => (
                    <MenuItem key={competition._id} value={competition._id}>
                      {competition.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <Tooltip title="显示更多过滤选项">
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  过滤
                </Button>
              </Tooltip>
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
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel id="status-label">成绩状态</InputLabel>
                  <Select
                    labelId="status-label"
                    id="status"
                    name="status"
                    value={filters.status}
                    label="成绩状态"
                    onChange={handleFilterChange}
                  >
                    <MenuItem value="">所有状态</MenuItem>
                    {(resultStatuses && resultStatuses.length > 0 ? resultStatuses : defaultStatuses).map(status => (
                      <MenuItem key={status.value || status.id} value={status.value || status.id}>{status.label || status.name}</MenuItem>
                    ))}
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

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 加载中 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* 视图切换标签 */}
          {!isSpectatorOnly && (
            <Paper sx={{ mb: 3 }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab label="成绩列表" />
                <Tab 
                  label="项目排名" 
                  icon={<EmojiEventsIcon />} 
                  iconPosition="start"
                />
                <Tab 
                  label="团体总分" 
                  icon={<FlagIcon />} 
                  iconPosition="start"
                />
              </Tabs>
            </Paper>
          )}

          {/* 成绩和排名 */}
          {!isSpectatorOnly && (
            <TabPanel value={tabValue} index={0}>
              {renderResults()}
            </TabPanel>
          )}

          <TabPanel value={tabValue} index={1}>
            {renderRankings()}
          </TabPanel>

          {!isSpectatorOnly && (
            <TabPanel value={tabValue} index={2}>
              {renderTeamRankings()}
            </TabPanel>
          )}
        </>
      )}

      {/* 编辑模态框 */}
      <EditResultModal
        open={isModalOpen}
        onClose={handleCloseModal}
        result={editingResult}
        onResultUpdated={handleResultUpdated}
      />

      {/* 打印预览模态框 */}
      <PrintPreviewModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        schedule={printScheduleData}
        participants={printParticipantsData}
        results={printResultsData}
        user={user}
      />

      {/* 团体总分打印预览模态框 */}
      {teamPrintModalOpen && (() => {
        const compName = competitions.find(c => c._id === filters.competitionId)?.name || '比赛';
        // 如果名字太长，我们可以把" - 团体总分榜"放在下一行。去除多余的" - 成绩公告"
        const printTitle = compName.length > 20 
          ? `${compName}\n团体总分榜` 
          : `${compName} - 团体总分榜`;

        return (
          <PrintPreviewModal
            open={teamPrintModalOpen}
            onClose={() => setTeamPrintModalOpen(false)}
            schedule={{
              name: printTitle,
              startTime: competitions.find(c => c._id === filters.competitionId)?.startDate || new Date(),
              location: competitions.find(c => c._id === filters.competitionId)?.location || ''
            }}
            // 打印时截取前8名
            participants={processedData.teamRankings.slice(0, 8).map((t, idx) => ({
            _id: `team_${idx}`,
            __printKey: `team_${idx}`,
            name: t.schoolName, // 强制将名字设置为学校名，复用单项打印逻辑
            schoolName: ''
          }))}
          results={processedData.teamRankings.slice(0, 8).reduce((acc, t, idx) => {
            acc[`team_${idx}`] = {
              _id: `team_result_${idx}`,
              participant: { _id: `team_${idx}` },
              finalScore: t.totalPoints,
              dynamicRank: idx + 1,
              isAwarded: true
            };
            return acc;
          }, {})}
          user={user}
          isTeamRanking={true}
        />
        );
      })()}

      {/* 打印总成绩册模态框 */}
      {printAllModalOpen && (
        <PrintAllResultsModal
          open={printAllModalOpen}
          onClose={() => setPrintAllModalOpen(false)}
          groupedResults={processedData.groupedResults}
          competition={competitions.find(c => c._id === filters.competitionId)}
          teamRankings={processedData.teamRankings}
        />
      )}
    </Box>
  );
};

export default ResultsPage;
