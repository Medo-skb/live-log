import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { registerUser } from '../../api/authApi';
import {
  CUSTOM_EMAIL_DOMAIN,
  authRules,
  buildEmailAddress,
  emailDomainOptions,
  getPasswordStrength,
  sanitizeEmailDomain,
  sanitizeEmailLocal,
  sanitizeNickname,
  sanitizePassword,
  sanitizeUsername,
  validateEmailParts,
  validatePassword,
  validateNickname,
  validateUsername,
} from '../../utils/authValidation';
import '../../css/auth.css';

const copy = {
  brand: 'Live-Log',
  title: '계정 만들기',
  subtitle: '작품 감상과 진행 상황을 기록할 계정을 만듭니다.',
  heroTitle: '새로운 감상 기록을 시작하세요.',
  heroBody: '작품별 로그, 진도, 스포일러 보호를 한곳에서 관리하는 감상 SNS입니다.',
  username: '아이디',
  nickname: '닉네임',
  emailId: '이메일',
  emailDomain: '도메인',
  customEmailDomain: '직접 입력',
  password: '비밀번호',
  confirmPassword: '비밀번호 확인',
  showPassword: '비밀번호 표시 전환',
  agree: '서비스 이용 약관과 개인정보 처리방침에 동의합니다.',
  submit: '가입하기',
  submitting: '가입 처리 중...',
  hasAccount: '이미 계정이 있나요?',
  login: '로그인하기',
  mismatchPassword: '비밀번호 확인이 일치하지 않습니다.',
  requiredConfirmPassword: '비밀번호 확인을 입력해주세요.',
  requiredAgree: '서비스 이용 약관에 동의해주세요.',
  failed: '회원가입에 실패했습니다.',
};

function Join() {
  const navigate = useNavigate();

  // 모든 입력값을 상태로 관리합니다.
  const [formData, setFormData] = useState({
    username: '',
    nickname: '',
    emailId: '',
    customEmailDomain: '',
    password: '',
    confirmPassword: '',
  });
  const [emailDomain, setEmailDomain] = useState(emailDomainOptions[0]);
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    username: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
    agree: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(formData.password);

  // 폼 데이터를 합쳐서 반환하는 헬퍼 (유효성 검사용)
  const getCombinedForm = () => ({
    ...formData,
    emailDomain,
    agree,
  });

  const validate = () => {
    const form = getCombinedForm();
    const nextErrors = {};
    nextErrors.username = validateUsername(form.username);
    nextErrors.nickname = validateNickname(form.nickname);
    nextErrors.email = validateEmailParts(form);
    nextErrors.password = validatePassword(form.password);
    
    if (!form.confirmPassword) {
      nextErrors.confirmPassword = copy.requiredConfirmPassword;
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = copy.mismatchPassword;
    } else {
      nextErrors.confirmPassword = ''; // 에러 없음
    }

    nextErrors.agree = form.agree ? '' : copy.requiredAgree;

    setFieldErrors(nextErrors);
    return Object.values(nextErrors).find(Boolean) || '';
  };

  const handleUsernameChange = (event) => {
    const value = sanitizeUsername(event.target.value);
    setFormData(prev => ({ ...prev, username: value }));
    setFieldErrors((prev) => ({ ...prev, username: validateUsername(value) }));
  };

  const handleNicknameChange = (event) => {
    const value = sanitizeNickname(event.target.value);
    setFormData(prev => ({ ...prev, nickname: value }));
    setFieldErrors((prev) => ({ ...prev, nickname: validateNickname(value) }));
  };

  const handleEmailIdChange = (event) => {
    const value = sanitizeEmailLocal(event.target.value);
    setFormData(prev => ({ ...prev, emailId: value }));
    const currentForm = { ...getCombinedForm(), emailId: value };
    setFieldErrors((prev) => ({ ...prev, email: validateEmailParts(currentForm) }));
  };

  const handleCustomDomainChange = (event) => {
    const value = sanitizeEmailDomain(event.target.value);
    setFormData(prev => ({ ...prev, customEmailDomain: value }));
    const currentForm = { ...getCombinedForm(), customEmailDomain: value };
    setFieldErrors((prev) => ({ ...prev, email: validateEmailParts(currentForm) }));
  };

  const handlePasswordChange = (event) => {
    const value = sanitizePassword(event.target.value).slice(0, authRules.password.max);
    setFormData(prev => ({ ...prev, password: value }));
    setFieldErrors((prev) => ({ ...prev, password: validatePassword(value) }));
  };

  const handleConfirmPasswordChange = (event) => {
    const value = sanitizePassword(event.target.value).slice(0, authRules.password.max);
    setFormData(prev => ({ ...prev, confirmPassword: value }));
    
    let message = '';
    if (!value) message = copy.requiredConfirmPassword;
    else if (value !== formData.password) message = copy.mismatchPassword;

    setFieldErrors((prev) => ({ ...prev, confirmPassword: message }));
  };

  const handleDomainChange = (event) => {
    setEmailDomain(event.target.value);
    setFieldErrors((prev) => ({ ...prev, email: '' }));
  };

  const handleJoin = () => {
    const validationMessage = validate();

    if (validationMessage) {
      setError(validationMessage);
      alert(validationMessage);
      return;
    }

    const form = getCombinedForm();
    const info = {
      username: form.username.trim(),
      nickname: form.nickname.trim(),
      email: buildEmailAddress(form),
      password: form.password,
    };
    
    setLoading(true);
    setError('');

    registerUser(info)
      .then((data) => {
        alert(data.message || '회원가입이 완료되었습니다.');
        navigate('/');
      })
      .catch((err) => {
        const message = err.message || copy.failed;
        setError(message);
        alert(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Box className="auth-page auth-page--x">
      <Paper component="section" className="auth-card auth-card--split auth-card--x auth-card--join">
        <Box className="auth-hero auth-hero--x auth-hero--join">
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
            <span className="auth-x-stat">Create</span>
            <span className="auth-x-stat">Verify email</span>
            <span className="auth-x-stat">Start logging</span>
          </Box>
        </Box>

        <Box className="auth-form auth-form--x auth-form--join">
          <Stack spacing={1.45}>
            <Box>
              <Typography component="h2" variant="h4" className="auth-x-form-title">
                {copy.title}
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              autoComplete="username"
              className="auth-x-input"
              error={Boolean(fieldErrors.username)}
              fullWidth
              helperText={fieldErrors.username || '영문, 숫자 3~20자'}
              label={copy.username}
              onChange={handleUsernameChange}
              required
              value={formData.username}
              slotProps={{
                htmlInput: {
                  maxLength: authRules.username.max,
                  minLength: authRules.username.min,
                  pattern: '[A-Za-z0-9_]{3,20}',
                },
              }}
            />

            <TextField
              className="auth-x-input"
              error={Boolean(fieldErrors.nickname)}
              fullWidth
              helperText={fieldErrors.nickname || '서비스에서 표시될 이름 (2~20자)'}
              label={copy.nickname}
              onChange={handleNicknameChange}
              required
              value={formData.nickname}
              slotProps={{
                htmlInput: {
                  maxLength: authRules.nickname.max,
                },
              }}
            />

            <Box className="auth-email-group auth-email-group--join">
              <Box className="auth-email-row auth-email-row--compact">
                <TextField
                  autoComplete="email"
                  className="auth-email-id auth-x-input"
                  error={Boolean(fieldErrors.email)}
                  helperText={fieldErrors.email || ''}
                  label={copy.emailId}
                  onChange={handleEmailIdChange}
                  required
                  value={formData.emailId}
                  slotProps={{
                    htmlInput: {
                      maxLength: authRules.email.localMax,
                    },
                  }}
                />
                <Box className="auth-email-at auth-email-at--compact" aria-hidden="true">
                  @
                </Box>
                <TextField
                  className="auth-email-domain auth-x-input"
                  label={copy.emailDomain}
                  onChange={handleDomainChange}
                  required
                  select
                  value={emailDomain}
                >
                  {emailDomainOptions.map((domain) => (
                    <MenuItem key={domain} value={domain}>
                      {domain}
                    </MenuItem>
                  ))}
                  <MenuItem value={CUSTOM_EMAIL_DOMAIN}>직접 입력</MenuItem>
                </TextField>
              </Box>

              {emailDomain === CUSTOM_EMAIL_DOMAIN && (
                <TextField
                  autoComplete="email"
                  className="auth-x-input"
                  error={Boolean(fieldErrors.email)}
                  fullWidth
                  helperText={fieldErrors.email || '예: example.com'}
                  label={copy.customEmailDomain}
                  onChange={handleCustomDomainChange}
                  required
                  value={formData.customEmailDomain}
                  slotProps={{
                    htmlInput: {
                      maxLength: authRules.email.domainMax,
                    },
                  }}
                />
              )}
            </Box>

            <TextField
              autoComplete="new-password"
              className="auth-x-input"
              error={Boolean(fieldErrors.password)}
              fullWidth
              helperText={fieldErrors.password || '8~64자의 영문, 숫자, 특수문자 조합'}
              label={copy.password}
              onChange={handlePasswordChange}
              required
              value={formData.password}
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

            <Box className={'password-strength password-strength--' + passwordStrength.className} sx={{ mt: '15px !important', mb: 1 }}>
              <Box className="password-strength__header">
                <Typography variant="body2" className="password-strength__label">
                  보안 수준: {passwordStrength.label}
                </Typography>
              </Box>
              <Box className="password-strength__track" aria-hidden="true">
                <Box className="password-strength__bar" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {passwordStrength.description}
              </Typography>
            </Box>

            <TextField
              autoComplete="new-password"
              className="auth-x-input"
              error={Boolean(fieldErrors.confirmPassword) && fieldErrors.confirmPassword !== 'matching'}
              fullWidth
              helperText={
                fieldErrors.confirmPassword === 'matching' 
                  ? <Typography variant="caption" sx={{ color: 'success.main' }}>비밀번호가 일치합니다.</Typography>
                  : fieldErrors.confirmPassword || '비밀번호를 한 번 더 입력해주세요.'
              }
              FormHelperTextProps={{ sx: { '&.Mui-error': { color: 'error.main' } } }}
              label={copy.confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
              type={showPassword ? 'text' : 'password'}
              slotProps={{
                htmlInput: {
                  maxLength: authRules.password.max,
                  minLength: authRules.password.min,
                },
              }}
            />

            <FormControlLabel
              className="auth-agree--join"
              control={<Checkbox checked={agree} onChange={(event) => setAgree(event.target.checked)} />}
              label={copy.agree}
            />
            {fieldErrors.agree && <Alert severity="warning">{fieldErrors.agree}</Alert>}

            <Button
              className="auth-submit auth-submit--x"
              disabled={loading}
              fullWidth
              onClick={handleJoin}
              size="large"
              startIcon={<PersonAddAlt1Icon />}
              variant="contained"
            >
              {loading ? copy.submitting : copy.submit}
            </Button>

            <Typography align="center" color="text.secondary">
              {copy.hasAccount}{' '}
              <Link component={RouterLink} to="/" underline="hover" className="auth-link">
                {copy.login}
              </Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default Join;