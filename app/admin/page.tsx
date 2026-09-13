'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminUser,
  AnalyticsData,
  DashboardStats,
  EventData,
  ParticipantRow,
  ParticipantStats,
  ParticipantsResponse,
  PromptPreviewResult,
  PromptTemplate,
  PromptTemplateInput,
  Provider,
  ProviderInput,
  ProvidersResponse,
  QueueStatus,
  Submission,
  SubmissionsResponse,
  adminLogout,
  bulkDeleteSubmissions,
  createEvent,
  createPromptTemplate,
  createProvider,
  createUser,
  deleteParticipant,
  deletePromptTemplate,
  deleteProvider,
  deleteSubmission,
  deleteUser,
  exportCsvUrl,
  getAnalytics,
  getCurrentAdmin,
  getDashboardStats,
  getEvents,
  getParticipantStats,
  getParticipants,
  getProviders,
  getPromptTemplates,
  getQueueStatus,
  getSubmissions,
  getUsers,
  previewPrompt,
  regenerateParticipantImage,
  regenerateSubmission,
  resetProvider,
  resetUserPassword,
  updateEvent,
  updatePromptTemplate,
  updateProvider,
  updateUser,
} from '@/services/api';

// ═══════════════════════════════════════════════════════════
// Constants & helpers
// ═══════════════════════════════════════════════════════════

type Section =
  | 'dashboard'
  | 'analytics'
  | 'providers'
  | 'prompts'
  | 'submissions'
  | 'participants'
  | 'queue'
  | 'users';

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'providers', label: 'AI Providers' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'participants', label: 'Mobile Experience' },
  { id: 'queue', label: 'Queue Monitor' },
  { id: 'users', label: 'Users' },
];

// Read-only "client" role — sections beyond these are hidden here and
// blocked server-side (see lib/admin-guard.ts's `roles` option).
const CLIENT_ALLOWED_SECTIONS: Section[] = ['dashboard', 'analytics', 'submissions'];

const SECTION_TITLES: Record<Section, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  providers: 'AI Providers',
  prompts: 'Prompt Templates',
  submissions: 'Submissions',
  participants: 'Mobile Experience',
  queue: 'Queue Monitor',
  users: 'Users',
};

const JOB_OPTIONS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer', 'Other',
];

// Mirrors lib/prompt-builder.ts's getAvailableVariables() — duplicated here
// (rather than imported) since that file pulls in the Prisma client, which
// cannot be bundled into this client component. Used for the "Default"
// (12 known careers, Gemini) template — unaffected by the custom-job list below.
function getPromptVariables(): { variable: string; description: string; example: string }[] {
  return [
    { variable: '{{name}}', description: "User's name", example: 'Samira' },
    { variable: '{{gender}}', description: 'Raw gender value', example: 'male / female' },
    { variable: '{{genderWord}}', description: 'Man or Woman', example: 'man / woman' },
    { variable: '{{genderBoy}}', description: 'Boy or Girl', example: 'boy / girl' },
    { variable: '{{genderSubject}}', description: 'He or She', example: 'he / she' },
    { variable: '{{genderPossessive}}', description: 'His or Her', example: 'his / her' },
    { variable: '{{genderTitle}}', description: 'Mr or Ms', example: 'Mr / Ms' },
    { variable: '{{job}}', description: 'Selected dream job', example: 'Doctor' },
    { variable: '{{job_lower}}', description: 'Job in lowercase', example: 'doctor' },
    { variable: '{{job_uppercase}}', description: 'Job in uppercase', example: 'DOCTOR' },
    { variable: '{{job_clothing}}', description: 'Specific attire for the job', example: 'white doctor coat with stethoscope' },
    { variable: '{{job_surroundings}}', description: 'Specific environment for the job', example: 'modern hospital clinic' },
    { variable: '{{output_width}}', description: 'Fixed output canvas width in pixels', example: '1200' },
    { variable: '{{output_height}}', description: 'Fixed output canvas height in pixels', example: '1800' },
    { variable: '{{face_preservation_instruction}}', description: 'Strict instruction to keep user face and identity unchanged', example: 'Preserve the exact same person, face...' },
    { variable: '{{prompt}}', description: 'Resolved main prompt (request body only)', example: '' },
    { variable: '{{negativePrompt}}', description: 'Resolved negative prompt (request body only)', example: '' },
    { variable: '{{imageBase64}}', description: 'Base64 encoded user photo (request body only)', example: '' },
  ];
}

// Variable reference shown specifically when editing the custom "Other"
// career template (OpenAI path). Career-descriptive ones (tools, pose,
// tagline, features, bottom statement, color theme, frame, typography) are
// NOT literal substitution tokens — custom jobs are unbounded free text, so
// there's no lookup table for them. The template instead describes them in
// prose asking the model to compose each one based on {{job}}; typing the
// {{...}} form of these into the prompt text will NOT resolve to anything.
function getCustomJobPromptVariables(): { variable: string; description: string; example: string }[] {
  return [
    { variable: '{{name}}', description: "User's name", example: 'Samira' },
    { variable: '{{gender}}', description: 'Raw gender value', example: 'male / female' },
    { variable: '{{genderWord}}', description: 'Man or Woman', example: 'man / woman' },
    { variable: '{{job}}', description: 'Custom career as typed by the user', example: 'Chef, Architect, Astronaut' },
    { variable: '{{job_uppercase}}', description: 'Career in uppercase — for headline text', example: 'CHEF' },
    { variable: '{{job_lower}}', description: 'Career in lowercase', example: 'chef' },
    { variable: '{{job_clothing}}', description: 'Generic professional attire description', example: 'appropriate professional chef uniform, attire, and gear' },
    { variable: '{{job_surroundings}}', description: 'Generic professional environment description', example: 'a realistic, authentic professional workplace setting for a chef' },
    { variable: '{{professional_tools}}', description: 'AI-composed, not a literal token — describe in prose: "equip them with tools a real {{job}} would use"', example: 'stethoscope, blueprint, camera — decided per job by the AI' },
    { variable: '{{job_pose}}', description: 'AI-composed, not a literal token — describe in prose: "choose a pose that fits a {{job}}"', example: 'holding a whisk, standing at a drafting table — decided by the AI' },
    { variable: '{{career_tagline}}', description: 'AI-composed, not a literal token — ask the model to "compose an original 3-6 word tagline for {{job}}"', example: 'HEAL TODAY. SAVE TOMORROW.' },
    { variable: '{{feature_1}}', description: 'AI-composed, not a literal token — one of three short highlight phrases the model writes for {{job}}', example: 'MASTER YOUR SKILLS' },
    { variable: '{{feature_2}}', description: 'AI-composed, not a literal token', example: 'CREATE NEW POSSIBILITIES' },
    { variable: '{{feature_3}}', description: 'AI-composed, not a literal token', example: 'TURN PASSION INTO SUCCESS' },
    { variable: '{{bottom_statement_line_1}}', description: 'AI-composed, not a literal token — two-line motivational statement for {{job}}', example: 'TURN PASSION' },
    { variable: '{{bottom_statement_line_2}}', description: 'AI-composed, not a literal token', example: 'INTO IMPACT' },
    { variable: '{{career_color_theme}}', description: 'AI-composed, not a literal token — ask the model to "pick a palette that fits {{job}}"', example: 'clean medical blue and white for a doctor' },
    { variable: '{{frame_style}}', description: 'AI-composed, not a literal token — describe the frame directly in the FRAME section of the prompt', example: 'double-line white ornamental frame with corner ornaments' },
    { variable: '{{typography_style}}', description: 'AI-composed, not a literal token — describe type treatment directly where each text element is introduced', example: 'bold uppercase sans-serif with drop shadow' },
    { variable: '{{face_preservation_instruction}}', description: 'Strict instruction to keep user face and identity unchanged', example: 'Preserve the exact same person, face...' },
    { variable: '{{imageBase64}}', description: 'Base64 encoded user photo (request body only)', example: '' },
    { variable: '{{negativePrompt}}', description: 'Resolved negative prompt (request body only)', example: '' },
  ];
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'generated', label: 'Generated' },
  { value: 'sms_sent', label: 'SMS Sent' },
  { value: 'failed', label: 'Failed' },
];

const STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  job_selected: 'Job Selected',
  image_captured: 'Image Captured',
  queued: 'Queued',
  processing: 'Processing',
  generated: 'Generated',
  sms_sent: 'SMS Sent',
  failed: 'Failed',
};

const STATUS_HEX: Record<string, string> = {
  created: '#95a5a6',
  job_selected: '#95a5a6',
  image_captured: '#95a5a6',
  queued: '#f1c40f',
  processing: '#3498db',
  generated: '#2ecc71',
  sms_sent: '#1abc9c',
  failed: '#e74c3c',
};

const COOLDOWN_MS = 10 * 60 * 1000;

function downloadUrl(sessionId: string, type: 'original' | 'generated') {
  return `/api/images/download/${sessionId}/${type}`;
}

function triggerDownload(href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function duration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  if (ms < 1000) return '<1s';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function providerStatusColor(p: Provider): 'green' | 'yellow' | 'red' | 'grey' {
  if (!p.isActive) return 'grey';
  const onCooldown =
    p.failCount >= 3 &&
    !!p.lastFailAt &&
    Date.now() - new Date(p.lastFailAt).getTime() < COOLDOWN_MS;
  if (onCooldown) return 'red';
  if (p.failCount > 0) return 'yellow';
  return 'green';
}

interface ProviderFormState {
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  senderId: string;
  priority: string;
}

const EMPTY_PROVIDER_FORM: ProviderFormState = {
  name: '',
  apiUrl: '',
  apiKey: '',
  model: '',
  senderId: '',
  priority: '0',
};

type ConfirmAction =
  | { kind: 'submission'; type: 'single'; id: string }
  | { kind: 'submission'; type: 'bulk' }
  | { kind: 'participant'; id: string }
  | { kind: 'provider'; provider: Provider }
  | { kind: 'user'; user: AdminUser }
  | { kind: 'prompt'; template: PromptTemplate };

interface PromptFormState {
  name: string;
  isDefault: boolean;
  isDefaultForCustom: boolean;
  promptText: string;
  negativePrompt: string;
  requestBodyTemplate: string;
  notes: string;
}

const EMPTY_PROMPT_FORM: PromptFormState = {
  name: '',
  isDefault: false,
  isDefaultForCustom: false,
  promptText: '',
  negativePrompt: '',
  requestBodyTemplate: '',
  notes: '',
};

export default function AdminPage() {
  const router = useRouter();

  // ── Auth ──
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Shell ──
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const showError = useCallback((message: string) => showToast(message, 'error'), [showToast]);

  // ── Dashboard ──
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const loadDashStats = useCallback(async () => {
    try {
      setDashStats(await getDashboardStats());
    } catch (e: any) {
      showError(e.message || 'Failed to load dashboard stats');
    }
  }, [showError]);

  // ── Analytics ──
  const [analyticsFrom, setAnalyticsFrom] = useState(toDateInput(new Date(Date.now() - 6 * 86400000)));
  const [analyticsTo, setAnalyticsTo] = useState(toDateInput(new Date()));
  const [analyticsPreset, setAnalyticsPreset] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('7d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(
    async (from: string, to: string) => {
      setAnalyticsLoading(true);
      try {
        setAnalytics(await getAnalytics(from, to));
      } catch (e: any) {
        showError(e.message || 'Failed to load analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [showError],
  );

  function applyPreset(preset: 'today' | '7d' | '30d' | 'all') {
    setAnalyticsPreset(preset);
    const now = new Date();
    let from = new Date(0);
    if (preset === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === '7d') from = new Date(now.getTime() - 6 * 86400000);
    if (preset === '30d') from = new Date(now.getTime() - 29 * 86400000);
    const fromStr = preset === 'all' ? toDateInput(new Date(2020, 0, 1)) : toDateInput(from);
    const toStr = toDateInput(now);
    setAnalyticsFrom(fromStr);
    setAnalyticsTo(toStr);
    loadAnalytics(fromStr, toStr);
  }

  // ── Providers ──
  const [providers, setProviders] = useState<ProvidersResponse>({ ai: [], sms: [] });
  const [providerSubTab, setProviderSubTab] = useState<'ai' | 'sms'>('ai');
  const loadProviders = useCallback(async () => {
    try {
      setProviders(await getProviders());
    } catch (e: any) {
      showError(e.message || 'Failed to load providers');
    }
  }, [showError]);

  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(EMPTY_PROVIDER_FORM);
  const [providerFormSaving, setProviderFormSaving] = useState(false);

  function openCreateProviderForm() {
    setEditingProvider(null);
    setProviderForm(EMPTY_PROVIDER_FORM);
    setShowProviderForm(true);
  }
  function openEditProviderForm(p: Provider) {
    setEditingProvider(p);
    setProviderForm({
      name: p.name,
      apiUrl: p.apiUrl,
      apiKey: p.apiKey,
      model: p.model || '',
      senderId: p.senderId || '',
      priority: String(p.priority),
    });
    setShowProviderForm(true);
  }
  function closeProviderForm() {
    setShowProviderForm(false);
    setEditingProvider(null);
  }
  async function submitProviderForm(e: React.FormEvent) {
    e.preventDefault();
    if (!providerForm.name.trim() || !providerForm.apiUrl.trim() || !providerForm.apiKey.trim()) {
      showError('Name, API URL and API key are required');
      return;
    }
    setProviderFormSaving(true);
    try {
      const payload = {
        name: providerForm.name.trim(),
        apiUrl: providerForm.apiUrl.trim(),
        apiKey: providerForm.apiKey.trim(),
        priority: Number(providerForm.priority) || 0,
        ...(providerSubTab === 'ai'
          ? { model: providerForm.model.trim() }
          : { senderId: providerForm.senderId.trim() }),
      };
      if (editingProvider) {
        await updateProvider(editingProvider.id, payload);
      } else {
        await createProvider({ type: providerSubTab, ...payload } as ProviderInput);
      }
      closeProviderForm();
      await loadProviders();
      showToast(editingProvider ? 'Provider updated' : 'Provider added', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to save provider');
    } finally {
      setProviderFormSaving(false);
    }
  }
  async function toggleProviderActive(p: Provider) {
    try {
      await updateProvider(p.id, { isActive: !p.isActive } as any);
      await loadProviders();
    } catch (e: any) {
      showError(e.message || 'Failed to update provider');
    }
  }
  async function handleResetProvider(p: Provider) {
    try {
      await resetProvider(p.id);
      await loadProviders();
      showToast('Provider fails reset', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to reset provider');
    }
  }

  // ── Submissions ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchPhone, setSearchPhone] = useState('');
  const [exportGenderFilter, setExportGenderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [submissions, setSubmissions] = useState<SubmissionsResponse | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSubmission, setPreviewSubmission] = useState<Submission | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const data = await getSubmissions({
        status: statusFilter,
        search: searchPhone,
        page,
        limit: 20,
      });
      setSubmissions(data);
    } catch (e: any) {
      showError(e.message || 'Failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  }, [statusFilter, searchPhone, page, showError]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchPhone]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, searchPhone, page]);

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (!submissions || submissions.data.length === 0) return;
    setSelectedIds((prev) => {
      const allSelected = submissions.data.every((s) => prev.has(s.id));
      const next = new Set(prev);
      submissions.data.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  }
  function downloadBoth(s: Submission) {
    if (s.hasOriginalImage) triggerDownload(downloadUrl(s.id, 'original'));
    if (s.hasGeneratedImage) triggerDownload(downloadUrl(s.id, 'generated'));
  }

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  async function handleRegenerateSubmission(id: string) {
    setRegeneratingId(id);
    try {
      await regenerateSubmission(id);
      await loadSubmissions();
      showToast('Regeneration queued', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to queue regeneration');
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleRegenerateParticipant(id: string) {
    setRegeneratingId(id);
    try {
      await regenerateParticipantImage(id);
      await loadParticipants();
      showToast('Regeneration queued', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to queue regeneration');
    } finally {
      setRegeneratingId(null);
    }
  }

  // ── Participants (mobile QR experience) ──
  const [events, setEvents] = useState<EventData[]>([]);
  const loadEvents = useCallback(async () => {
    try {
      setEvents(await getEvents());
    } catch (e: any) {
      showError(e.message || 'Failed to load events');
    }
  }, [showError]);

  const [newEventName, setNewEventName] = useState('');
  const [newEventComicBook, setNewEventComicBook] = useState<File | null>(null);
  const [eventSaving, setEventSaving] = useState(false);

  async function submitNewEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEventName.trim()) {
      showError('Event name is required');
      return;
    }
    setEventSaving(true);
    try {
      await createEvent({ name: newEventName.trim(), isActive: true, comicBook: newEventComicBook || undefined });
      setNewEventName('');
      setNewEventComicBook(null);
      await loadEvents();
      showToast('Event created', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to create event');
    } finally {
      setEventSaving(false);
    }
  }

  async function toggleEventActive(ev: EventData) {
    try {
      await updateEvent(ev.id, { isActive: !ev.isActive });
      await loadEvents();
    } catch (e: any) {
      showError(e.message || 'Failed to update event');
    }
  }

  async function uploadEventComicBook(eventId: string, file: File) {
    try {
      await updateEvent(eventId, { comicBook: file });
      await loadEvents();
      showToast('Comic book updated', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to upload comic book');
    }
  }

  const [participantStats, setParticipantStats] = useState<ParticipantStats | null>(null);
  const loadParticipantStats = useCallback(async () => {
    try {
      setParticipantStats(await getParticipantStats());
    } catch (e: any) {
      showError(e.message || 'Failed to load participant stats');
    }
  }, [showError]);

  const [participantEventFilter, setParticipantEventFilter] = useState('all');
  const [participantGenderFilter, setParticipantGenderFilter] = useState('all');
  const [participantCareerFilter, setParticipantCareerFilter] = useState('all');
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantPage, setParticipantPage] = useState(1);
  const [participants, setParticipants] = useState<ParticipantsResponse | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(true);

  const loadParticipants = useCallback(async () => {
    setParticipantsLoading(true);
    try {
      const data = await getParticipants({
        eventId: participantEventFilter,
        gender: participantGenderFilter,
        career: participantCareerFilter,
        search: participantSearch,
        page: participantPage,
        limit: 20,
      });
      setParticipants(data);
    } catch (e: any) {
      showError(e.message || 'Failed to load participants');
    } finally {
      setParticipantsLoading(false);
    }
  }, [participantEventFilter, participantGenderFilter, participantCareerFilter, participantSearch, participantPage, showError]);

  useEffect(() => {
    setParticipantPage(1);
  }, [participantEventFilter, participantGenderFilter, participantCareerFilter, participantSearch]);

  // ── Queue monitor ──
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [queueRecent, setQueueRecent] = useState<Submission[]>([]);
  const loadQueueMonitor = useCallback(async () => {
    try {
      const [status, recent] = await Promise.all([
        getQueueStatus(),
        getSubmissions({ limit: 30 }),
      ]);
      setQueueStatus(status);
      setQueueRecent(
        recent.data.filter((s) => s.status !== 'created' && s.status !== 'job_selected').slice(0, 20),
      );
    } catch (e: any) {
      showError(e.message || 'Failed to load queue monitor');
    }
  }, [showError]);

  // ── Users ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const loadUsers = useCallback(async () => {
    try {
      setUsers(await getUsers());
    } catch (e: any) {
      showError(e.message || 'Failed to load users');
    }
  }, [showError]);

  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', displayName: '', password: '', confirmPassword: '', role: 'admin' as 'admin' | 'client' });
  const [userFormSaving, setUserFormSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'client'>('admin');
  const [resetPwUser, setResetPwUser] = useState<AdminUser | null>(null);
  const [resetPwForm, setResetPwForm] = useState({ password: '', confirmPassword: '' });
  const [resetPwSaving, setResetPwSaving] = useState(false);

  async function submitUserForm(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.displayName.trim()) {
      showError('Username and display name are required');
      return;
    }
    if (userForm.password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    if (userForm.password !== userForm.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    setUserFormSaving(true);
    try {
      await createUser({
        username: userForm.username.trim(),
        displayName: userForm.displayName.trim(),
        password: userForm.password,
        role: userForm.role,
      });
      setShowUserForm(false);
      setUserForm({ username: '', displayName: '', password: '', confirmPassword: '', role: 'admin' });
      await loadUsers();
      showToast('User created', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to create user');
    } finally {
      setUserFormSaving(false);
    }
  }
  async function submitEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (!editDisplayName.trim()) {
      showError('Display name is required');
      return;
    }
    try {
      await updateUser(editingUser.id, editDisplayName.trim(), editRole);
      setEditingUser(null);
      await loadUsers();
      showToast('User updated', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to update user');
    }
  }
  async function submitResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPwUser) return;
    if (resetPwForm.password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    if (resetPwForm.password !== resetPwForm.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    setResetPwSaving(true);
    try {
      await resetUserPassword(resetPwUser.id, resetPwForm.password);
      setResetPwUser(null);
      setResetPwForm({ password: '', confirmPassword: '' });
      showToast('Password updated', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to reset password');
    } finally {
      setResetPwSaving(false);
    }
  }

  // ── Prompt Templates ──
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const loadPromptTemplates = useCallback(async () => {
    try {
      setPromptTemplates(await getPromptTemplates());
    } catch (e: any) {
      showError(e.message || 'Failed to load prompt templates');
    }
  }, [showError]);

  const [showPromptForm, setShowPromptForm] = useState(false);
  const [editingPromptTemplate, setEditingPromptTemplate] = useState<PromptTemplate | null>(null);
  const [promptForm, setPromptForm] = useState<PromptFormState>(EMPTY_PROMPT_FORM);
  const [promptFormSaving, setPromptFormSaving] = useState(false);
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showRequestBody, setShowRequestBody] = useState(false);
  const [requestBodyJsonError, setRequestBodyJsonError] = useState('');

  const [previewGender, setPreviewGender] = useState<'male' | 'female'>('male');
  const [previewJob, setPreviewJob] = useState('Doctor');
  const [previewCustomJob, setPreviewCustomJob] = useState('');
  const [previewName, setPreviewName] = useState('Test User');
  const [previewResult, setPreviewResult] = useState<PromptPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  function openCreatePromptForm() {
    setEditingPromptTemplate(null);
    setPromptForm(EMPTY_PROMPT_FORM);
    setShowNegativePrompt(false);
    setShowRequestBody(false);
    setRequestBodyJsonError('');
    setPreviewResult(null);
    setShowPromptForm(true);
  }
  function openEditPromptForm(t: PromptTemplate) {
    setEditingPromptTemplate(t);
    setPromptForm({
      name: t.name,
      isDefault: t.isDefault,
      isDefaultForCustom: t.isDefaultForCustom,
      promptText: t.promptText,
      negativePrompt: t.negativePrompt || '',
      requestBodyTemplate: t.requestBodyTemplate || '',
      notes: t.notes || '',
    });
    setShowNegativePrompt(!!t.negativePrompt);
    setShowRequestBody(!!t.requestBodyTemplate);
    setRequestBodyJsonError('');
    setPreviewResult(null);
    setShowPromptForm(true);
  }
  function closePromptForm() {
    setShowPromptForm(false);
    setEditingPromptTemplate(null);
  }

  function validateRequestBodyJson(value: string) {
    if (!value.trim()) {
      setRequestBodyJsonError('');
      return;
    }
    try {
      JSON.parse(value);
      setRequestBodyJsonError('');
    } catch (e: any) {
      setRequestBodyJsonError(e.message || 'Invalid JSON');
    }
  }

  async function submitPromptForm(e: React.FormEvent) {
    e.preventDefault();
    if (!promptForm.name.trim() || !promptForm.promptText.trim()) {
      showError('Name and prompt text are required');
      return;
    }
    if (showRequestBody && promptForm.requestBodyTemplate.trim()) {
      try {
        JSON.parse(promptForm.requestBodyTemplate);
      } catch {
        showError('Custom request body must be valid JSON');
        return;
      }
    }
    setPromptFormSaving(true);
    try {
      const payload: PromptTemplateInput = {
        name: promptForm.name.trim(),
        isDefault: promptForm.isDefault,
        isDefaultForCustom: promptForm.isDefaultForCustom,
        promptText: promptForm.promptText.trim(),
        negativePrompt: showNegativePrompt ? promptForm.negativePrompt.trim() : '',
        requestBodyTemplate: showRequestBody ? promptForm.requestBodyTemplate.trim() : '',
        notes: promptForm.notes.trim(),
      };
      if (editingPromptTemplate) {
        await updatePromptTemplate(editingPromptTemplate.id, payload);
      } else {
        await createPromptTemplate(payload);
      }
      closePromptForm();
      await loadPromptTemplates();
      showToast(editingPromptTemplate ? 'Template updated' : 'Template created', 'success');
    } catch (e: any) {
      showError(e.message || 'Failed to save template');
    } finally {
      setPromptFormSaving(false);
    }
  }

  async function handlePreviewPrompt() {
    if (!promptForm.promptText.trim()) {
      showError('Enter a prompt first');
      return;
    }
    if (requestBodyJsonError) {
      showError('Fix the request body JSON first');
      return;
    }
    setPreviewLoading(true);
    try {
      const job = previewJob === 'Other' ? previewCustomJob.trim() || 'Other' : previewJob;
      const result = await previewPrompt({
        promptText: promptForm.promptText,
        negativePrompt: showNegativePrompt ? promptForm.negativePrompt : '',
        requestBodyTemplate: showRequestBody ? promptForm.requestBodyTemplate : '',
        gender: previewGender,
        job,
        name: previewName || 'Test User',
      });
      setPreviewResult(result);
    } catch (e: any) {
      showError(e.message || 'Failed to preview prompt');
    } finally {
      setPreviewLoading(false);
    }
  }


  // ── Confirm modal (shared) ──
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  async function handleConfirmed() {
    if (!confirmAction) return;
    try {
      if (confirmAction.kind === 'submission') {
        if (confirmAction.type === 'single') {
          await deleteSubmission(confirmAction.id);
          setSubmissions((prev) =>
            prev
              ? { ...prev, data: prev.data.filter((s) => s.id !== confirmAction.id), total: prev.total - 1 }
              : prev,
          );
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(confirmAction.id);
            return next;
          });
          showToast('Submission deleted', 'success');
        } else {
          const ids = Array.from(selectedIds);
          const result = await bulkDeleteSubmissions(ids);
          setSubmissions((prev) =>
            prev
              ? { ...prev, data: prev.data.filter((s) => !selectedIds.has(s.id)), total: prev.total - result.deleted }
              : prev,
          );
          setSelectedIds(new Set());
          showToast(`${result.deleted} submissions deleted`, 'success');
        }
      } else if (confirmAction.kind === 'participant') {
        await deleteParticipant(confirmAction.id);
        await loadParticipants();
        showToast('Participant deleted', 'success');
      } else if (confirmAction.kind === 'provider') {
        await deleteProvider(confirmAction.provider.id);
        await loadProviders();
        showToast('Provider deleted', 'success');
      } else if (confirmAction.kind === 'user') {
        await deleteUser(confirmAction.user.id);
        await loadUsers();
        showToast('User deleted', 'success');
      } else if (confirmAction.kind === 'prompt') {
        await deletePromptTemplate(confirmAction.template.id);
        await loadPromptTemplates();
        showToast('Template deleted', 'success');
      }
    } catch (e: any) {
      showError(e.message || 'Failed to delete');
    } finally {
      setConfirmAction(null);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    (async () => {
      try {
        const me = await getCurrentAdmin();
        setAdmin(me);
      } catch {
        router.push('/admin/login');
        return;
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [router]);

  // Defensive client-side guard — the real enforcement is server-side
  // (withAdminAuth's `roles` option), this just keeps the UI consistent.
  useEffect(() => {
    if (admin?.role === 'client' && !CLIENT_ALLOWED_SECTIONS.includes(section)) {
      setSection('dashboard');
    }
  }, [admin, section]);

  async function handleLogout() {
    try {
      await adminLogout();
    } catch {
      // ignore — redirect regardless
    }
    router.push('/admin/login');
  }

  useEffect(() => {
    if (!admin || section !== 'dashboard') return;
    loadDashStats();
    const id = setInterval(loadDashStats, 15_000);
    return () => clearInterval(id);
  }, [admin, section, loadDashStats]);

  useEffect(() => {
    if (!admin || section !== 'analytics') return;
    loadAnalytics(analyticsFrom, analyticsTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, section]);

  useEffect(() => {
    if (!admin || section !== 'providers') return;
    loadProviders();
  }, [admin, section, loadProviders]);

  useEffect(() => {
    if (!admin || section !== 'prompts') return;
    loadPromptTemplates();
  }, [admin, section, loadPromptTemplates]);

  useEffect(() => {
    if (!admin || section !== 'submissions') return;
    loadSubmissions();
  }, [admin, section, loadSubmissions]);

  useEffect(() => {
    if (!admin || section !== 'participants') return;
    loadEvents();
    loadParticipantStats();
  }, [admin, section, loadEvents, loadParticipantStats]);

  useEffect(() => {
    if (!admin || section !== 'participants') return;
    loadParticipants();
  }, [admin, section, loadParticipants]);

  useEffect(() => {
    if (!admin || section !== 'queue') return;
    loadQueueMonitor();
    const id = setInterval(loadQueueMonitor, 5_000);
    return () => clearInterval(id);
  }, [admin, section, loadQueueMonitor]);

  useEffect(() => {
    if (!admin || section !== 'users') return;
    loadUsers();
  }, [admin, section, loadUsers]);

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  if (!authChecked) {
    return (
      <div className="admin-auth-loading">
        <span className="spinner" />
      </div>
    );
  }
  if (!admin) return null;

  const totalPages = submissions ? Math.max(1, Math.ceil(submissions.total / submissions.limit)) : 1;
  const rangeFrom = submissions && submissions.total > 0 ? (submissions.page - 1) * submissions.limit + 1 : 0;
  const rangeTo = submissions ? Math.min(submissions.page * submissions.limit, submissions.total) : 0;

  const participantTotalPages = participants ? Math.max(1, Math.ceil(participants.total / participants.limit)) : 1;
  const participantRangeFrom = participants && participants.total > 0 ? (participants.page - 1) * participants.limit + 1 : 0;
  const participantRangeTo = participants ? Math.min(participants.page * participants.limit, participants.total) : 0;

  return (
    <div className="admin-shell">
      {toast && (
        <div className={`admin-toast ${toast.type === 'success' ? 'admin-toast-success' : ''}`}>
          {toast.message}
        </div>
      )}

      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-logo">
          <span className="admin-logo-text">Photobooth Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          {(admin.role === 'client' ? NAV_ITEMS.filter((item) => CLIENT_ALLOWED_SECTIONS.includes(item.id)) : NAV_ITEMS).map((item) => (
            <button
              key={item.id}
              className={`admin-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => {
                setSection(item.id);
                setSidebarOpen(false);
              }}
            >
              <span className="admin-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-sidebar-user">{admin.displayName}</span>
          <button className="admin-sidebar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content-topbar">
          <div className="admin-content-topbar-left">
            <button className="admin-hamburger" onClick={() => setSidebarOpen(true)}>
              Menu
            </button>
            <h1 className="admin-section-title">{SECTION_TITLES[section]}</h1>
          </div>
          <div className="admin-content-actions">
            {section === 'prompts' && (
              <button className="btn-primary admin-btn-inline" onClick={openCreatePromptForm}>
                + Create Template
              </button>
            )}
            {section === 'submissions' && (
              <>
                <select
                  className="admin-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input admin-search-input"
                  type="text"
                  placeholder="Search phone…"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
                <select
                  className="admin-select"
                  value={exportGenderFilter}
                  onChange={(e) => setExportGenderFilter(e.target.value)}
                  title="Gender filter for export"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <a
                  className="btn-secondary admin-btn-inline"
                  href={exportCsvUrl({ source: 'booth', gender: exportGenderFilter as any, status: statusFilter, search: searchPhone })}
                  title="Export booth submissions as CSV"
                >
                  Export Booth CSV
                </a>
                <a
                  className="btn-secondary admin-btn-inline"
                  href={exportCsvUrl({ source: 'all', gender: 'all' })}
                  title="Export every submission (booth + mobile) as CSV"
                >
                  Export All CSV
                </a>
              </>
            )}
            {section === 'participants' && (
              <>
                <select
                  className="admin-select"
                  value={participantEventFilter}
                  onChange={(e) => setParticipantEventFilter(e.target.value)}
                >
                  <option value="all">All Events</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
                <select
                  className="admin-select"
                  value={participantGenderFilter}
                  onChange={(e) => setParticipantGenderFilter(e.target.value)}
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <select
                  className="admin-select"
                  value={participantCareerFilter}
                  onChange={(e) => setParticipantCareerFilter(e.target.value)}
                >
                  <option value="all">All Careers</option>
                  {JOB_OPTIONS.filter((j) => j !== 'Other').map((job) => (
                    <option key={job} value={job}>{job}</option>
                  ))}
                </select>
                <input
                  className="admin-input admin-search-input"
                  type="text"
                  placeholder="Search phone…"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                />
                <a
                  className="btn-secondary admin-btn-inline"
                  href={exportCsvUrl({
                    source: 'mobile',
                    gender: participantGenderFilter as any,
                    eventId: participantEventFilter,
                    career: participantCareerFilter,
                    search: participantSearch,
                  })}
                  title="Export mobile submissions as CSV"
                >
                  Export Mobile CSV
                </a>
              </>
            )}
            {section === 'users' && (
              <button className="btn-primary admin-btn-inline" onClick={() => setShowUserForm(true)}>
                + Add User
              </button>
            )}
          </div>
        </div>

        {section === 'dashboard' && (
          <DashboardSection
            stats={dashStats}
            onViewAll={() => setSection('submissions')}
            restricted={admin.role === 'client'}
          />
        )}

        {section === 'analytics' && (
          <AnalyticsSection
            from={analyticsFrom}
            to={analyticsTo}
            preset={analyticsPreset}
            data={analytics}
            loading={analyticsLoading}
            onFromChange={(v) => {
              setAnalyticsFrom(v);
              setAnalyticsPreset('custom');
            }}
            onToChange={(v) => {
              setAnalyticsTo(v);
              setAnalyticsPreset('custom');
            }}
            onApply={() => loadAnalytics(analyticsFrom, analyticsTo)}
            onPreset={applyPreset}
          />
        )}

        {section === 'providers' && (
          <ProvidersSection
            providers={providers}
            subTab={providerSubTab}
            onSubTab={setProviderSubTab}
            onAdd={openCreateProviderForm}
            onEdit={openEditProviderForm}
            onToggle={toggleProviderActive}
            onReset={handleResetProvider}
            onDelete={(p) => setConfirmAction({ kind: 'provider', provider: p })}
          />
        )}

        {section === 'prompts' && (
          <PromptsSection
            templates={promptTemplates}
            onEdit={openEditPromptForm}
            onDelete={(t) => setConfirmAction({ kind: 'prompt', template: t })}
          />
        )}

        {section === 'submissions' && (
          <SubmissionsSection
            submissions={submissions}
            loading={submissionsLoading}
            selectedIds={selectedIds}
            page={page}
            totalPages={totalPages}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            onToggleRow={toggleSelectRow}
            onToggleAll={toggleSelectAll}
            onPreview={setPreviewSubmission}
            onLightbox={setLightboxSrc}
            onDownloadBoth={downloadBoth}
            onDeleteOne={(id) => setConfirmAction({ kind: 'submission', type: 'single', id })}
            onRegenerate={handleRegenerateSubmission}
            regeneratingId={regeneratingId}
            onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
            readOnly={admin.role === 'client'}
          />
        )}

        {section === 'participants' && (
          <ParticipantsSection
            stats={participantStats}
            events={events}
            newEventName={newEventName}
            newEventComicBook={newEventComicBook}
            eventSaving={eventSaving}
            onNewEventNameChange={setNewEventName}
            onNewEventComicBookChange={setNewEventComicBook}
            onSubmitNewEvent={submitNewEvent}
            onToggleEvent={toggleEventActive}
            participants={participants}
            participantsLoading={participantsLoading}
            participantPage={participantPage}
            participantTotalPages={participantTotalPages}
            participantRangeFrom={participantRangeFrom}
            participantRangeTo={participantRangeTo}
            onPrevPage={() => setParticipantPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setParticipantPage((p) => Math.min(participantTotalPages, p + 1))}
            onUploadEventComicBook={uploadEventComicBook}
            onRegenerate={handleRegenerateParticipant}
            regeneratingId={regeneratingId}
            onDeleteOne={(id) => setConfirmAction({ kind: 'participant', id })}
          />
        )}

        {section === 'queue' && <QueueMonitorSection status={queueStatus} recent={queueRecent} />}

        {section === 'users' && (
          <UsersSection
            users={users}
            currentAdminId={admin.id}
            onEdit={(u) => {
              setEditingUser(u);
              setEditDisplayName(u.displayName);
              setEditRole(u.role);
            }}
            onResetPassword={(u) => setResetPwUser(u)}
            onDelete={(u) => setConfirmAction({ kind: 'user', user: u })}
          />
        )}
      </main>

      {selectedIds.size > 0 && section === 'submissions' && admin.role !== 'client' && (
        <div className="admin-bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button
            className="admin-btn-solid-danger admin-btn-sm"
            onClick={() => setConfirmAction({ kind: 'submission', type: 'bulk' })}
          >
            Delete Selected
          </button>
        </div>
      )}

      {lightboxSrc && (
        <div className="admin-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Full size" />
        </div>
      )}

      {previewSubmission && (
        <div className="admin-modal-overlay" onClick={() => setPreviewSubmission(null)}>
          <div className="admin-modal admin-preview-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">{previewSubmission.name}</h2>
            <div className="admin-preview-images">
              <div className="admin-preview-col">
                <span className="admin-preview-col-label">Original</span>
                {previewSubmission.hasOriginalImage ? (
                  <img
                    className="admin-preview-img"
                    src={`/api/images/file/${previewSubmission.id}/original`}
                    alt="Original"
                  />
                ) : (
                  <div className="admin-thumb admin-thumb-placeholder" style={{ width: '100%', height: 140 }}>
                    —
                  </div>
                )}
              </div>
              <div className="admin-preview-col">
                <span className="admin-preview-col-label">Generated</span>
                {previewSubmission.hasGeneratedImage ? (
                  <img
                    className="admin-preview-img"
                    src={`/api/images/file/${previewSubmission.id}/generated`}
                    alt="Generated"
                  />
                ) : (
                  <div className="admin-thumb admin-thumb-placeholder" style={{ width: '100%', height: 140 }}>
                    —
                  </div>
                )}
              </div>
            </div>
            <div className="admin-preview-actions">
              {previewSubmission.hasOriginalImage && (
                <button
                  className="btn-secondary admin-btn-sm"
                  onClick={() => triggerDownload(downloadUrl(previewSubmission.id, 'original'))}
                >
                  Download Original
                </button>
              )}
              {previewSubmission.hasGeneratedImage && (
                <button
                  className="btn-secondary admin-btn-sm"
                  onClick={() => triggerDownload(downloadUrl(previewSubmission.id, 'generated'))}
                >
                  Download Generated
                </button>
              )}
              <button
                className="admin-delete-btn"
                onClick={() => {
                  const id = previewSubmission.id;
                  setPreviewSubmission(null);
                  setConfirmAction({ kind: 'submission', type: 'single', id });
                }}
              >
                Delete
              </button>
              <button className="btn-secondary admin-btn-sm" onClick={() => setPreviewSubmission(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showProviderForm && (
        <div className="admin-modal-overlay" onClick={closeProviderForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">
              {editingProvider
                ? `Edit ${providerSubTab === 'ai' ? 'AI' : 'SMS'} Provider`
                : `Add ${providerSubTab === 'ai' ? 'AI' : 'SMS'} Provider`}
            </h2>
            <form onSubmit={submitProviderForm}>
              <div className="field">
                <label>
                  Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>
                  API URL <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={providerForm.apiUrl}
                  onChange={(e) => setProviderForm((f) => ({ ...f, apiUrl: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>
                  API Key <span className="req">*</span>
                </label>
                <input
                  type="password"
                  value={providerForm.apiKey}
                  onChange={(e) => setProviderForm((f) => ({ ...f, apiKey: e.target.value }))}
                  required
                />
              </div>
              {providerSubTab === 'ai' ? (
                <div className="field">
                  <label>
                    Model <span className="opt">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={providerForm.model}
                    onChange={(e) => setProviderForm((f) => ({ ...f, model: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="field">
                  <label>
                    Sender ID <span className="opt">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={providerForm.senderId}
                    onChange={(e) => setProviderForm((f) => ({ ...f, senderId: e.target.value }))}
                  />
                </div>
              )}
              <div className="field">
                <label>
                  Priority <span className="opt">(lower = higher priority)</span>
                </label>
                <input
                  type="number"
                  value={providerForm.priority}
                  onChange={(e) => setProviderForm((f) => ({ ...f, priority: e.target.value }))}
                />
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={closeProviderForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary admin-btn-inline"
                  disabled={providerFormSaving}
                >
                  {providerFormSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {showPromptForm && (
        <div className="admin-modal-overlay" onClick={closePromptForm}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">{editingPromptTemplate ? 'Edit Prompt Template' : 'Create Prompt Template'}</h2>
            <form onSubmit={submitPromptForm}>
              <div className="field">
                <label>
                  Template Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={promptForm.name}
                  onChange={(e) => setPromptForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field admin-checkbox-field">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={promptForm.isDefault}
                    onChange={(e) => setPromptForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  />
                  Set as Default (12 known careers — Gemini)
                </label>
              </div>
              <div className="field admin-checkbox-field">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={promptForm.isDefaultForCustom}
                    onChange={(e) => setPromptForm((f) => ({ ...f, isDefaultForCustom: e.target.checked }))}
                  />
                  Set as Default for Custom &quot;Other&quot; Careers (OpenAI)
                </label>
              </div>

              <div className="field">
                <label>
                  Prompt <span className="req">*</span>
                </label>
                <textarea
                  className="admin-textarea admin-prompt-textarea"
                  rows={6}
                  value={promptForm.promptText}
                  onChange={(e) => setPromptForm((f) => ({ ...f, promptText: e.target.value }))}
                  placeholder="A professional portrait photo of a young {{genderWord}} working as a {{job}}, wearing appropriate {{job}} uniform, realistic, high quality"
                  required
                />
              </div>

              <div className="admin-variables-panel">
                <div className="admin-variables-title">
                  Available Variables {promptForm.isDefaultForCustom && '(Custom "Other" Career)'}
                </div>
                <div className="admin-variables-grid">
                  {(promptForm.isDefaultForCustom ? getCustomJobPromptVariables() : getPromptVariables()).map((v) => (
                    <div className="admin-variable-item" key={v.variable}>
                      <code className="admin-variable-code">{v.variable}</code>
                      <span className="admin-variable-desc">{v.description}</span>
                      {v.example && <span className="admin-variable-example">{v.example}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="admin-collapsible-toggle"
                onClick={() => setShowNegativePrompt((v) => !v)}
              >
                {showNegativePrompt ? '▾' : '▸'} {promptForm.negativePrompt ? 'Negative Prompt' : 'Add Negative Prompt'}
              </button>
              {showNegativePrompt && (
                <div className="field">
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={promptForm.negativePrompt}
                    onChange={(e) => setPromptForm((f) => ({ ...f, negativePrompt: e.target.value }))}
                    placeholder="blurry, low quality, distorted, deformed, watermark, text"
                  />
                </div>
              )}

              <button
                type="button"
                className="admin-collapsible-toggle"
                onClick={() => setShowRequestBody((v) => !v)}
              >
                {showRequestBody ? '▾' : '▸'} Customize API Request Body
              </button>
              {showRequestBody && (
                <div className="field">
                  <textarea
                    className="admin-textarea admin-json-textarea"
                    rows={7}
                    value={promptForm.requestBodyTemplate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPromptForm((f) => ({ ...f, requestBodyTemplate: value }));
                    }}
                    onBlur={(e) => validateRequestBodyJson(e.target.value)}
                    placeholder={'{\n  "prompt": "{{prompt}}",\n  "negative_prompt": "{{negativePrompt}}",\n  "image": "{{imageBase64}}",\n  "num_outputs": 1\n}'}
                  />
                  {requestBodyJsonError && <span className="err">{requestBodyJsonError}</span>}
                  <p className="admin-field-hint">
                    Customize the JSON body sent to the AI provider. Use {'{{prompt}}'}, {'{{negativePrompt}}'},
                    and {'{{imageBase64}}'} variables plus any provider-specific fields.
                  </p>
                </div>
              )}

              <div className="field">
                <label>
                  Notes <span className="opt">(optional)</span>
                </label>
                <input
                  type="text"
                  value={promptForm.notes}
                  onChange={(e) => setPromptForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="admin-preview-section">
                <div className="admin-preview-section-title">Live Preview</div>
                <div className="admin-preview-test-row">
                  <div className="gender-row" style={{ maxWidth: 220 }}>
                    <button
                      type="button"
                      className={`gender-btn ${previewGender === 'male' ? 'active' : ''}`}
                      onClick={() => setPreviewGender('male')}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      className={`gender-btn ${previewGender === 'female' ? 'active' : ''}`}
                      onClick={() => setPreviewGender('female')}
                    >
                      Female
                    </button>
                  </div>
                  <select
                    className="admin-select"
                    value={previewJob}
                    onChange={(e) => setPreviewJob(e.target.value)}
                  >
                    {JOB_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                  {previewJob === 'Other' && (
                    <input
                      className="admin-input"
                      type="text"
                      placeholder="Custom job"
                      value={previewCustomJob}
                      onChange={(e) => setPreviewCustomJob(e.target.value)}
                    />
                  )}
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="Test User"
                    value={previewName}
                    onChange={(e) => setPreviewName(e.target.value)}
                  />
                  <button type="button" className="btn-secondary admin-btn-sm" onClick={handlePreviewPrompt} disabled={previewLoading}>
                    {previewLoading ? 'Previewing…' : 'Preview Prompt'}
                  </button>
                </div>

                {previewResult && (
                  <div className="admin-preview-output">
                    <div className="admin-preview-output-label">Resolved Prompt</div>
                    <pre className="admin-code-block">{previewResult.prompt}</pre>
                    {previewResult.negativePrompt && (
                      <>
                        <div className="admin-preview-output-label">Resolved Negative Prompt</div>
                        <pre className="admin-code-block">{previewResult.negativePrompt}</pre>
                      </>
                    )}
                    {previewResult.requestBodyError && (
                      <span className="err">Request body template error: {previewResult.requestBodyError}</span>
                    )}
                    <div className="admin-preview-output-label">Request Body JSON</div>
                    <pre className="admin-code-block admin-code-block-scroll">
                      {JSON.stringify(previewResult.requestBody, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={closePromptForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary admin-btn-inline" disabled={promptFormSaving}>
                  {promptFormSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserForm && (
        <div className="admin-modal-overlay" onClick={() => setShowUserForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Add User</h2>
            <form onSubmit={submitUserForm}>
              <div className="field">
                <label>Username</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={userForm.displayName}
                  onChange={(e) => setUserForm((f) => ({ ...f, displayName: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={(e) => setUserForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  className="admin-select"
                  value={userForm.role}
                  onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value as 'admin' | 'client' }))}
                >
                  <option value="admin">Admin (full access)</option>
                  <option value="client">Client (read-only)</option>
                </select>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUserForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary admin-btn-inline" disabled={userFormSaving}>
                  {userFormSaving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="admin-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Edit User</h2>
            <form onSubmit={submitEditUser}>
              <div className="field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  className="admin-select"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'client')}
                >
                  <option value="admin">Admin (full access)</option>
                  <option value="client">Client (read-only)</option>
                </select>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary admin-btn-inline">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetPwUser && (
        <div className="admin-modal-overlay" onClick={() => setResetPwUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Reset Password — {resetPwUser.displayName}</h2>
            <form onSubmit={submitResetPassword}>
              <div className="field">
                <label>New Password</label>
                <input
                  type="password"
                  value={resetPwForm.password}
                  onChange={(e) => setResetPwForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={resetPwForm.confirmPassword}
                  onChange={(e) => setResetPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setResetPwUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary admin-btn-inline" disabled={resetPwSaving}>
                  {resetPwSaving ? 'Saving…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="admin-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Confirm Delete</h2>
            <p className="admin-confirm-text">{confirmMessage(confirmAction)}</p>
            <div className="admin-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button type="button" className="admin-btn-solid-danger" onClick={handleConfirmed}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function confirmMessage(action: ConfirmAction): string {
    if (action.kind === 'submission') {
      return action.type === 'single'
        ? 'Delete this submission? The original and generated images will be permanently removed.'
        : `Delete ${selectedIds.size} submissions? This cannot be undone.`;
    }
    if (action.kind === 'participant') {
      return 'Delete this participant? Their photos will be permanently removed.';
    }
    if (action.kind === 'provider') {
      return `Delete provider "${action.provider.name}"?`;
    }
    if (action.kind === 'prompt') {
      return `Delete template "${action.template.name}"?`;
    }
    return `Delete user "${action.user.displayName}"? This cannot be undone.`;
  }
}

// ═══════════════════════════════════════════════════════════
// Section components
// ═══════════════════════════════════════════════════════════

function DashboardSection({
  stats,
  onViewAll,
  restricted,
}: {
  stats: DashboardStats | null;
  onViewAll: () => void;
  restricted?: boolean;
}) {
  return (
    <>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.totalSessions ?? '—'}</div>
          <div className="admin-stat-label">Total Sessions</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.todaySessions ?? '—'}</div>
          <div className="admin-stat-label">Today&apos;s Sessions</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num success">{stats?.totalGenerations ?? '—'}</div>
          <div className="admin-stat-label">Total AI Generations</div>
        </div>
      </div>
      <div className="admin-stats-grid">
        {!restricted && (
          <>
            <div className="admin-stat-card">
              <div className="admin-stat-num warn">{stats?.queued ?? '—'}</div>
              <div className="admin-stat-label">In Queue</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-num info">{stats?.processing ?? '—'}</div>
              <div className="admin-stat-label">Processing Now</div>
            </div>
          </>
        )}
        <div className="admin-stat-card">
          <div className="admin-stat-num success">{stats?.smsSent ?? '—'}</div>
          <div className="admin-stat-label">SMS Sent</div>
        </div>
        {!restricted && (
          <div className="admin-stat-card">
            <div className="admin-stat-num danger">{stats?.failed ?? '—'}</div>
            <div className="admin-stat-label">Failed</div>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title">Recent Submissions</span>
          <button className="admin-view-all-link" onClick={onViewAll}>
            View All →
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Job</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {stats && stats.recent.length > 0 ? (
                stats.recent.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.phone}</td>
                    <td>{s.customJob || s.selectedJob || '—'}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${s.status}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td>{timeAgo(s.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="admin-empty-cell">
                    {stats ? 'No submissions yet' : 'Loading…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AnalyticsSection({
  from,
  to,
  preset,
  data,
  loading,
  onFromChange,
  onToChange,
  onApply,
  onPreset,
}: {
  from: string;
  to: string;
  preset: string;
  data: AnalyticsData | null;
  loading: boolean;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  onPreset: (p: 'today' | '7d' | '30d' | 'all') => void;
}) {
  const maxDaily = data ? Math.max(1, ...data.dailyCounts.map((d) => d.count)) : 1;
  const maxStatus = data ? Math.max(1, ...data.byStatus.map((d) => d.count)) : 1;
  const maxJob = data ? Math.max(1, ...data.byJob.map((d) => d.count)) : 1;

  return (
    <>
      <div className="admin-analytics-toolbar">
        <span className="admin-date-label">From</span>
        <input type="date" className="admin-input" value={from} onChange={(e) => onFromChange(e.target.value)} />
        <span className="admin-date-label">To</span>
        <input type="date" className="admin-input" value={to} onChange={(e) => onToChange(e.target.value)} />
        <button className="btn-secondary admin-btn-sm" onClick={onApply}>
          Apply
        </button>
        <div className="admin-preset-row">
          <button
            className={`admin-preset-btn ${preset === 'today' ? 'active' : ''}`}
            onClick={() => onPreset('today')}
          >
            Today
          </button>
          <button className={`admin-preset-btn ${preset === '7d' ? 'active' : ''}`} onClick={() => onPreset('7d')}>
            7 Days
          </button>
          <button className={`admin-preset-btn ${preset === '30d' ? 'active' : ''}`} onClick={() => onPreset('30d')}>
            30 Days
          </button>
          <button className={`admin-preset-btn ${preset === 'all' ? 'active' : ''}`} onClick={() => onPreset('all')}>
            All Time
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="admin-empty">Loading analytics…</div>
      ) : (
        <div className="admin-chart-grid">
          <div className="admin-chart-block">
            <div className="admin-chart-title">Sessions per Day</div>
            {data.dailyCounts.length === 0 ? (
              <div className="admin-empty">No sessions in this range</div>
            ) : (
              data.dailyCounts.map((d) => (
                <div className="admin-bar-row" key={d.date}>
                  <span className="admin-bar-label">{d.date}</span>
                  <div className="admin-bar-track">
                    <div
                      className="admin-bar-fill"
                      style={{ width: `${(d.count / maxDaily) * 100}%` }}
                    />
                  </div>
                  <span className="admin-bar-count">{d.count}</span>
                </div>
              ))
            )}
          </div>

          <div className="admin-chart-block">
            <div className="admin-chart-title">Sessions by Status</div>
            {data.byStatus.length === 0 ? (
              <div className="admin-empty">No sessions in this range</div>
            ) : (
              data.byStatus.map((d) => (
                <div className="admin-bar-row" key={d.status}>
                  <span className="admin-bar-label">{STATUS_LABELS[d.status] || d.status}</span>
                  <div className="admin-bar-track">
                    <div
                      className="admin-bar-fill"
                      style={{
                        width: `${(d.count / maxStatus) * 100}%`,
                        background: STATUS_HEX[d.status] || '#6c5ce7',
                      }}
                    />
                  </div>
                  <span className="admin-bar-count">{d.count}</span>
                </div>
              ))
            )}
          </div>

          <div className="admin-chart-block">
            <div className="admin-chart-title">Sessions by Job</div>
            {data.byJob.length === 0 ? (
              <div className="admin-empty">No sessions in this range</div>
            ) : (
              data.byJob.map((d) => (
                <div className="admin-bar-row" key={d.job}>
                  <span className="admin-bar-label">{d.job}</span>
                  <div className="admin-bar-track">
                    <div className="admin-bar-fill" style={{ width: `${(d.count / maxJob) * 100}%` }} />
                  </div>
                  <span className="admin-bar-count">{d.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ProvidersSection({
  providers,
  subTab,
  onSubTab,
  onAdd,
  onEdit,
  onToggle,
  onReset,
  onDelete,
}: {
  providers: ProvidersResponse;
  subTab: 'ai' | 'sms';
  onSubTab: (t: 'ai' | 'sms') => void;
  onAdd: () => void;
  onEdit: (p: Provider) => void;
  onToggle: (p: Provider) => void;
  onReset: (p: Provider) => void;
  onDelete: (p: Provider) => void;
}) {
  const list = subTab === 'ai' ? providers.ai : providers.sms;

  return (
    <>
      <div className="admin-info-banner">
        Providers are tried in priority order (lowest number = highest priority). If a
        provider fails 3 times within 10 minutes, it&apos;s automatically skipped. Use
        &quot;Reset&quot; to retry a failed provider.
      </div>

      <div className="admin-content-topbar">
        <div className="admin-subtabs">
          <button
            className={`admin-subtab ${subTab === 'ai' ? 'active' : ''}`}
            onClick={() => onSubTab('ai')}
          >
            AI Providers
          </button>
          <button
            className={`admin-subtab ${subTab === 'sms' ? 'active' : ''}`}
            onClick={() => onSubTab('sms')}
          >
            SMS Providers
          </button>
        </div>
        <button className="btn-primary admin-btn-inline" onClick={onAdd}>
          + Add {subTab === 'ai' ? 'AI' : 'SMS'} Provider
        </button>
      </div>

      {list.length === 0 ? (
        <div className="admin-empty">No {subTab === 'ai' ? 'AI' : 'SMS'} providers configured — using .env fallback</div>
      ) : (
        <div className="admin-provider-grid">
          {list.map((p) => {
            const color = providerStatusColor(p);
            return (
              <div className="admin-provider-card" key={p.id}>
                <div className="admin-provider-top">
                  <span className={`admin-status-dot admin-status-${color}`} title={color} />
                  <span className="admin-provider-name">{p.name}</span>
                  <button
                    className={`admin-toggle-switch ${p.isActive ? 'on' : ''}`}
                    onClick={() => onToggle(p)}
                    title={p.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                  >
                    <span className="admin-toggle-knob" />
                  </button>
                </div>
                <div className="admin-provider-url" title={p.apiUrl}>
                  {p.apiUrl}
                </div>
                {subTab === 'ai' && p.model && <div className="admin-provider-meta">Model: {p.model}</div>}
                {subTab === 'sms' && p.senderId && (
                  <div className="admin-provider-meta">Sender: {p.senderId}</div>
                )}
                <div className="admin-provider-meta">
                  <span className="admin-priority-badge">Priority: {p.priority}</span>
                </div>
                <div className="admin-provider-meta">
                  Fails:{' '}
                  <span className={p.failCount > 0 ? 'admin-fail-count' : ''}>{p.failCount}</span>
                  {p.failCount > 0 && (
                    <button className="btn-secondary admin-btn-sm" onClick={() => onReset(p)}>
                      Reset
                    </button>
                  )}
                </div>
                <div className="admin-provider-meta">
                  Last used: {p.lastUsedAt ? timeAgo(p.lastUsedAt) : 'never'}
                </div>
                <div className="admin-provider-actions">
                  <button className="btn-secondary admin-btn-sm" onClick={() => onEdit(p)}>
                    Edit
                  </button>
                  <button className="btn-secondary admin-btn-sm admin-btn-danger" onClick={() => onDelete(p)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PromptsSection({
  templates,
  onEdit,
  onDelete,
}: {
  templates: PromptTemplate[];
  onEdit: (t: PromptTemplate) => void;
  onDelete: (t: PromptTemplate) => void;
}) {
  if (templates.length === 0) {
    return <div className="admin-empty">Loading…</div>;
  }

  return (
    <div className="admin-campaign-grid">
      {templates.map((t) => (
        <div className="admin-campaign-card" key={t.id}>
          <div className="admin-campaign-top">
            <span className="admin-campaign-name">{t.name}</span>
            {t.isDefault && <span className="admin-default-badge">DEFAULT</span>}
            {t.isDefaultForCustom && <span className="admin-default-badge">DEFAULT (CUSTOM)</span>}
          </div>
          <div className="admin-campaign-desc">
            {t.promptText.length > 100 ? `${t.promptText.slice(0, 100)}…` : t.promptText}
          </div>
          <div className="admin-provider-meta">
            Negative prompt: {t.negativePrompt ? '✓' : '✗'}
          </div>
          <div className="admin-provider-meta">
            Custom request body: {t.requestBodyTemplate ? '✓' : '✗'}
          </div>
          <div className="admin-provider-meta">Updated {new Date(t.updatedAt).toLocaleDateString()}</div>
          <div className="admin-campaign-actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn-secondary admin-btn-sm" onClick={() => onEdit(t)}>
              Edit
            </button>
            <button className="btn-secondary admin-btn-sm admin-btn-danger" onClick={() => onDelete(t)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


function SubmissionsSection({
  submissions,
  loading,
  selectedIds,
  page,
  totalPages,
  rangeFrom,
  rangeTo,
  onToggleRow,
  onToggleAll,
  onPreview,
  onLightbox,
  onDownloadBoth,
  onDeleteOne,
  onRegenerate,
  regeneratingId,
  onPrevPage,
  onNextPage,
  readOnly,
}: {
  submissions: SubmissionsResponse | null;
  loading: boolean;
  selectedIds: Set<string>;
  page: number;
  totalPages: number;
  rangeFrom: number;
  rangeTo: number;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onPreview: (s: Submission) => void;
  onLightbox: (src: string) => void;
  onDownloadBoth: (s: Submission) => void;
  onDeleteOne: (id: string) => void;
  onRegenerate: (id: string) => void;
  regeneratingId: string | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  readOnly?: boolean;
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {!readOnly && (
                <th>
                  <input
                    type="checkbox"
                    className="admin-checkbox"
                    checked={!!submissions && submissions.data.length > 0 && submissions.data.every((s) => selectedIds.has(s.id))}
                    onChange={onToggleAll}
                  />
                </th>
              )}
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Dream Job</th>
              <th>College</th>
              <th>Status</th>
              <th>Original</th>
              <th>Generated</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions && submissions.data.length > 0 ? (
              submissions.data.map((s, i) => (
                <tr key={s.id}>
                  {!readOnly && (
                    <td>
                      <input
                        type="checkbox"
                        className="admin-checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => onToggleRow(s.id)}
                      />
                    </td>
                  )}
                  <td>{(submissions.page - 1) * submissions.limit + i + 1}</td>
                  <td>{s.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{s.phone}</td>
                  <td>{s.gender === 'male' ? 'Male' : 'Female'}</td>
                  <td>{s.customJob || s.selectedJob || '—'}</td>
                  <td>{s.college || '—'}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${s.status}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-thumb-cell">
                      {s.hasOriginalImage ? (
                        <>
                          <img
                            className="admin-thumb"
                            src={`/api/images/file/${s.id}/original`}
                            alt="Original"
                            onClick={() => onLightbox(`/api/images/file/${s.id}/original`)}
                          />
                          <a
                            className="admin-dl-btn"
                            href={downloadUrl(s.id, 'original')}
                            download
                            title="Download original"
                          >
                            ↓
                          </a>
                        </>
                      ) : (
                        <div className="admin-thumb admin-thumb-placeholder">—</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="admin-thumb-cell">
                      {s.hasGeneratedImage ? (
                        <>
                          <img
                            className="admin-thumb"
                            src={`/api/images/file/${s.id}/generated`}
                            alt="Generated"
                            onClick={() => onLightbox(`/api/images/file/${s.id}/generated`)}
                          />
                          <a
                            className="admin-dl-btn"
                            href={downloadUrl(s.id, 'generated')}
                            download
                            title="Download generated"
                          >
                            ↓
                          </a>
                        </>
                      ) : (
                        <div className="admin-thumb admin-thumb-placeholder">—</div>
                      )}
                    </div>
                  </td>
                  <td>{timeAgo(s.createdAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="btn-secondary admin-btn-sm" onClick={() => onPreview(s)}>
                        Preview
                      </button>
                      <button
                        className="admin-dl-btn"
                        style={{ width: 'auto', padding: '0 0.5rem' }}
                        onClick={() => onDownloadBoth(s)}
                        disabled={!s.hasOriginalImage && !s.hasGeneratedImage}
                        title="Download both images"
                      >
                        ↓↓
                      </button>
                      {!readOnly && s.status === 'failed' && (
                        <button
                          className="btn-secondary admin-btn-sm"
                          onClick={() => onRegenerate(s.id)}
                          disabled={regeneratingId === s.id}
                          title="Retry image generation"
                        >
                          {regeneratingId === s.id ? 'Queuing…' : 'Regenerate'}
                        </button>
                      )}
                      {!readOnly && (
                        <button className="admin-delete-btn" onClick={() => onDeleteOne(s.id)} title="Delete submission">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={readOnly ? 11 : 12} className="admin-empty-cell">
                  {loading ? 'Loading…' : 'No submissions yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {submissions && submissions.total > 0 && (
        <div className="admin-pagination">
          <span>
            Showing {rangeFrom}-{rangeTo} of {submissions.total}
          </span>
          <button className="btn-secondary admin-btn-sm" disabled={page <= 1} onClick={onPrevPage}>
            Prev
          </button>
          <span className="admin-page-info">
            Page {page} of {totalPages}
          </span>
          <button className="btn-secondary admin-btn-sm" disabled={page >= totalPages} onClick={onNextPage}>
            Next
          </button>
        </div>
      )}
    </>
  );
}

function ParticipantsSection({
  stats,
  events,
  newEventName,
  newEventComicBook,
  eventSaving,
  onNewEventNameChange,
  onNewEventComicBookChange,
  onSubmitNewEvent,
  onToggleEvent,
  participants,
  participantsLoading,
  participantPage,
  participantTotalPages,
  participantRangeFrom,
  participantRangeTo,
  onPrevPage,
  onNextPage,
  onUploadEventComicBook,
  onRegenerate,
  regeneratingId,
  onDeleteOne,
}: {
  stats: ParticipantStats | null;
  events: EventData[];
  newEventName: string;
  newEventComicBook: File | null;
  eventSaving: boolean;
  onNewEventNameChange: (v: string) => void;
  onNewEventComicBookChange: (f: File | null) => void;
  onSubmitNewEvent: (e: React.FormEvent) => void;
  onToggleEvent: (ev: EventData) => void;
  participants: ParticipantsResponse | null;
  participantsLoading: boolean;
  participantPage: number;
  participantTotalPages: number;
  participantRangeFrom: number;
  participantRangeTo: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onUploadEventComicBook: (eventId: string, file: File) => Promise<void>;
  onRegenerate: (id: string) => void;
  regeneratingId: string | null;
  onDeleteOne: (id: string) => void;
}) {
  const [uploadingComicBookFor, setUploadingComicBookFor] = useState<string | null>(null);

  const handleComicBookFileChange = async (eventId: string, file: File | null) => {
    if (!file) return;
    setUploadingComicBookFor(eventId);
    try {
      await onUploadEventComicBook(eventId, file);
    } finally {
      setUploadingComicBookFor(null);
    }
  };

  return (
    <>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.totalParticipants ?? '—'}</div>
          <div className="admin-stat-label">Total Participants</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num success">{stats?.totalCompletedImages ?? '—'}</div>
          <div className="admin-stat-label">Completed Images</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num info">{stats?.totalDownloads ?? '—'}</div>
          <div className="admin-stat-label">Total Downloads</div>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.totalOtpSent ?? '—'}</div>
          <div className="admin-stat-label">Total OTP Sent</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num success">{stats?.otpVerified ?? '—'}</div>
          <div className="admin-stat-label">Successful OTP Verification</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num danger">{stats?.otpFailed ?? '—'}</div>
          <div className="admin-stat-label">Failed OTP Attempts</div>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-num info">{stats?.totalQrScans ?? '—'}</div>
          <div className="admin-stat-label">QR Code Scans</div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-panel-head">
          <span className="admin-panel-title">QR Code Scans by Code</span>
        </div>
        {!stats?.byQrCode?.length ? (
          <p style={{ color: '#8a8f9c', fontSize: '0.85rem', margin: 0 }}>
            No scans recorded yet. Point a printed code at{' '}
            <code>{'https://livebeats.online/?qr=<code>'}</code> and each visit is counted here.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Scans</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {stats.byQrCode.map((row) => (
                <tr key={row.code}>
                  <td><code>{row.code}</code></td>
                  <td>{row.count}</td>
                  <td>
                    {stats.totalQrScans > 0
                      ? `${Math.round((row.count / stats.totalQrScans) * 100)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-panel" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-panel-head">
          <span className="admin-panel-title">Events</span>
        </div>

        <form onSubmit={onSubmitNewEvent} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            className="admin-input"
            type="text"
            placeholder="New event name…"
            value={newEventName}
            onChange={(e) => onNewEventNameChange(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: '#8a8f9c' }}>
            Comic Book PDF (optional)
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onNewEventComicBookChange(e.target.files?.[0] || null)}
              style={{ maxWidth: 220 }}
            />
          </label>
          <button type="submit" className="btn-primary admin-btn-inline" disabled={eventSaving}>
            {eventSaving ? 'Creating…' : '+ Create Event'}
          </button>
        </form>

        {events.length === 0 ? (
          <div className="admin-empty">No events yet — create one above to start the mobile experience.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Active</th>
                  <th>Comic Book</th>
                  <th>Participants</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.name}</td>
                    <td>
                      <button
                        className={`admin-toggle-switch ${ev.isActive ? 'on' : ''}`}
                        onClick={() => onToggleEvent(ev)}
                        title={ev.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                      >
                        <span className="admin-toggle-knob" />
                      </button>
                    </td>
                    <td>
                      <label className="admin-btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
                        {uploadingComicBookFor === ev.id
                          ? 'Uploading…'
                          : ev.hasComicBook ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept="application/pdf"
                          style={{ display: 'none' }}
                          disabled={uploadingComicBookFor === ev.id}
                          onChange={(e) => handleComicBookFileChange(ev.id, e.target.files?.[0] || null)}
                        />
                      </label>
                    </td>
                    <td>{ev.participantCount}</td>
                    <td>{new Date(ev.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Career</th>
              <th>College</th>
              <th>Event</th>
              <th>Status</th>
              <th>Downloads</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {participants && participants.data.length > 0 ? (
              participants.data.map((p: ParticipantRow) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{p.phone}</td>
                  <td>{p.gender === 'male' ? 'Male' : 'Female'}</td>
                  <td>{p.career}</td>
                  <td>{p.college || '—'}</td>
                  <td>{p.eventName}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${p.processingStatus}`}>
                      {STATUS_LABELS[p.processingStatus] || p.processingStatus}
                    </span>
                  </td>
                  <td>{p.downloadCount}</td>
                  <td>{timeAgo(p.createdAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      {p.processingStatus === 'failed' && (
                        <button
                          className="btn-secondary admin-btn-sm"
                          onClick={() => onRegenerate(p.id)}
                          disabled={regeneratingId === p.id}
                          title="Retry image generation"
                        >
                          {regeneratingId === p.id ? 'Queuing…' : 'Regenerate'}
                        </button>
                      )}
                      <button className="admin-delete-btn" onClick={() => onDeleteOne(p.id)} title="Delete participant">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="admin-empty-cell">
                  {participantsLoading ? 'Loading…' : 'No participants yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {participants && participants.total > 0 && (
        <div className="admin-pagination">
          <span>
            Showing {participantRangeFrom}-{participantRangeTo} of {participants.total}
          </span>
          <button className="btn-secondary admin-btn-sm" disabled={participantPage <= 1} onClick={onPrevPage}>
            Prev
          </button>
          <span className="admin-page-info">
            Page {participantPage} of {participantTotalPages}
          </span>
          <button className="btn-secondary admin-btn-sm" disabled={participantPage >= participantTotalPages} onClick={onNextPage}>
            Next
          </button>
        </div>
      )}
    </>
  );
}

function QueueMonitorSection({ status, recent }: { status: QueueStatus | null; recent: Submission[] }) {
  return (
    <>
      <div className="admin-stats-grid-5">
        <div className="admin-stat-card">
          <div className="admin-stat-num warn">{status?.queued ?? '—'}</div>
          <div className="admin-stat-label">Queued</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num info">
            {status?.processing ?? '—'}
            {!!status?.processing && <span className="admin-pulse-dot" />}
          </div>
          <div className="admin-stat-label">Processing</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num success">{status?.generated ?? '—'}</div>
          <div className="admin-stat-label">Generated</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num" style={{ color: '#1abc9c' }}>
            {status?.smsSent ?? '—'}
          </div>
          <div className="admin-stat-label">SMS Sent</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num danger">{status?.failed ?? '—'}</div>
          <div className="admin-stat-label">Failed</div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title">Recent Queue Activity</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Job</th>
                <th>Status</th>
                <th>Time</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {recent.length > 0 ? (
                recent.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.customJob || s.selectedJob || '—'}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${s.status}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td>{timeAgo(s.createdAt)}</td>
                    <td>
                      {s.status === 'sms_sent' || s.status === 'generated' || s.status === 'failed'
                        ? duration(s.createdAt, s.updatedAt)
                        : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="admin-empty-cell">
                    No recent queue activity
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function UsersSection({
  users,
  currentAdminId,
  onEdit,
  onResetPassword,
  onDelete,
}: {
  users: AdminUser[];
  currentAdminId: string;
  onEdit: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}) {
  if (users.length === 0) {
    return <div className="admin-empty">Loading…</div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Display Name</th>
            <th>Role</th>
            <th>Last Login</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.displayName}</td>
              <td>
                <span className={`admin-badge ${u.role === 'client' ? 'admin-badge-queued' : 'admin-badge-generated'}`}>
                  {u.role === 'client' ? 'Client (read-only)' : 'Admin'}
                </span>
              </td>
              <td>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</td>
              <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <div className="admin-row-actions">
                  <button className="btn-secondary admin-btn-sm" onClick={() => onEdit(u)}>
                    Edit
                  </button>
                  <button className="btn-secondary admin-btn-sm" onClick={() => onResetPassword(u)}>
                    Reset Password
                  </button>
                  {u.id !== currentAdminId && (
                    <button className="btn-secondary admin-btn-sm admin-btn-danger" onClick={() => onDelete(u)}>
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
