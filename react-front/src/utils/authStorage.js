import { jwtDecode } from 'jwt-decode';
const ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'authUser';
const LEGACY_USER_KEY = 'user';
const SESSION_EXPIRED_NOTICE_KEY = 'sessionExpiredNotice';

export function saveAuthSession({ token, user }) {
  if (!token) return;

  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);

  if (user) {
    const serializedUser = JSON.stringify(user);
    localStorage.setItem(AUTH_USER_KEY, serializedUser);
    localStorage.setItem(LEGACY_USER_KEY, serializedUser);
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || '';
}

export function getAuthUser() {
  const user = localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(LEGACY_USER_KEY);

  if (!user) return null;

  try {
    return JSON.parse(user);
  } catch (_error) {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}
export function updateAuthUser(nextUser) {
  if (!nextUser) return;

  const serializedUser = JSON.stringify(nextUser);
  localStorage.setItem(AUTH_USER_KEY, serializedUser);
  localStorage.setItem(LEGACY_USER_KEY, serializedUser);
}

export function isAccessTokenExpired(token = getAccessToken()) {
  if (!token) return true;

  try {
    const decoded = jwtDecode(token);
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : 0;

    return !expiresAt || expiresAt <= Date.now();
  } catch (_error) {
    return true;
  }
}

export function hasValidAuthSession() {
  return Boolean(getAccessToken()) && !isAccessTokenExpired();
}

export function markSessionExpired() {
  sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
}

export function consumeSessionExpired() {
  const expired = sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1';

  if (expired) {
    sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  }

  return expired;
}
