import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import LoginIcon from '@mui/icons-material/Login';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../css/auth.css';

function EmailVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || localStorage.getItem('pendingEmail') || '';

  return (
    <Box className="auth-page auth-page--x">
      <Paper component="section" className="auth-card auth-card--single auth-verify-card">
        <Stack spacing={2.4} alignItems="flex-start">
          <Box className="auth-brand">
            <Box className="auth-brand__mark auth-brand__mark--dark">L</Box>
            <Typography variant="h5" className="auth-brand__name">
              Live-Log
            </Typography>
          </Box>

          <Box className="auth-verify-icon">
            <MarkEmailUnreadIcon fontSize="large" />
          </Box>

          <Box>
            <Typography component="h1" variant="h4" className="auth-brand__name">
              이메일 인증이 필요합니다
            </Typography>
            <Typography color="text.secondary" className="auth-form__subtitle">
              {email ? `${email} 주소로 보낸 인증 링크를 확인해주세요.` : '이메일 인증을 완료한 뒤 다시 로그인해주세요.'}
            </Typography>
          </Box>

          <Typography color="text.secondary" className="auth-verify-description">
            이메일 인증이 완료된 후 서비스를 이용하실 수 있습니다.
          </Typography>

          <Button
            className="auth-submit auth-submit--x"
            fullWidth
            onClick={() => navigate('/')}
            startIcon={<LoginIcon />}
            variant="contained"
          >
            로그인 화면으로 돌아가기
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default EmailVerify;