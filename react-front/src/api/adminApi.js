import { apiRequest } from './apiClient';

export function getReports({ cursor, limit, status } = {}) {
  return apiRequest('/admin/reports', {
    auth: true,
    query: { cursor, limit, status },
  });
}

export function updateReport({ reportId, status, hidePost }) {
  return apiRequest('/admin/reports/' + reportId, {
    method: 'PATCH',
    auth: true,
    body: { status, hidePost },
  });
}
