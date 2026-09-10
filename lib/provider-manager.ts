import { AiProvider, SmsProvider } from '@prisma/client';
import prisma from './db';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_FAIL_THRESHOLD = 3;

function isOnCooldown(p: { failCount: number; lastFailAt: Date | null }): boolean {
  if (p.failCount < COOLDOWN_FAIL_THRESHOLD || !p.lastFailAt) return false;
  return Date.now() - p.lastFailAt.getTime() < COOLDOWN_MS;
}

// ─── AI Providers ───

export async function getNextAiProvider(): Promise<AiProvider | null> {
  const providers = await prisma.aiProvider.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });

  if (providers.length === 0) return null;

  const available = providers.filter((p) => !isOnCooldown(p));
  if (available.length > 0) return available[0];

  // All on cooldown — reset them and retry the highest priority one
  await prisma.aiProvider.updateMany({
    where: { id: { in: providers.map((p) => p.id) } },
    data: { failCount: 0, lastFailAt: null },
  });
  return providers[0];
}

export async function markAiProviderFailed(id: string, error: string): Promise<void> {
  const updated = await prisma.aiProvider.update({
    where: { id },
    data: { failCount: { increment: 1 }, lastFailAt: new Date() },
  });
  console.log(`[AI Fallback] Provider ${updated.name} failed (${updated.failCount}): ${error}`);
}

export async function markAiProviderSuccess(id: string): Promise<void> {
  await prisma.aiProvider.update({
    where: { id },
    data: { failCount: 0, lastUsedAt: new Date() },
  });
}

// ─── SMS Providers ───

export async function getNextSmsProvider(): Promise<SmsProvider | null> {
  const providers = await prisma.smsProvider.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });

  if (providers.length === 0) return null;

  const available = providers.filter((p) => !isOnCooldown(p));
  if (available.length > 0) return available[0];

  await prisma.smsProvider.updateMany({
    where: { id: { in: providers.map((p) => p.id) } },
    data: { failCount: 0, lastFailAt: null },
  });
  return providers[0];
}

export async function markSmsProviderFailed(id: string, error: string): Promise<void> {
  const updated = await prisma.smsProvider.update({
    where: { id },
    data: { failCount: { increment: 1 }, lastFailAt: new Date() },
  });
  console.log(`[SMS Fallback] Provider ${updated.name} failed (${updated.failCount}): ${error}`);
}

export async function markSmsProviderSuccess(id: string): Promise<void> {
  await prisma.smsProvider.update({
    where: { id },
    data: { failCount: 0, lastUsedAt: new Date() },
  });
}
