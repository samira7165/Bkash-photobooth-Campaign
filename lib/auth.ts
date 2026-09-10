import * as crypto from 'crypto';
import { NextRequest } from 'next/server';
import { AdminUser } from '@prisma/client';
import prisma from './db';

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const candidateBuf = Buffer.from(candidate, 'hex');
  if (hashBuf.length !== candidateBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, candidateBuf);
}

export async function createAdminSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.adminSession.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export async function validateAdminToken(token: string): Promise<AdminUser | null> {
  const session = await prisma.adminSession.findUnique({ where: { token } });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: session.userId } });
  return admin;
}

export async function destroyAdminSession(token: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { token } });
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const cookieToken = req.cookies.get('admin_token')?.value;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}
