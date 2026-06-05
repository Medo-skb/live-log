import { apiRequest } from './apiClient';

export function getNotices({ cursor, limit } = {}) {
  return apiRequest('/notices', {
    auth: true,
    query: { cursor, limit },
  });
}

export function getUnreadNoticeCount() {
  return apiRequest('/notices/unread-count', {
    auth: true,
  });
}

export function markNoticeRead({ noticeId }) {
  return apiRequest('/notices/' + noticeId + '/read', {
    method: 'PATCH',
    auth: true,
  });
}

export function markAllNoticesRead() {
  return apiRequest('/notices/read-all', {
    method: 'PATCH',
    auth: true,
  });
}
