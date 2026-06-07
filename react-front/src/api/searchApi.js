import { apiRequest } from './apiClient';

export function getSearchSuggestions({ keyword }) {
  return apiRequest('/search/suggestions', {
    auth: true,
    query: { keyword },
  });
}

export function getTrendingTags() {
  return apiRequest('/search/tags/trending', {
    auth: true,
  });
}
