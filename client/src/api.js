/**
 * API client with JWT auth header injection.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:5001' : '');

/**
 * Make an authenticated API request.
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  const data = await response.json();

  if (!response.ok) {
    // Handle express-validator errors array
    const errorMsg = data.error
      || data.message
      || (Array.isArray(data.errors) ? data.errors.map(e => e.msg).join(', ') : null)
      || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// ---- Auth ----
export async function login(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function register(username, password, role, displayName) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, role, display_name: displayName }),
  });
}

// ---- Groups ----
export async function fetchGroups() {
  const data = await request('/api/groups');
  return data.groups || data;
}

export async function createGroup(groupData) {
  return request('/api/groups', {
    method: 'POST',
    body: JSON.stringify(groupData),
  });
}

export async function updateGroup(id, groupData) {
  return request(`/api/groups/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(groupData),
  });
}

export async function deleteGroup(id) {
  return request(`/api/groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function joinGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
  });
}

export async function leaveGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/leave`, {
    method: 'DELETE',
  });
}

export async function fetchGroupMembers(groupId) {
  const data = await request(`/api/groups/${encodeURIComponent(groupId)}/members`);
  return data.members || [];
}

// ---- Players ----
export async function fetchPlayers(groupId) {
  const params = groupId ? `?group_id=${encodeURIComponent(groupId)}` : '';
  const data = await request(`/api/players${params}`);
  return data.players || data;
}

export async function createPlayer(playerData) {
  return request('/api/players', {
    method: 'POST',
    body: JSON.stringify(playerData),
  });
}

export async function updatePlayer(id, playerData) {
  return request(`/api/players/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(playerData),
  });
}

export async function deletePlayer(id) {
  return request(`/api/players/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function claimPlayer(playerId) {
  return request(`/api/players/${encodeURIComponent(playerId)}/claim`, { method: 'POST' });
}

export async function unclaimPlayer(playerId) {
  return request(`/api/players/${encodeURIComponent(playerId)}/unclaim`, { method: 'DELETE' });
}

// ---- Games ----
export async function fetchGames(groupId) {
  const params = groupId ? `?group_id=${encodeURIComponent(groupId)}&limit=1000` : '?limit=1000';
  const data = await request(`/api/games${params}`);
  return data.games || data;
}

export async function createGame(gameData) {
  return request('/api/games', {
    method: 'POST',
    body: JSON.stringify(gameData),
  });
}

export async function deleteGame(id) {
  return request(`/api/games/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateGame(id, data) {
  return request(`/api/games/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ---- Scripts ----
export async function fetchScripts(groupId) {
  const data = await request(`/api/scripts?group_id=${encodeURIComponent(groupId)}`);
  return data.scripts || data;
}

export async function createScript(scriptData) {
  return request('/api/scripts', {
    method: 'POST',
    body: JSON.stringify(scriptData),
  });
}

export async function deleteScript(id) {
  return request(`/api/scripts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---- Profile ----
export async function fetchProfile() {
  return request('/api/auth/profile');
}

export async function updateProfile(data) {
  return request('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
