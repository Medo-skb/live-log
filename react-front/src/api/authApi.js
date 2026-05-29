import { apiRequest } from './apiClient';

export function registerUser({ username, nickname, email, password }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { username, nickname, email, password },
  });
}

export function loginUser({ username, password }) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}

export function googleLogin({ credential }) {
  return apiRequest('/auth/google', {
    method: 'POST',
    body: { credential },
  });
}

export function verifyEmail({ userId, token }) {
  return apiRequest('/auth/verify-email', {
    method: 'GET',
    query: { userId, token },
  });
}