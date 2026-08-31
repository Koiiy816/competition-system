import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// 上下文
import { AuthProvider } from './contexts/AuthContext.jsx';

// 组件
import ProtectedRoute from './components/ProtectedRoute';

// 布局
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// 页面
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CompetitionsPage from './pages/CompetitionsPage';
import CompetitionDetailsPage from './pages/CompetitionDetailsPage';
import RegisterCompetitionPage from './pages/RegisterCompetitionPage';
import ParticipantRegisterPage from './pages/ParticipantRegisterPage';
import ParticipantsPage from './pages/ParticipantsPage';
import SchedulePage from './pages/SchedulePage';
import CompetitionScheduleManagementPage from './pages/CompetitionScheduleManagementPage';
import CompetitionScheduleDetailPage from './pages/CompetitionScheduleDetailPage';
import CompetitionScorePage from './pages/CompetitionScorePage';
import CompetitionScoreEntryPage from './pages/CompetitionScoreEntryPage';
import CheckInPage from './pages/CheckInPage';
import CompetitionCheckInPage from './pages/CompetitionCheckInPage';
import CompetitionCheckInEntryPage from './pages/CompetitionCheckInEntryPage';
import ResultsPage from './pages/ResultsPage';
import LiveScoreboardPage from './pages/LiveScoreboardPage';
import AwardManagementPage from './pages/AwardManagementPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import AdminPage from './pages/AdminPage';
import TestPage from './pages/TestPage';
import DivingActionPlanPage from './pages/DivingActionPlanPage';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
      <AuthProvider>
        <Routes>
          {/* 公共路由 */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="competitions/:id" element={<CompetitionDetailsPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="unauthorized" element={<UnauthorizedPage />} />
            <Route path="test" element={<TestPage />} />
          </Route>

          <Route path="/competitions/:id/live-scoreboard" element={<LiveScoreboardPage />} />

          {/* 认证相关路由 */}
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* 受保护的路由 */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          
          {/* 报名比赛路由 */}
          <Route path="/competitions/:id/register" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<RegisterCompetitionPage />} />
          </Route>

          {/* 参赛者报名页面（含上传报名表） */}
          <Route path="/competitions/:competitionId/participant/register" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<ParticipantRegisterPage />} />
          </Route>

          {/* 赛程编排页面 */}
          <Route path="/competitions/:id/start-list" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompetitionScheduleManagementPage />} />
          </Route>
          
          <Route path="/competitions/:id/schedule/:scheduleId" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompetitionScheduleDetailPage />} />
          </Route>

          {/* 比赛打分页面 */}
          <Route path="/competitions/:id/score" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee', 'referee']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompetitionScorePage />} />
          </Route>

          <Route path="/competitions/:id/score/:scheduleId" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee', 'referee']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompetitionScoreEntryPage />} />
          </Route>

          <Route path="/checkin" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee', 'checkin_clerk']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CheckInPage />} />
          </Route>

          <Route path="/competitions/:id/check-in" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee', 'checkin_clerk']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompetitionCheckInPage />} />
          </Route>

          <Route path="/competitions/:id/check-in/:scheduleId" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee', 'checkin_clerk']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompetitionCheckInEntryPage />} />
          </Route>

          <Route path="/competitions/:id/awards" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AwardManagementPage />} />
          </Route>

          {/* 我的报名 (参赛单位) */}
          <Route path="/my-registrations" element={
            <ProtectedRoute allowedRoles={['organization', 'admin', 'chief_referee']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<ParticipantsPage myRegistrations={true} />} />
          </Route>

          <Route path="/diving-action-plans" element={
            <ProtectedRoute allowedRoles={['organization', 'admin', 'chief_referee']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DivingActionPlanPage />} />
          </Route>

          {/* 受保护路由 - 需要特定角色 */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin', 'chief_referee']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminPage />} />
            <Route path="participants" element={<ParticipantsPage />} />
            <Route path="competitions/create" element={<CompetitionDetailsPage isCreate />} />
            <Route path="competitions/edit/:id" element={<CompetitionDetailsPage isEdit />} />
          </Route>

          {/* 404路由 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
