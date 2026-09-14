export interface SessionData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  college?: string;
  gender: string;
  selectedJob?: string;
  customJob?: string;
  status: string;
}

export async function createSession(data: {
  name: string;
  phone: string;
  email?: string;
  college?: string;
  gender: string;
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

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

const UPLOAD_RETRY_ATTEMPTS = 3;
const UPLOAD_RETRY_DELAY_MS = 1500;

/**
 * Retries a fetch on genuine network failure (dropped connection, DNS hiccup,
 * offline) — never on a real response from the server, since a 4xx/5xx is a
 * definitive answer, not a transient failure to retry.
 */
async function fetchWithNetworkRetry(input: RequestInfo, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < UPLOAD_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (attempt < UPLOAD_RETRY_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function uploadImage(
  sessionId: string,
  imageBlob: Blob,
): Promise<SessionData> {
  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');
  // Safe to retry without an idempotency key — the session route always
  // updates the same existing session row rather than creating a new one.
  const res = await fetchWithNetworkRetry(`/api/sessions/${sessionId}/image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to upload image');
  }
  return res.json();
}

// ─── Mobile QR Experience (Journey 1) ───

export async function getActiveEvent(): Promise<{ id: string; name: string } | null> {
  const res = await fetch('/api/events/active');
  return handle(res);
}

export async function checkAlreadyParticipated(phone: string): Promise<boolean> {
  const qs = new URLSearchParams({ phone });
  const res = await fetch(`/api/participants/check-phone?${qs.toString()}`);
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.alreadyParticipated;
}

export async function checkSessionPhoneAlreadyUsed(phone: string): Promise<boolean> {
  const qs = new URLSearchParams({ phone });
  const res = await fetch(`/api/sessions/check-phone?${qs.toString()}`);
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.alreadyUsed;
}

export async function requestParticipantOtp(phone: string): Promise<void> {
  const res = await fetch('/api/participants/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  await handle(res);
}

export async function createParticipant(data: {
  name: string;
  phone: string;
  email?: string;
  college?: string;
  gender: string;
  career: string;
  customCareer?: string;
  eventId: string;
}): Promise<{ participantId: string }> {
  const res = await fetch('/api/participants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function uploadParticipantImage(
  participantId: string,
  imageBlob: Blob,
): Promise<{ imageId: string }> {
  // One id for the whole upload attempt (including retries) — the server
  // uses it to recognize a retried request and return the already-created
  // image instead of creating a duplicate (which would mean a second
  // generation and a second notification SMS).
  const clientRequestId = crypto.randomUUID();
  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');
  formData.append('clientRequestId', clientRequestId);
  const res = await fetchWithNetworkRetry(`/api/participants/${participantId}/image`, {
    method: 'POST',
    body: formData,
  });
  return handle(res);
}

export interface ParticipantStatus {
  processingStatus: string;
  errorMessage?: string | null;
}

export async function getParticipantStatus(participantId: string): Promise<ParticipantStatus> {
  const res = await fetch(`/api/participants/${participantId}/status`);
  return handle(res);
}

// ─── Download Portal (Journey 2) — phone-number lookup, no link tokens ───

export async function requestDownloadOtp(phone: string): Promise<void> {
  const res = await fetch(`/api/download/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  await handle(res);
}

/**
 * Ask the server whether this browser already proved it owns `phone` (the
 * long-lived cookie set when the code was last verified — including during
 * registration on the index page). Resolves true when the server issued a
 * fresh download session, false when an OTP is still required.
 */
export async function resumeDownloadSession(phone: string): Promise<boolean> {
  const res = await fetch(`/api/download/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
    credentials: 'include',
  });
  if (res.status === 401) return false; // expected: this browser must do the OTP
  await handle(res);
  return true;
}

export async function verifyDownloadOtp(phone: string, otp: string): Promise<void> {
  const res = await fetch(`/api/download/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });
  await handle(res);
}

export interface DownloadSubmission {
  name: string;
  career: string;
  id: string;
  label: string;
  originalUrl: string | null;
  aiUrl: string | null;
  comicBookUrl: string | null;
  processingStatus: string;
  createdAt: string;
}

export async function getDownloadGallery(): Promise<{ submissions: DownloadSubmission[] }> {
  const res = await fetch(`/api/download/gallery`, { credentials: 'include' });
  return handle(res);
}

// ─── Admin: Events ───

export interface EventData {
  id: string;
  name: string;
  isActive: boolean;
  hasComicBook: boolean;
  participantCount: number;
  createdAt: string;
}

export async function getEvents(): Promise<EventData[]> {
  const res = await fetch('/api/admin/events');
  return handle(res);
}

export async function createEvent(data: { name: string; isActive?: boolean; comicBook?: File }): Promise<EventData> {
  const fd = new FormData();
  fd.append('name', data.name);
  if (data.isActive !== undefined) fd.append('isActive', String(data.isActive));
  if (data.comicBook) fd.append('pdf', data.comicBook);
  const res = await fetch('/api/admin/events', { method: 'POST', body: fd });
  return handle(res);
}

export async function updateEvent(
  id: string,
  data: { name?: string; isActive?: boolean; comicBook?: File },
): Promise<EventData> {
  const fd = new FormData();
  if (data.name !== undefined) fd.append('name', data.name);
  if (data.isActive !== undefined) fd.append('isActive', String(data.isActive));
  if (data.comicBook) fd.append('pdf', data.comicBook);
  const res = await fetch(`/api/admin/events/${id}`, { method: 'PUT', body: fd });
  return handle(res);
}

// ─── Admin: Participants ───

export interface ParticipantRow {
  id: string;
  name: string;
  phone: string;
  gender: string;
  career: string;
  college?: string | null;
  eventName: string;
  processingStatus: string;
  downloadCount: number;
  comicDownloadCount: number;
  hasOriginalImage: boolean;
  hasGeneratedImage: boolean;
  createdAt: string;
}

export interface ParticipantsResponse {
  data: ParticipantRow[];
  total: number;
  page: number;
  limit: number;
}

export async function getParticipants(params: {
  eventId?: string;
  gender?: string;
  career?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ParticipantsResponse> {
  const qs = new URLSearchParams();
  if (params.eventId) qs.set('eventId', params.eventId);
  if (params.gender) qs.set('gender', params.gender);
  if (params.career) qs.set('career', params.career);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`/api/admin/participants?${qs.toString()}`);
  return handle(res);
}

export interface ParticipantStats {
  totalParticipants: number;
  totalCompletedImages: number;
  totalDownloads: number;
  totalComicDownloads: number;
  totalOtpSent: number;
  otpVerified: number;
  otpFailed: number;
  totalQrScans: number;
  byQrCode: { code: string; count: number }[];
  byEvent: { eventId: string; eventName: string; count: number }[];
}

/**
 * Record a scan of a printed QR code. Fire-and-forget: a failed beacon must
 * never interrupt someone trying to use the experience, so callers ignore
 * the result and this never throws.
 */
export async function recordQrScan(code: string): Promise<void> {
  try {
    await fetch('/api/qr-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      keepalive: true,
    });
  } catch {
    /* analytics only — never surfaced to the visitor */
  }
}

export async function getParticipantStats(): Promise<ParticipantStats> {
  const res = await fetch('/api/admin/participants/stats');
  return handle(res);
}

// ─── Admin: Submissions ───

export interface Submission {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  college?: string | null;
  gender: string;
  selectedJob?: string | null;
  customJob?: string | null;
  status: string;
  hasOriginalImage: boolean;
  hasGeneratedImage: boolean;
  downloadCount: number;
  comicDownloadCount: number;
  smsSent: boolean;
  errorMessage?: string | null;
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
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<SubmissionsResponse> {
  const qs = new URLSearchParams();
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

export async function getQueueStatus(): Promise<QueueStatus> {
  const res = await fetch('/api/admin/queue-status');
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
  role: 'admin' | 'client';
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

export async function regenerateSubmission(id: string): Promise<void> {
  const res = await fetch(`/api/admin/submissions/${id}/regenerate`, { method: 'POST' });
  await handle(res);
}

export async function regenerateParticipantImage(id: string): Promise<void> {
  const res = await fetch(`/api/admin/participants/${id}/regenerate`, { method: 'POST' });
  await handle(res);
}

export async function deleteParticipant(id: string): Promise<void> {
  const res = await fetch(`/api/admin/participants/${id}`, { method: 'DELETE' });
  await handle<{ success: boolean; message: string }>(res);
}

// ─── Admin: CSV export ───
// Not a fetch — this is a direct file download, so callers just point a
// link/window navigation at this URL (the admin_token cookie authenticates
// it same as any other admin page load).
export function exportCsvUrl(params: {
  source?: 'all' | 'booth' | 'mobile';
  gender?: 'all' | 'male' | 'female';
  status?: string;
  search?: string;
  eventId?: string;
  career?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.source) qs.set('source', params.source);
  if (params.gender) qs.set('gender', params.gender);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.eventId) qs.set('eventId', params.eventId);
  if (params.career) qs.set('career', params.career);
  return `/api/admin/export?${qs.toString()}`;
}

// ─── Admin: Dashboard stats ───

export interface RecentSubmission {
  id: string;
  name: string;
  phone: string;
  selectedJob?: string | null;
  customJob?: string | null;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSessions: number;
  todaySessions: number;
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
  role?: 'admin' | 'client';
}): Promise<AdminUser> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle<AdminUser>(res);
}

export async function updateUser(id: string, displayName: string, role?: 'admin' | 'client'): Promise<AdminUser> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, role }),
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
  isDefault: boolean;
  isDefaultForCustom: boolean;
  promptText: string;
  negativePrompt?: string | null;
  requestBodyTemplate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateInput {
  name: string;
  isDefault?: boolean;
  isDefaultForCustom?: boolean;
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
  createdAt: string;
}

export interface BaseImageInput {
  job: string;
  gender: 'male' | 'female';
  imageUrl: string;
}

export async function getBaseImages(params?: {
  job?: string;
  gender?: string;
}): Promise<BaseImage[]> {
  const qs = new URLSearchParams();
  if (params?.job) qs.set('job', params.job);
  if (params?.gender) qs.set('gender', params.gender);
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
  data: Partial<{ job: string; gender: string; isActive: boolean }>,
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
