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

export function updateUserProfile({ username, nickname, bio, profileImage, bannerImage }) {
  const hasFile = profileImage || bannerImage;

  if (hasFile) {
    const formData = new FormData();
    formData.append('nickname', nickname);
    formData.append('bio', bio || '');
    if (profileImage) formData.append('profileImage', profileImage);
    if (bannerImage) formData.append('bannerImage', bannerImage);

    return apiRequest('/users/' + encodeURIComponent(username), {
      method: 'PATCH',
      auth: true,
      body: formData,
    });
  }

  return apiRequest('/users/' + encodeURIComponent(username), {
    method: 'PATCH',
    auth: true,
    body: { nickname, bio },
  });
}


export function getRecommendedUsers({ limit } = {}) {
  return apiRequest('/users/recommendations', {
    auth: true,
    query: { limit },
  });
}

export function searchUsers({ keyword, limit } = {}) {
  return apiRequest('/users/search', {
    auth: true,
    query: { keyword, limit },
  });
}
