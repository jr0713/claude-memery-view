// ── API Client ────────────────────────────────────────────

const api = {
  async fetchMemories(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.type && params.type !== 'all') query.set('type', params.type);
    if (params.project && params.project !== 'all') query.set('project', params.project);
    if (params.sort) query.set('sort', params.sort);
    const qs = query.toString();
    const url = '/api/memories' + (qs ? '?' + qs : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  },

  async getMemory(id) {
    const res = await fetch(`/api/memories/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Memory not found');
    return res.json();
  },

  async createMemory(data) {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create memory');
    }
    return res.json();
  },

  async updateMemory(id, data) {
    const res = await fetch(`/api/memories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update memory');
    }
    return res.json();
  },

  async deleteMemory(id) {
    const res = await fetch(`/api/memories/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete memory');
    }
    return res.json();
  },

  async fetchGraph() {
    const res = await fetch('/api/graph');
    if (!res.ok) throw new Error('Failed to fetch graph data');
    return res.json();
  },

  async fetchTypes() {
    const res = await fetch('/api/types');
    if (!res.ok) throw new Error('Failed to fetch types');
    return res.json();
  },

  async fetchConfig() {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  async fetchProjects() {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  }
};
