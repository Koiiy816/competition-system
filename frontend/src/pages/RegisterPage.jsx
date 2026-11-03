import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  FormHelperText,
  Alert,
  Button,
  Grid,
  Link,
  CircularProgress,
} from '@mui/material';
import { PARTICIPATION_SPORT_TYPES, SPORT_TYPES } from '../utils/competitionType';

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: '',
    contactPerson: '',
    phone: '',
  });
  const [availableRoles, setAvailableRoles] = useState([
    { value: 'organization', label: '参赛单位' }
  ]);
  const [selectedRoles, setSelectedRoles] = useState(['organization']);
  const linkedSportType = new URLSearchParams(location.search).get('sportType');
  const isLinkedSportType = [SPORT_TYPES.WUSHU, SPORT_TYPES.DIVING, SPORT_TYPES.TRAMPOLINE].includes(linkedSportType);
  const [sportTypes, setSportTypes] = useState(() => isLinkedSportType ? [linkedSportType] : []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { name, email, password, password2, contactPerson, phone } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRoleChange = (e) => {
    const { value, checked } = e.target;
    setSelectedRoles((prev) =>
      checked ? [...prev, value] : prev.filter((role) => role !== value)
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== password2) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (selectedRoles.includes('organization') && sportTypes.length === 0) {
      toast.error('请至少选择一种可参与赛事类型');
      return;
    }
    setLoading(true);
    try {
      const isOrganization = selectedRoles.includes('organization');
      const userData = {
        name,
        email,
        password,
        roles: selectedRoles,
        sportTypes: isOrganization ? sportTypes : [],
        profile: isOrganization ? {
          organization: name,
          phone: phone
        } : {}
      };

      await register(userData);
      toast.success('注册成功！');
      navigate('/');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ padding: 4, marginTop: 8 }}>
        <Typography component="h1" variant="h5" align="center">
          注册
        </Typography>
        <Box component="form" onSubmit={onSubmit} sx={{ mt: 3 }}>
          <TextField
            label={selectedRoles.includes('organization') ? "单位名称" : "用户名"}
            fullWidth
            margin="normal"
            name="name"
            value={name}
            onChange={onChange}
            required
          />
          {selectedRoles.includes('organization') && (
            <FormControl component="fieldset" margin="normal" required>
              <FormLabel component="legend">可参与赛事类型</FormLabel>
              <FormGroup row>
                {PARTICIPATION_SPORT_TYPES.map((sport) => (
                  <FormControlLabel
                    key={sport.value}
                    control={<Checkbox
                      checked={sportTypes.includes(sport.value)}
                      onChange={(event) => setSportTypes((current) => event.target.checked
                        ? [...current, sport.value]
                        : current.filter((type) => type !== sport.value))}
                      disabled={sport.disabled || isLinkedSportType}
                    />}
                    label={sport.label}
                  />
                ))}
              </FormGroup>
              <FormHelperText>{isLinkedSportType ? '您正从赛事报名入口注册，系统已自动分配对应赛事类型。以后可在单位资料中调整。' : '系统将只展示所选类型的赛事；以后可在单位资料中调整。'}</FormHelperText>
            </FormControl>
          )}
          {selectedRoles.includes('organization') && (
            <>
              <TextField
                label="联系电话"
                fullWidth
                margin="normal"
                name="phone"
                value={phone}
                onChange={onChange}
                required
              />
            </>
          )}
          <TextField
            label="邮箱"
            fullWidth
            margin="normal"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
          <TextField
            label="密码"
            type="password"
            fullWidth
            margin="normal"
            name="password"
            value={password}
            onChange={onChange}
            required
          />
          <TextField
            label="确认密码"
            type="password"
            fullWidth
            margin="normal"
            name="password2"
            value={password2}
            onChange={onChange}
            required
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button 
            type="submit" 
            fullWidth 
            variant="contained" 
            sx={{ mt: 3, mb: 2 }} 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : '注册'}
          </Button>
          <Grid container justifyContent="flex-end">
            <Grid item>
              <Link component={RouterLink} to="/auth/login" variant="body2">
                已有账户？登录
              </Link>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default RegisterPage;
