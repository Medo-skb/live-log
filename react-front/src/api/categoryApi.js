import { apiRequest } from './apiClient';

export function getCategories() {
  return apiRequest('/categories');
}

export function getMyCategories() {
  return apiRequest('/users/me/categories', {
    auth: true,
  });
}

export function updateMyCategories({ categoryIds }) {
  return apiRequest('/users/me/categories', {
    method: 'PUT',
    auth: true,
    body: { categoryIds },
  });
}
