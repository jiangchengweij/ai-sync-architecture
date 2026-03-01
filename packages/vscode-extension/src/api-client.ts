import * as vscode from 'vscode';

export class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('aiSync');
    this.baseUrl = config.get<string>('serverUrl', 'http://localhost:3000');
    this.token = config.get<string>('token', '');
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Request failed: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async getProjectGroups() {
    return this.request<{ items: any[] }>('/project-groups');
  }

  async analyzeSync(projectGroupId: string, commitHash: string) {
    return this.request<any>('/sync/analyze', {
      method: 'POST',
      body: JSON.stringify({ projectGroupId, commitHash }),
    });
  }

  async getSyncStatus(syncId: string) {
    return this.request<any>(`/sync/${syncId}/status`);
  }

  async getPendingReviews() {
    return this.request<{ items: any[] }>('/reviews/pending');
  }

  async approveReview(id: string) {
    return this.request<any>(`/reviews/${id}/approve`, { method: 'POST' });
  }

  async rejectReview(id: string, reason: string) {
    return this.request<any>(`/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
}
