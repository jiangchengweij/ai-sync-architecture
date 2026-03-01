import type { Review, ReviewDetail, ProjectGroup, SyncTask, StatsOverview } from '../types';

const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Project Groups
  getProjectGroups: (page = 1, limit = 20) =>
    request<{ items: ProjectGroup[]; pagination: { total: number; page: number; limit: number } }>(
      `/project-groups?page=${page}&limit=${limit}`,
    ),

  getProjectGroup: (id: string) => request<ProjectGroup>(`/project-groups/${id}`),

  createProjectGroup: (data: { name: string; description: string; baseProject: { name: string; gitUrl: string; defaultBranch?: string } }) =>
    request<ProjectGroup>('/project-groups', { method: 'POST', body: JSON.stringify(data) }),

  addVariant: (groupId: string, data: { name: string; gitUrl: string; defaultBranch?: string; customizationNotes?: string }) =>
    request<any>(`/project-groups/${groupId}/variants`, { method: 'POST', body: JSON.stringify(data) }),

  deleteProjectGroup: (id: string) =>
    request<void>(`/project-groups/${id}`, { method: 'DELETE' }),
  // Sync
  analyzeSync: (projectGroupId: string, commitHash: string, targetVariants?: string[]) =>
    request<SyncTask>('/sync/analyze', {
      method: 'POST',
      body: JSON.stringify({ projectGroupId, commitHash, targetVariants }),
    }),

  generateSync: (syncId: string, variantIds: string[]) =>
    request<{ syncId: string; status: string }>('/sync/generate', {
      method: 'POST',
      body: JSON.stringify({ syncId, variantIds }),
    }),

  executeSync: (syncId: string, approvedVariants: string[], options?: { branchPrefix?: string; createPr?: boolean }) =>
    request<{ syncId: string; status: string }>('/sync/execute', {
      method: 'POST',
      body: JSON.stringify({ syncId, approvedVariants, ...options }),
    }),

  getSyncStatus: (syncId: string) => request<SyncTask>(`/sync/${syncId}/status`),

  // Reviews
  getReviews: (params?: { projectGroupId?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.projectGroupId) query.set('projectGroupId', params.projectGroupId);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{ items: Review[]; pagination: { total: number } }>(`/reviews/pending${qs ? `?${qs}` : ''}`);
  },

  getReviewDetail: (id: string) => request<ReviewDetail>(`/reviews/${id}`),

  approveReview: (id: string) =>
    request<{ id: string; status: string }>(`/reviews/${id}/approve`, { method: 'POST' }),

  rejectReview: (id: string, reason: string, suggestedFix?: string) =>
    request<{ id: string; status: string }>(`/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, suggestedFix }),
    }),

  batchApprove: (data: { reviewIds?: string[]; confidenceThreshold?: number }) =>
    request<{ approved: number }>('/reviews/batch-approve', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Stats
  getStats: () => request<StatsOverview>('/stats'),
};
