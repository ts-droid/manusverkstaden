/**
 * API Client – handles all server communication with auth token management.
 *
 * Replaces direct Anthropic API calls with server-side proxied calls.
 * Manages JWT access tokens with automatic refresh.
 */

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.baseUrl = '/api';
    this.refreshing = null; // Prevent concurrent refreshes
  }

  /**
   * Make an authenticated API request.
   * Auto-refreshes token on 401 and retries once.
   */
  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers, credentials: 'include' });

    // Auto-refresh on any 401 (expired token, invalid token, etc.)
    if (response.status === 401) {
      const refreshed = await this.refresh();
      if (refreshed) {
        // Retry with new token
        headers.Authorization = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(url, { ...options, headers, credentials: 'include' });
        if (retryResponse.ok) return retryResponse.json();
        // If retry also fails, fall through to error handling
        if (retryResponse.status === 401) {
          throw new AuthError('Sessionen har gått ut. Logga in igen.');
        }
        const retryData = await retryResponse.json().catch(() => ({ error: 'Okänt fel' }));
        throw new ApiError(retryData.error || `HTTP ${retryResponse.status}`, retryResponse.status, retryData);
      }
      throw new AuthError('Sessionen har gått ut. Logga in igen.');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Okänt fel' }));
      throw new ApiError(data.error || `HTTP ${response.status}`, response.status, data);
    }

    return response.json();
  }

  // ─── AUTH ───

  async register(email, password, name) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.accessToken = data.accessToken;
    return data.user;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.accessToken = data.accessToken;
    return data.user;
  }

  async refresh() {
    // Prevent concurrent refresh calls
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;
        const data = await res.json();
        this.accessToken = data.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => {});
    this.accessToken = null;
  }

  // ─── PROJECTS ───

  async getProjects() {
    return this.request('/projects');
  }

  async getProject(id) {
    return this.request(`/projects/${id}`);
  }

  async createProject(data) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id, data) {
    return this.request(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  async uploadManuscript(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request(`/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  // ─── AI ───

  async reviewChapter(chapterId, projectId) {
    return this.request('/ai/review', {
      method: 'POST',
      body: JSON.stringify({ chapterId, projectId }),
    });
  }

  async generateDNAProfile(projectId) {
    return this.request('/ai/dna-profile', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async developText(mode, input, { context, chapterId, dnaProfile, emotionMap, chapterTitle, userInstruction, rewriteFocus } = {}) {
    return this.request('/ai/develop', {
      method: 'POST',
      body: JSON.stringify({ mode, input, context, chapterId, dnaProfile, emotionMap, chapterTitle, userInstruction, rewriteFocus }),
    });
  }

  async finalCheck(projectId) {
    return this.request('/ai/final-check', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async translateChapter(chapterId, language) {
    return this.request('/ai/translate', {
      method: 'POST',
      body: JSON.stringify({ chapterId, language }),
    });
  }

  // ─── CHAPTERS ───

  async updateChapter(id, data) {
    return this.request(`/chapters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getChapter(id) {
    return this.request(`/chapters/${id}`);
  }

  // ─── SUGGESTIONS ───

  async updateSuggestion(id, status) {
    return this.request(`/suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async createSuggestion(data) {
    return this.request('/suggestions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── ADMIN ───

  async getAdminOverview() { return this.request('/admin/overview'); }
  async getAdminUsers(search = '') { return this.request(`/admin/users?search=${encodeURIComponent(search)}`); }
  async updateAdminUser(id, data) { return this.request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async getAdminUsage() { return this.request('/admin/usage'); }
  async getAdminPrompts() { return this.request('/admin/prompts'); }
  async updateAdminPrompt(key, content) { return this.request(`/admin/prompts/${key}`, { method: 'PUT', body: JSON.stringify({ content }) }); }

  // ─── BILLING ───

  async createCheckout(priceId) {
    return this.request('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  }

  async getUsage() {
    return this.request('/billing/usage');
  }

  async openPortal() {
    return this.request('/billing/portal', { method: 'POST' });
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

// Singleton instance
export const apiClient = new ApiClient();
