export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:5050').replace(
  /\/$/,
  '',
);

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || 'The server could not complete that request.';
    const error = new Error(message);
    error.code = payload?.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const getHealth = () => apiRequest('/health');
export const getRooms = () => apiRequest('/api/rooms');

export const login = (username, password) =>
  apiRequest('/api/auth/login', { method: 'POST', body: { username, password } });

export const getMe = (token) => apiRequest('/api/auth/me', { token });

export const getThemes = () => apiRequest('/api/themes');

export const getEscrowPublicKey = () => apiRequest('/api/escrow/public-key');

export const listPrivateRooms = (token) => apiRequest('/api/admin/private-rooms', { token });

export const readPrivateRoom = (room, token) =>
  apiRequest(`/api/admin/private-rooms/${encodeURIComponent(room)}`, { token });

export const createTheme = (theme, token) =>
  apiRequest('/api/themes', { method: 'POST', body: theme, token });

export const updateTheme = (id, theme, token) =>
  apiRequest(`/api/themes/${id}`, { method: 'PUT', body: theme, token });

export const deleteTheme = (id, token) =>
  apiRequest(`/api/themes/${id}`, { method: 'DELETE', token });
