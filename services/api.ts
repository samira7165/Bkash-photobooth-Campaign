export interface SessionData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gender: string;
  selectedJob?: string;
  customJob?: string;
  status: string;
}

export async function createSession(data: {
  name: string;
  phone: string;
  email?: string;
  gender: string;
  campaignId?: string;
}): Promise<SessionData> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create session');
  }
  return res.json();
}

export async function selectJob(
  sessionId: string,
  data: { job: string; customJob?: string },
): Promise<SessionData> {
  const res = await fetch(`/api/sessions/${sessionId}/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to select job');
  }
  return res.json();
}

export async function uploadImage(
  sessionId: string,
  imageBlob: Blob,
): Promise<SessionData> {
  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');
  const res = await fetch(`/api/sessions/${sessionId}/image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to upload image');
  }
  return res.json();
}

// ─── Admin: Campaigns ───

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  bgColor?: string | null;
  textColor?: string | null;
  cardBgColor?: string | null;
  fontFamily?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number };
}

export interface CampaignInput {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  brandColor?: string;
  bgColor?: string;
  textColor?: string;
  cardBgColor?: string;
  fontFamily?: string;
  isActive?: boolean;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch('/api/campaigns');
  return handle<Campaign[]>(res);
}

export async function createCampaign(data: CampaignInput): Promise<Campaign> {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<Campaign>(res);
}

export async function updateCampaign(
  id: string,
  data: Partial<CampaignInput>,
): Promise<Campaign> {
  const res = await fetch(`/api/campaigns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<Campaign>(res);
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
  await handle<{ message: string }>(res);
}

// ─── Admin: Submissions ───

export interface Submission {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  gender: string;
  selectedJob?: string | null;
  customJob?: string | null;
  status: string;
  hasOriginalImage: boolean;
  hasGeneratedImage: boolean;
  smsSent: boolean;
  errorMessage?: string | null;
  campaign?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionsResponse {
  data: Submission[];
  total: number;
  page: number;
  limit: number;
}

export async function getSubmissions(params: {
  campaignId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<SubmissionsResponse> {
  const qs = new URLSearchParams();
  if (params.campaignId) qs.set('campaignId', params.campaignId);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`/api/admin/submissions?${qs.toString()}`);
  return handle<SubmissionsResponse>(res);
}

// ─── Admin: Queue status ───

export interface QueueStatus {
  queued: number;
  processing: number;
  generated: number;
  smsSent: number;
  failed: number;
  total: number;
}

export async function getQueueStatus(campaignId?: string): Promise<QueueStatus> {
  const qs = campaignId && campaignId !== 'all' ? `?campaignId=${campaignId}` : '';
  const res = await fetch(`/api/admin/queue-status${qs}`);
  return handle<QueueStatus>(res);
}

// ─── Admin: Providers ───

export interface Provider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string; // always masked when read from the API
  model?: string | null;
  senderId?: string | null;
  priority: number;
  isActive: boolean;
  failCount: number;
  lastFailAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvidersResponse {
  ai: Provider[];
  sms: Provider[];
}

export interface ProviderInput {
  type: 'ai' | 'sms';
  name: string;
  apiUrl: string;
  apiKey: string;
  model?: string;
  senderId?: string;
  priority?: number;
}

export async function getProviders(): Promise<ProvidersResponse> {
  const res = await fetch('/api/admin/providers');
  return handle<ProvidersResponse>(res);
}

export async function createProvider(data: ProviderInput): Promise<Provider> {
  const res = await fetch('/api/admin/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<Provider>(res);
}

export async function updateProvider(
  id: string,
  data: Partial<Omit<ProviderInput, 'type'>> & { isActive?: boolean },
): Promise<Provider> {
  const res = await fetch(`/api/admin/providers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<Provider>(res);
}

export async function deleteProvider(id: string): Promise<void> {
  const res = await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' });
  await handle<{ message: string }>(res);
}

export async function resetProvider(id: string): Promise<Provider> {
  const res = await fetch(`/api/admin/providers/${id}/reset`, { method: 'POST' });
  return handle<Provider>(res);
}

// ─── Admin: Auth ───

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export async function adminLogin(username: string, password: string): Promise<{ success: boolean; displayName: string }> {
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handle<{ success: boolean; displayName: string }>(res);
}

export async function adminLogout(): Promise<void> {
  const res = await fetch('/api/admin/auth/logout', { method: 'POST' });
  await handle<{ success: boolean }>(res);
}

export async function getCurrentAdmin(): Promise<AdminUser> {
  const res = await fetch('/api/admin/auth/me');
  return handle<AdminUser>(res);
}

// ─── Admin: Delete submissions ───

export async function deleteSubmission(id: string): Promise<void> {
  const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
  await handle<{ success: boolean; message: string }>(res);
}

export async function bulkDeleteSubmissions(ids: string[]): Promise<{ success: boolean; deleted: number }> {
  const res = await fetch('/api/admin/submissions/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return handle<{ success: boolean; deleted: number }>(res);
}

// ─── Admin: Dashboard stats ───

export interface RecentSubmission {
  id: string;
  name: string;
  phone: string;
  selectedJob?: string | null;
  customJob?: string | null;
  status: string;
  campaign?: { id: string; name: string } | null;
  createdAt: string;
}

export interface DashboardStats {
  totalSessions: number;
  todaySessions: number;
  activeCampaigns: number;
  totalGenerations: number;
  queued: number;
  processing: number;
  smsSent: number;
  failed: number;
  recent: RecentSubmission[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/admin/dashboard-stats');
  return handle<DashboardStats>(res);
}

// ─── Admin: Analytics ───

export interface AnalyticsData {
  dailyCounts: { date: string; count: number }[];
  byCampaign: { campaignName: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byJob: { job: string; count: number }[];
}

export async function getAnalytics(from?: string, to?: string): Promise<AnalyticsData> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const res = await fetch(`/api/admin/analytics?${qs.toString()}`);
  return handle<AnalyticsData>(res);
}

// ─── Admin: User management ───

export async function getUsers(): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users');
  return handle<AdminUser[]>(res);
}

export async function createUser(data: {
  username: string;
  password: string;
  displayName: string;
}): Promise<AdminUser> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<AdminUser>(res);
}

export async function updateUser(id: string, displayName: string): Promise<AdminUser> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  return handle<AdminUser>(res);
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  await handle<{ success: boolean; message: string }>(res);
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await handle<{ success: boolean; message: string }>(res);
}

// ─── Admin: Prompt templates ───

export interface PromptTemplate {
  id: string;
  name: string;
  campaignId?: string | null;
  campaign?: { name: string } | null;
  isDefault: boolean;
  promptText: string;
  negativePrompt?: string | null;
  requestBodyTemplate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateInput {
  name: string;
  campaignId?: string | null;
  isDefault?: boolean;
  promptText: string;
  negativePrompt?: string;
  requestBodyTemplate?: string;
  notes?: string;
}

export interface PromptPreviewInput {
  promptText: string;
  negativePrompt?: string;
  requestBodyTemplate?: string;
  gender: string;
  job: string;
  name: string;
}

export interface PromptPreviewResult {
  prompt: string;
  negativePrompt: string;
  requestBody: Record<string, any>;
  requestBodyError: string | null;
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch('/api/admin/prompts');
  return handle<PromptTemplate[]>(res);
}

export async function createPromptTemplate(data: PromptTemplateInput): Promise<PromptTemplate> {
  const res = await fetch('/api/admin/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<PromptTemplate>(res);
}

export async function updatePromptTemplate(
  id: string,
  data: Partial<PromptTemplateInput>,
): Promise<PromptTemplate> {
  const res = await fetch(`/api/admin/prompts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<PromptTemplate>(res);
}

export async function deletePromptTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
  await handle<{ success: boolean; message: string }>(res);
}

export async function previewPrompt(data: PromptPreviewInput): Promise<PromptPreviewResult> {
  const res = await fetch('/api/admin/prompts/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<PromptPreviewResult>(res);
}

// ─── Admin: Base Images ───

export interface BaseImage {
  id: string;
  job: string;
  gender: string;
  imageUrl: string;
  imagePath?: string | null;
  isActive: boolean;
  autoGenerated: boolean;
  campaignId?: string | null;
  campaign?: { id: string; name: string } | null;
  createdAt: string;
}

export interface BaseImageInput {
  job: string;
  gender: 'male' | 'female';
  imageUrl: string;
  campaignId?: string | null;
}

export async function getBaseImages(params?: {
  job?: string;
  gender?: string;
  campaignId?: string;
}): Promise<BaseImage[]> {
  const qs = new URLSearchParams();
  if (params?.job) qs.set('job', params.job);
  if (params?.gender) qs.set('gender', params.gender);
  if (params?.campaignId) qs.set('campaignId', params.campaignId);
  const res = await fetch(`/api/admin/base-images?${qs.toString()}`);
  return handle<BaseImage[]>(res);
}

export async function createBaseImage(data: BaseImageInput): Promise<BaseImage> {
  const res = await fetch('/api/admin/base-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<BaseImage>(res);
}

export async function updateBaseImage(
  id: string,
  data: Partial<{ job: string; gender: string; campaignId: string | null; isActive: boolean }>,
): Promise<BaseImage> {
  const res = await fetch(`/api/admin/base-images/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<BaseImage>(res);
}

export async function deleteBaseImage(id: string): Promise<void> {
  const res = await fetch(`/api/admin/base-images/${id}`, { method: 'DELETE' });
  await handle<{ success: boolean; message: string }>(res);
}

// ─── Admin: Face Swap Settings ───

export interface FaceSwapSettingsData {
  apiUrl: string;
  apiKey: string;
  model: string;
  configured: boolean;
  source: 'database' | 'env' | 'none';
}

export async function getFaceSwapSettings(): Promise<FaceSwapSettingsData> {
  const res = await fetch('/api/admin/face-swap-settings');
  return handle<FaceSwapSettingsData>(res);
}

export async function updateFaceSwapSettings(data: {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ apiUrl: string; apiKey: string; model: string }> {
  const res = await fetch('/api/admin/face-swap-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle(res);
}
