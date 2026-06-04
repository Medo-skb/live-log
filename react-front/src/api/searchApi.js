import { apiRequest } from './apiClient';

export function getSearchSuggestions({ keyword }) {
  return apiRequest('/search/suggestions', {
    auth: true,
    query: { keyword },
  });
}
