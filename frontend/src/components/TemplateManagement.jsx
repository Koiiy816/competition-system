import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import templateService from '../services/templateService';

const TemplateManagement = ({ competitionId }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: '',
    description: '',
    file: null
  });

  // 获取模板列表
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await templateService.getTemplates(competitionId);
      setTemplates(response.data);
    } catch (error) {
      console.error('获取模板列表失败:', error);
      setError('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (competitionId) {
      fetchTemplates();
    }
  }, [competitionId]);

  // 处理文件选择
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadData(prev => ({
        ...prev,
        file,
        name: prev.name || file.name.replace(/\.[^/.]+$/, '') // 如果没有名称，使用文件名（去掉扩展名）
      }));
    }
  };

  // 处理上传表单数据变化
  const handleUploadDataChange = (field, value) => {
    setUploadData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 上传模板
  const handleUpload = async () => {
    if (!uploadData.file || !uploadData.name.trim()) {
      setError('请选择文件并填写模板名称');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('name', uploadData.name.trim());
      if (uploadData.description.trim()) {
        formData.append('description', uploadData.description.trim());
      }

      await templateService.uploadTemplate(competitionId, formData);
      
      setSuccessMessage('模板上传成功');
      setUploadDialogOpen(false);
      setUploadData({ name: '', description: '', file: null });
      fetchTemplates(); // 重新获取模板列表
    } catch (error) {
      console.error('上传模板失败:', error);
      setError(error.response?.data?.message || '上传模板失败');
    } finally {
      setUploading(false);
    }
  };

  // 下载模板
  const handleDownload = async (templateId, templateName) => {
    try {
      const response = await templateService.downloadTemplate(competitionId, templateId);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', templateName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      setError('下载模板失败');
    }
  };

  // 删除模板
  const handleDelete = async () => {
    if (!selectedTemplate) return;

    try {
      await templateService.deleteTemplate(competitionId, selectedTemplate._id);
      setSuccessMessage('模板删除成功');
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
      fetchTemplates(); // 重新获取模板列表
    } catch (error) {
      console.error('删除模板失败:', error);
      setError('删除模板失败');
    }
  };

  // 打开删除确认对话框
  const openDeleteDialog = (template) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  // 关闭上传对话框
  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    setUploadData({ name: '', description: '', file: null });
    setError('');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          模板管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          上传模板
        </Button>
      </Box>

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

      {/* 模板列表 */}
      {templates.length > 0 ? (
        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid item xs={12} md={6} key={template._id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" component="div">
                      {template.name}
                    </Typography>
                  </Box>
                  
                  {template.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {template.description}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={`文件大小: ${(template.fileSize / 1024).toFixed(1)} KB`} 
                      size="small" 
                      variant="outlined" 
                    />
                    <Chip 
                      label={`上传时间: ${new Date(template.createdAt).toLocaleDateString()}`} 
                      size="small" 
                      variant="outlined" 
                    />
                  </Box>
                </CardContent>
                
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownload(template._id, template.originalName)}
                  >
                    下载
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => openDeleteDialog(template)}
                  >
                    删除
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            暂无上传的模板
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            点击"上传模板"按钮添加报名表模板
          </Typography>
        </Box>
      )}

      {/* 上传模板对话框 */}
      <Dialog open={uploadDialogOpen} onClose={closeUploadDialog} maxWidth="sm" fullWidth>
        <DialogTitle>上传模板</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="模板名称"
              value={uploadData.name}
              onChange={(e) => handleUploadDataChange('name', e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            
            <TextField
              fullWidth
              label="模板描述"
              value={uploadData.description}
              onChange={(e) => handleUploadDataChange('description', e.target.value)}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />
            
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              fullWidth
              sx={{ mb: 2 }}
            >
              选择文件
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
              />
            </Button>
            
            {uploadData.file && (
              <Typography variant="body2" color="text.secondary">
                已选择文件: {uploadData.file.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUploadDialog} disabled={uploading}>
            取消
          </Button>
          <Button onClick={handleUpload} variant="contained" disabled={uploading}>
            {uploading ? <CircularProgress size={24} /> : '上传'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除模板 "{selectedTemplate?.name}" 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDelete} color="error">删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TemplateManagement;