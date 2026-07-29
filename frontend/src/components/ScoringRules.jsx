import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  Group as TeamIcon,
  Person as IndividualIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Calculate as CalculateIcon,
  Rule as RuleIcon
} from '@mui/icons-material';

// 评分规则类型
const SCORING_RULE_TYPES = {
  TRADITIONAL_EXCLUSION: {
    key: 'traditionalExclusion',
    label: '传统项目排除规则',
    description: '传统项目成绩不计入团体总分',
    icon: <RuleIcon />
  },
  TEAM_SCORING: {
    key: 'teamScoring',
    label: '团体计分规则',
    description: '设置团体项目的计分方式',
    icon: <TeamIcon />
  },
  INDIVIDUAL_SCORING: {
    key: 'individualScoring',
    label: '个人计分规则',
    description: '设置个人项目的计分方式',
    icon: <IndividualIcon />
  },
  RANKING_POINTS: {
    key: 'rankingPoints',
    label: '名次积分规则',
    description: '根据名次分配积分',
    icon: <TrophyIcon />
  }
};

// 默认积分规则
const DEFAULT_RANKING_POINTS = {
  1: 9,  // 第一名
  2: 7,  // 第二名
  3: 5,  // 第三名
  4: 3,  // 第四名
  5: 2,  // 第五名
  6: 1   // 第六名
};

const ScoringRules = ({ 
  competition, 
  onRulesChange,
  readonly = false 
}) => {
  const [rules, setRules] = useState({
    traditionalExclusion: true,
    teamScoring: {
      enabled: true,
      method: 'sum', // sum, average, best
      maxParticipants: null
    },
    individualScoring: {
      enabled: true,
      method: 'direct', // direct, weighted
      categoryWeights: {}
    },
    rankingPoints: DEFAULT_RANKING_POINTS,
    customRules: []
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [previewResults, setPreviewResults] = useState(null);

  // 初始化规则
  useEffect(() => {
    if (competition?.scoringRules) {
      setRules(prev => ({
        ...prev,
        ...competition.scoringRules
      }));
    }
  }, [competition]);

  // 更新规则
  const updateRules = (newRules) => {
    setRules(newRules);
    if (onRulesChange) {
      onRulesChange(newRules);
    }
  };

  // 处理传统项目排除规则变更
  const handleTraditionalExclusionChange = (enabled) => {
    updateRules({
      ...rules,
      traditionalExclusion: enabled
    });
  };

  // 处理团体计分规则变更
  const handleTeamScoringChange = (field, value) => {
    updateRules({
      ...rules,
      teamScoring: {
        ...rules.teamScoring,
        [field]: value
      }
    });
  };

  // 处理个人计分规则变更
  const handleIndividualScoringChange = (field, value) => {
    updateRules({
      ...rules,
      individualScoring: {
        ...rules.individualScoring,
        [field]: value
      }
    });
  };

  // 处理积分规则变更
  const handleRankingPointsChange = (rank, points) => {
    updateRules({
      ...rules,
      rankingPoints: {
        ...rules.rankingPoints,
        [rank]: parseInt(points) || 0
      }
    });
  };

  // 添加自定义规则
  const addCustomRule = () => {
    setEditingRule({
      id: Date.now(),
      name: '',
      description: '',
      condition: '',
      action: '',
      enabled: true
    });
    setEditDialogOpen(true);
  };

  // 编辑自定义规则
  const editCustomRule = (rule) => {
    setEditingRule(rule);
    setEditDialogOpen(true);
  };

  // 保存自定义规则
  const saveCustomRule = () => {
    if (!editingRule.name || !editingRule.condition) {
      return;
    }

    const existingIndex = rules.customRules.findIndex(r => r.id === editingRule.id);
    let newCustomRules;

    if (existingIndex >= 0) {
      newCustomRules = [...rules.customRules];
      newCustomRules[existingIndex] = editingRule;
    } else {
      newCustomRules = [...rules.customRules, editingRule];
    }

    updateRules({
      ...rules,
      customRules: newCustomRules
    });

    setEditDialogOpen(false);
    setEditingRule(null);
  };

  // 删除自定义规则
  const deleteCustomRule = (ruleId) => {
    updateRules({
      ...rules,
      customRules: rules.customRules.filter(r => r.id !== ruleId)
    });
  };

  // 计算预览结果
  const calculatePreview = () => {
    // 这里应该根据当前规则计算示例结果
    const mockResults = {
      teamScores: [
        { school: '示例学校A', totalScore: 45, traditionalScore: 12, regularScore: 33 },
        { school: '示例学校B', totalScore: 38, traditionalScore: 8, regularScore: 30 },
        { school: '示例学校C', totalScore: 42, traditionalScore: 15, regularScore: 27 }
      ],
      affectedEvents: rules.traditionalExclusion ? ['传统长拳', '传统剑术', '传统刀术'] : []
    };
    
    setPreviewResults(mockResults);
  };

  return (
    <Box>
      {/* 规则概览 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            评分规则配置
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            配置武术比赛的特殊评分规则和计分方式
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6} md={3}>
              <Chip
                label={rules.traditionalExclusion ? '传统项目已排除' : '传统项目计入'}
                color={rules.traditionalExclusion ? 'warning' : 'default'}
                size="small"
                icon={<RuleIcon />}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <Chip
                label={`团体计分: ${rules.teamScoring.method}`}
                color="primary"
                size="small"
                icon={<TeamIcon />}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <Chip
                label={`个人计分: ${rules.individualScoring.method}`}
                color="secondary"
                size="small"
                icon={<IndividualIcon />}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <Chip
                label={`自定义规则: ${rules.customRules.length}`}
                color="info"
                size="small"
                icon={<SettingsIcon />}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 传统项目排除规则 */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <RuleIcon />
            <Typography variant="h6">传统项目排除规则</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={rules.traditionalExclusion}
                    onChange={(e) => handleTraditionalExclusionChange(e.target.checked)}
                    disabled={readonly}
                  />
                }
                label="传统项目成绩不计入团体总分"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                启用此规则后，传统武术项目（如传统长拳、传统器械等）的成绩将不会计入学校团体总分
              </Typography>
            </Grid>
            
            {rules.traditionalExclusion && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    传统项目排除规则已启用。以下项目类型将不计入团体总分：
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="传统长拳类" secondary="传统长拳、查拳、华拳等" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="传统器械类" secondary="传统剑术、传统刀术、传统枪术等" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="传统拳术类" secondary="形意拳、八卦掌、太极拳等" />
                    </ListItem>
                  </List>
                </Alert>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 团体计分规则 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <TeamIcon />
            <Typography variant="h6">团体计分规则</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>计分方式</InputLabel>
                <Select
                  value={rules.teamScoring.method}
                  onChange={(e) => handleTeamScoringChange('method', e.target.value)}
                  disabled={readonly}
                >
                  <MenuItem value="sum">总分累加</MenuItem>
                  <MenuItem value="average">平均分</MenuItem>
                  <MenuItem value="best">最佳成绩</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="最大计分人数"
                type="number"
                value={rules.teamScoring.maxParticipants || ''}
                onChange={(e) => handleTeamScoringChange('maxParticipants', e.target.value)}
                disabled={readonly}
                helperText="限制每个学校最多几人的成绩计入团体总分"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={rules.teamScoring.enabled}
                    onChange={(e) => handleTeamScoringChange('enabled', e.target.checked)}
                    disabled={readonly}
                  />
                }
                label="启用团体计分"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 积分规则 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <TrophyIcon />
            <Typography variant="h6">名次积分规则</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>名次</TableCell>
                  <TableCell>积分</TableCell>
                  <TableCell>说明</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(rules.rankingPoints).map(([rank, points]) => (
                  <TableRow key={rank}>
                    <TableCell>第 {rank} 名</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={points}
                        onChange={(e) => handleRankingPointsChange(rank, e.target.value)}
                        disabled={readonly}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {rank === '1' && '冠军积分'}
                        {rank === '2' && '亚军积分'}
                        {rank === '3' && '季军积分'}
                        {parseInt(rank) > 3 && `第${rank}名积分`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* 自定义规则 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <SettingsIcon />
            <Typography variant="h6">自定义规则</Typography>
            <Chip label={rules.customRules.length} size="small" />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            {!readonly && (
              <Button
                startIcon={<AddIcon />}
                onClick={addCustomRule}
                sx={{ mb: 2 }}
              >
                添加自定义规则
              </Button>
            )}
            
            {rules.customRules.length > 0 ? (
              <List>
                {rules.customRules.map((rule) => (
                  <ListItem
                    key={rule.id}
                    secondaryAction={
                      !readonly && (
                        <Box>
                          <IconButton onClick={() => editCustomRule(rule)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => deleteCustomRule(rule.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      )
                    }
                  >
                    <ListItemIcon>
                      <RuleIcon color={rule.enabled ? 'primary' : 'disabled'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={rule.name}
                      secondary={rule.description}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                暂无自定义规则
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 预览计算 */}
      {!readonly && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">规则预览</Typography>
              <Button
                startIcon={<CalculateIcon />}
                onClick={calculatePreview}
                variant="outlined"
              >
                计算预览
              </Button>
            </Box>
            
            {previewResults && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  团体成绩预览（基于当前规则）
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>学校</TableCell>
                        <TableCell align="right">总分</TableCell>
                        <TableCell align="right">常规项目</TableCell>
                        <TableCell align="right">传统项目</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewResults.teamScores.map((team, index) => (
                        <TableRow key={index}>
                          <TableCell>{team.school}</TableCell>
                          <TableCell align="right">{team.totalScore}</TableCell>
                          <TableCell align="right">{team.regularScore}</TableCell>
                          <TableCell align="right">
                            {rules.traditionalExclusion ? (
                              <Typography variant="body2" color="text.secondary">
                                {team.traditionalScore} (不计入)
                              </Typography>
                            ) : (
                              team.traditionalScore
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* 自定义规则编辑对话框 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRule?.id ? '编辑自定义规则' : '添加自定义规则'}
        </DialogTitle>
        <DialogContent>
          {editingRule && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="规则名称"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({...editingRule, name: e.target.value})}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="规则描述"
                  multiline
                  rows={2}
                  value={editingRule.description}
                  onChange={(e) => setEditingRule({...editingRule, description: e.target.value})}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="触发条件"
                  multiline
                  rows={3}
                  value={editingRule.condition}
                  onChange={(e) => setEditingRule({...editingRule, condition: e.target.value})}
                  helperText="描述规则的触发条件，如：项目类型为'传统'且名次为前三名"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="执行动作"
                  multiline
                  rows={3}
                  value={editingRule.action}
                  onChange={(e) => setEditingRule({...editingRule, action: e.target.value})}
                  helperText="描述规则执行的动作，如：积分乘以1.5倍"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingRule.enabled}
                      onChange={(e) => setEditingRule({...editingRule, enabled: e.target.checked})}
                    />
                  }
                  label="启用此规则"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
          <Button onClick={saveCustomRule} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScoringRules;