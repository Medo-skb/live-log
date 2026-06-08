import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { googleLogin, loginUser } from '../../api/authApi';
import { authRules, sanitizePassword, sanitizeUsername, validatePassword, validateUsername } from '../../utils/authValidation';
import { consumeSessionExpired, saveAuthSession } from '../../utils/authStorage';
import '../../css/auth.css';

const copy = {
  title: '로그인하기',
  subtitle: '구글 계정으로 계속 진행하세요.',
  heroTitle: '지금 보고 있는 순간을 기록하세요.',
  heroBody: '스포일러 걱정은 끄고, 지금의 감동만 실시간으로 공유하세요.',
  username: '아이디',
  password: '비밀번호',
  showPassword: '비밀번호 표시 전환',
  submit: '로그인',
  submitting: '로그인 중...',
  googleMissing: 'Google Client ID가 설정되지 않았습니다.',
  googleFailed: 'Google 로그인에 실패했습니다.',
  noAccount: '아직 계정이 없나요?',
  join: '계정 만들기',
  failed: '로그인에 실패했습니다.',
};

const GOOGLE_SCRIPT_ID = 'google-identity-service';

function loadGoogleScript(callback) {
  if (window.google?.accounts?.id) {
    callback();
    return;
  }

  const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existingScript) {
    existingScript.addEventListener('load', callback, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.id = GOOGLE_SCRIPT_ID;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.body.appendChild(script);
}

function hasSelectedCategories(user) {
  return Array.isArray(user?.categories) && user.categories.length > 0;
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const googleButtonRef = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [sessionMessage, setSessionMessage] = useState(() => (
    location.state?.sessionExpired ? copy.sessionExpired : ''
  ));

  useEffect(() => {
    if (consumeSessionExpired()) {
      setSessionMessage(copy.sessionExpired);
    }
  }, []);

  const saveLoginResult = useCallback((data) => {
    if (data.emailVerificationRequired) {
      if (data.user?.email) {
        localStorage.setItem('pendingEmail', data.user.email);
      }
      navigate('/verify-email', { state: { email: data.user?.email } });
      return;
    }

    saveAuthSession({ token: data.token, user: data.user });
    localStorage.removeItem('pendingEmail');
    navigate(hasSelectedCategories(data.user) ? '/home' : '/onboarding');
  }, [navigate]);

  const handleGoogleCredential = useCallback((response) => {
    if (!response?.credential) {
      const message = copy.googleFailed;
      setGoogleError(message);
      return;
    }

    setLoading(true);
    setGoogleError('');

    googleLogin({ credential: response.credential })
      .then((data) => {
        saveLoginResult(data);
      })
      .catch((err) => {
        const message = err.message || copy.googleFailed;
        setGoogleError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [saveLoginResult]);
  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setGoogleError(copy.googleMissing);
      return;
    }

    loadGoogleScript(() => {
      if (!googleButtonRef.current || !window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        width: 400,
      });
    });
  }, [handleGoogleCredential]);

  const getLoginForm = () => ({
    username: usernameRef.current?.value || '',
    password: passwordRef.current?.value || '',
  });

  const validate = () => {
    const form = getLoginForm();
    const nextErrors = {
      username: validateUsername(form.username),
      password: validatePassword(form.password),
    };

    setFieldErrors(nextErrors);
    return Object.values(nextErrors).find(Boolean) || '';
  };

  const handleUsernameChange = (event) => {
    event.target.value = sanitizeUsername(event.target.value);
    setFieldErrors((prev) => ({ ...prev, username: validateUsername(event.target.value) }));
  };

  const handlePasswordChange = (event) => {
    event.target.value = sanitizePassword(event.target.value).slice(0, authRules.password.max);
    setFieldErrors((prev) => ({ ...prev, password: validatePassword(event.target.value) }));
  };

  const handleLogin = () => {
    const validationMessage = validate();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const info = getLoginForm();

    setLoading(true);
    setError('');

    loginUser({
      username: info.username.trim(),
      password: info.password,
    })
      .then((data) => {
        saveLoginResult(data);
      })
      .catch((err) => {
        const message = err.message || copy.failed;
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Box className="auth-page auth-page--x">
      <Paper component="section" className="auth-card auth-card--split auth-card--x">
        <Box className="auth-hero auth-hero--x">
          <Box className="auth-x-logo" aria-hidden="true">
            L
          </Box>
          <Box className="auth-hero__content auth-hero__content--x">
            <Typography component="h1" variant="h2" className="auth-hero__title auth-hero__title--x">
              {copy.heroTitle}
            </Typography>
            <Typography className="auth-hero__body auth-hero__body--x">{copy.heroBody}</Typography>
          </Box>
          <Box className="auth-x-stat-row">
            <span className="auth-x-stat">Work log</span>
            <span className="auth-x-stat">Spoiler safe</span>
            <span className="auth-x-stat">Real-time</span>
          </Box>
        </Box>

        <Box className="auth-form auth-form--x" component="form" onSubmit={handleLogin}>
          <Stack spacing={2.2}>
            <Box>
              <Typography component="h2" variant="h4" className="auth-x-form-title">
                {copy.title}
              </Typography>
            </Box>

            {sessionMessage && <Alert severity="info">{sessionMessage}</Alert>}
            {googleError && <Alert severity="warning">{googleError}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}

            <Box ref={googleButtonRef} className="auth-google-button" />

            <Divider className="auth-divider--x">또는</Divider>

            <TextField
              autoComplete="username"
              className="auth-x-input"
              error={Boolean(fieldErrors.username)}
              fullWidth
              helperText={fieldErrors.username || ''}
              inputRef={usernameRef}
              label={copy.username}
              margin="normal"
              onChange={handleUsernameChange}
              required
              slotProps={{
                htmlInput: {
                  maxLength: authRules.username.max,
                  minLength: authRules.username.min,
                  pattern: '[A-Za-z0-9_]{3,20}',
                },
              }}
            />
            <TextField
              autoComplete="current-password"
              className="auth-x-input"
              error={Boolean(fieldErrors.password)}
              fullWidth
              helperText={fieldErrors.password || ''}
              inputRef={passwordRef}
              label={copy.password}
              margin="normal"
              onChange={handlePasswordChange}
              required
              type={showPassword ? 'text' : 'password'}
              slotProps={{
                htmlInput: {
                  maxLength: authRules.password.max,
                  minLength: authRules.password.min,
                },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={copy.showPassword}
                        edge="end"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              className="auth-submit auth-submit--x"
              disabled={loading}
              fullWidth
              onClick={handleLogin}
              size="large"
              variant="contained"
            >
              {loading ? copy.submitting : copy.submit}
            </Button>

            <Stack spacing={1.2}>
              <Typography className="auth-x-join-title">{copy.noAccount}</Typography>
              <Button
                className="auth-join-button--x"
                component={RouterLink}
                fullWidth
                to="/join"
                variant="outlined"
              >
                {copy.join}
              </Button>
            </Stack>

            <Typography color="text.secondary" className="auth-x-policy">
              로그인하면 Live-Log의 서비스 이용 약관과 개인정보 처리방침에 동의하게 됩니다.
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;