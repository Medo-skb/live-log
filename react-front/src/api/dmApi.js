import { apiRequest } from './apiClient';

export function getDmConversations() {
  return apiRequest('/dms/conversations', {
    auth: true,
  });
}

export function getDmMessages({ username, cursor, limit } = {}) {
  return apiRequest('/dms/' + encodeURIComponent(username) + '/messages', {
    auth: true,
    query: { cursor, limit },
  });
}

export function sendDmMessage({ username, content }) {
  return apiRequest('/dms/' + encodeURIComponent(username) + '/messages', {
    method: 'POST',
    auth: true,
    body: { content },
  });
}

export function getUnreadDmCount() {
  return apiRequest('/dms/unread-count', {
    auth: true,
  });
}

export function markDmConversationRead({ username }) {
  return apiRequest('/dms/' + encodeURIComponent(username) + '/read', {
    method: 'PATCH',
    auth: true,
  });
}

export function deleteDmMessage({ messageId }) {
  return apiRequest('/dms/messages/' + messageId, {
    method: 'DELETE',
    auth: true,
  });
}

export function blockDmUser({ username }) {
  return apiRequest('/dms/' + encodeURIComponent(username) + '/block', {
    method: 'POST',
    auth: true,
  });
}
