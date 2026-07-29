import React, { memo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  OutlinedInput,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
  Button
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const EventItem = memo(({ event, index, ageGroupOptions, onRemove, onChange }) => {
  // Helper to handle change and call parent onChange
  const handleChange = (field, value) => {
    onChange(index, field, value);
  };

  const handleSubEventChange = (subIndex, value) => {
    const newSubEvents = [...(event.subEvents || [])];
    newSubEvents[subIndex] = value;
    handleChange('subEvents', newSubEvents);
  };

  const addSubEvent = () => {
    handleChange('subEvents', [...(event.subEvents || []), '']);
  };

  const removeSubEvent = (subIndex) => {
    const newSubEvents = (event.subEvents || []).filter((_, i) => i !== subIndex);
    handleChange('subEvents', newSubEvents);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">项目 {index + 1} ({event.name || '未命名'})</Typography>
          <IconButton onClick={() => onRemove(index)} color="error">
            <DeleteIcon />
          </IconButton>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="项目名称"
              value={event.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id={`age-group-label-${index}`}>适用年龄组</InputLabel>
              <Select
                labelId={`age-group-label-${index}`}
                multiple
                value={Array.isArray(event.ageGroups) ? event.ageGroups : (typeof event.ageGroups === 'string' && event.ageGroups ? event.ageGroups.split(/[,，]/).map(s => s.trim()) : [])}
                onChange={(e) => handleChange('ageGroups', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                input={<OutlinedInput label="适用年龄组" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {ageGroupOptions && ageGroupOptions.length > 0 ? (
                  ageGroupOptions.map((group) => (
                    <MenuItem key={group.name} value={group.name}>
                      {group.name} {group.description ? `(${group.description})` : ''}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled value="">
                    <em>请先在上方“年龄组别配置”中添加组别</em>
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>性别限制</InputLabel>
              <Select
                value={event.genderRestriction || 'both'}
                label="性别限制"
                onChange={(e) => handleChange('genderRestriction', e.target.value)}
              >
                <MenuItem value="both">不限制</MenuItem>
                <MenuItem value="male">仅限男性</MenuItem>
                <MenuItem value="female">仅限女性</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="最大参赛人数 (0为不限制)"
              value={event.maxParticipants || 0}
              onChange={(e) => handleChange('maxParticipants', e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={event.isGroupEvent || false}
                  onChange={(e) => handleChange('isGroupEvent', e.target.checked)}
                  color="primary"
                />
              }
              label="这是一个集体项目 (以团队/单位为单位打分)"
            />
          </Grid>
          
          {event.isGroupEvent && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="集体项目人数要求"
                value={event.groupSize || 0}
                onChange={(e) => handleChange('groupSize', e.target.value)}
                helperText="填0表示不限制具体人数"
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={event.isCombinedEvent || false}
                  onChange={(e) => {
                    handleChange('isCombinedEvent', e.target.checked);
                    if (e.target.checked && (!event.subEvents || event.subEvents.length === 0)) {
                      handleChange('subEvents', ['', '']);
                    }
                  }}
                  color="primary"
                />
              }
              label="这是一个合并项目（包含多个需要独立打分的子项目）"
            />
            {event.isCombinedEvent && (
              <Alert severity="info" sx={{ mt: 1 }}>
                合并项目允许选手一次性报名，但在比赛时会分成多个子项目分别进行打分。最终成绩会将这些子项目的得分相加。
              </Alert>
            )}
          </Grid>

          {event.isCombinedEvent && (
            <Grid item xs={12}>
              <Box sx={{ pl: 4, borderLeft: '2px solid #1976d2', mt: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  子项目配置
                </Typography>
                {(event.subEvents || []).map((subEvent, subIndex) => (
                  <Box key={subIndex} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      label={`子项目 ${subIndex + 1} 名称 (如: 刀术)`}
                      value={subEvent}
                      onChange={(e) => handleSubEventChange(subIndex, e.target.value)}
                      required
                    />
                    <IconButton 
                      color="error" 
                      onClick={() => removeSubEvent(subIndex)}
                      disabled={(event.subEvents || []).length <= 2}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button 
                  startIcon={<AddIcon />} 
                  onClick={addSubEvent}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  添加子项目
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to ensure strict equality check works for performance
  // We only re-render if event object itself changed or options changed
  return (
    prevProps.event === nextProps.event &&
    prevProps.index === nextProps.index &&
    prevProps.ageGroupOptions === nextProps.ageGroupOptions
  );
});

export default EventItem;