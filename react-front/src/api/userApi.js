import { apiRequest } from './apiClient';

export function getUserProfile({ username }) {
  return apiRequest('/users/' + encodeURIComponent(username), {
    auth: true,
  });
}

export function toggleUserFollow({ username }) {
  return apiRequest('/users/' + encodeURIComponent(username) + '/follow', {
    method: 'POST',
    auth: true,
  });
}

export function getUserConnections({ username, type }) {
  return apiRequest('/users/' + encodeURIComponent(username) + '/' + encodeURIComponent(type), {
    auth: true,
  });
}

export function updateUserProfile({ username, nickname }) {
  return apiRequest('/users/' + encodeURIComponent(username), {
    method: 'PATCH',
    auth: true,
    body: { nickname },
  });
}
