// Shared by lib/ai-generation.ts (to pick which call* function to use) and
// lib/provider-manager.ts (to prefer a provider of a given kind for a given
// job — Gemini for the 12 known careers, OpenAI for custom "Other" jobs).
// Split out here since provider-manager.ts is imported by ai-generation.ts,
// so ai-generation.ts can't be the one exporting these without a cycle.

export const GEMINI_HOST = 'generativelanguage.googleapis.com';

export type ProviderKind = 'gemini' | 'replicate' | 'openai' | 'generic';

export function isGeminiUrl(apiUrl: string): boolean {
  return apiUrl.includes(GEMINI_HOST);
}

export function isReplicateUrl(apiUrl: string): boolean {
  return apiUrl.includes('replicate.com');
}

export function isOpenAiUrl(apiUrl: string): boolean {
  return apiUrl.includes('api.openai.com');
}

export function providerKind(apiUrl: string): ProviderKind {
  if (isGeminiUrl(apiUrl)) return 'gemini';
  if (isReplicateUrl(apiUrl)) return 'replicate';
  if (isOpenAiUrl(apiUrl)) return 'openai';
  return 'generic';
}
