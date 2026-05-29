export const CUSTOM_EMAIL_DOMAIN = 'custom';

export const emailDomainOptions = [
  'gmail.com',
  'naver.com',
  'daum.net',
  'kakao.com',
  'outlook.com',
];

export const authRules = {
  username: {
    min: 3,
    max: 20,
    pattern: /^[A-Za-z0-9_]{3,20}$/,
    allowedInput: /[^A-Za-z0-9_]/g,
  },
  nickname: {
    min: 2,
    max: 20,
    pattern: /^[\p{L}\p{N}]+$/u,
  },
  email: {
    min: 5,
    max: 100,
    localMax: 64,
    domainMax: 63,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    localAllowedInput: /[^A-Za-z0-9._%+-]/g,
    domainAllowedInput: /[^A-Za-z0-9.-]/g,
  },
  password: {
    min: 8,
    max: 64,
  },
};

export function sanitizeUsername(value) {
  return value.replace(authRules.username.allowedInput, '').slice(0, authRules.username.max);
}

export function sanitizeNickname(value) {
  return value.replace(/[^\p{L}\p{N}]/gu, '').slice(0, authRules.nickname.max);
}

export function sanitizePassword(value) {
  return value.replace(/\s/g, '');
}

export function sanitizeEmailLocal(value) {
  return value.replace(authRules.email.localAllowedInput, '').slice(0, authRules.email.localMax);
}

export function sanitizeEmailDomain(value) {
  return value.replace(authRules.email.domainAllowedInput, '').toLowerCase().slice(0, authRules.email.domainMax);
}

export function buildEmailAddress({ emailId, emailDomain, customEmailDomain }) {
  const localPart = emailId.trim();
  const domain = emailDomain === CUSTOM_EMAIL_DOMAIN ? customEmailDomain.trim() : emailDomain.trim();

  if (!localPart || !domain) return '';
  return localPart + '@' + domain;
}

export function validateUsername(value) {
  const username = value.trim();

  if (!username) return '아이디를 입력해주세요.';
  if (username.length < authRules.username.min) return '아이디는 3자 이상 입력해주세요.';
  if (username.length > authRules.username.max) return '아이디는 20자 이하로 입력해주세요.';
  if (!authRules.username.pattern.test(username)) return '아이디는 영문, 숫자만 사용할 수 있습니다.';

  return '';
}

export function validateNickname(value) {
  const nickname = value.trim();

  if (!nickname) return '닉네임을 입력해주세요.';
  if (nickname.length < authRules.nickname.min) return '닉네임은 2자 이상 입력해주세요.';
  if (nickname.length > authRules.nickname.max) return '닉네임은 20자 이하로 입력해주세요.';
  if (!authRules.nickname.pattern.test(nickname)) return '닉네임은 공백이나 특수문자를 포함할 수 없습니다.';

  return '';
}

export function validateEmail(value) {
  const email = value.trim();

  if (!email) return '이메일을 입력해주세요.';
  if (email.length < authRules.email.min) return '이메일은 5자 이상 입력해주세요.';
  if (email.length > authRules.email.max) return '이메일은 100자 이하로 입력해주세요.';
  if (!authRules.email.pattern.test(email)) return '올바른 이메일 형식이 아닙니다.';

  return '';
}

export function validateEmailParts(form) {
  if (!form.emailId.trim()) return '이메일 아이디를 입력해주세요.';
  if (form.emailDomain === CUSTOM_EMAIL_DOMAIN && !form.customEmailDomain.trim()) {
    return '도메인을 입력해주세요.';
  }
  if (!buildEmailAddress(form)) return '이메일 도메인을 선택해주세요.';

  return validateEmail(buildEmailAddress(form));
}

export function validatePassword(value) {
  if (!value) return '비밀번호를 입력해주세요.';
  if (/\s/.test(value)) return '비밀번호에는 공백을 포함할 수 없습니다.';
  if (value.length < authRules.password.min) return '비밀번호는 8자 이상 입력해주세요.';
  if (value.length > authRules.password.max) return '비밀번호는 64자 이하로 입력해주세요.';

  return '';
}

export function getPasswordStrength(value) {
  const password = value || '';

  if (!password) {
    return {
      score: 0,
      label: '대기',
      className: 'empty',
      description: '비밀번호를 입력하면 보안 수준이 표시됩니다.',
    };
  }

  const checks = [
    password.length >= authRules.password.min,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const passed = checks.filter(Boolean).length;

  if (password.length < authRules.password.min || passed <= 1) {
    return {
      score: 1,
      label: '취약',
      className: 'weak',
      description: '보안이 취약합니다. 영문 대소문자, 숫자, 특수문자를 포함해 8자 이상으로 조합해 주세요.',
    };
  }

  if (passed === 2) {
    return {
      score: 2,
      label: '보통',
      className: 'normal',
      description: '사용 가능하지만, 더 복잡한 조합을 권장합니다.',
    };
  }

  if (passed === 3 || passed === 4) {
    return {
      score: 3,
      label: '양호',
      className: 'good',
      description: '안전한 비밀번호입니다.',
    };
  }

  return {
    score: 4,
    label: '안전',
    className: 'safe',
    description: '예측하기 어려운 강력한 비밀번호입니다.',
  };
}