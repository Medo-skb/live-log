import { clearAuthSession, getAccessToken, isAccessTokenExpired, markSessionExpired } from '../utils/authStorage';

function redirectToLoginForExpiredSession() {
  clearAuthSession();
  markSessionExpired();

  if (window.location.pathname !== '/') {
    window.location.assign('/');
  }
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function buildUrl(endpoint, query) {
  const url = new URL(endpoint, API_BASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, value);
      }
    });
  }

  return url.toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');
  return text ? { message: text } : {};
}

export async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, query, token, auth = false, headers = {} } = options;
  const upperMethod = method.toUpperCase();
  const hasBody = body !== undefined && !['GET', 'HEAD'].includes(upperMethod);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const accessToken = token || (auth ? getAccessToken() : '');

  if (auth && isAccessTokenExpired(accessToken)) {
    redirectToLoginForExpiredSession();
    throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
  }

  const response = await fetch(buildUrl(endpoint, query), {
    method: upperMethod,
    headers: {
      ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(hasBody ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
  }

  return data;
}