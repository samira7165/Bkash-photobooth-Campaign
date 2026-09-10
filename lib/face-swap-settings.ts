import prisma from './db';

const SINGLETON_ID = 'singleton';

export interface FaceSwapSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
}

/** Resolves effective face-swap settings — DB row (set from the admin dashboard) takes priority, falls back to .env, null if no key is configured anywhere (demo mode). */
export async function getFaceSwapSettings(): Promise<FaceSwapSettings | null> {
  const row = await prisma.faceSwapSettings.findUnique({ where: { id: SINGLETON_ID } });

  const apiKey = row?.apiKey || process.env.FACE_SWAP_API_KEY || '';
  if (!apiKey) return null;

  const apiUrl = row?.apiUrl || process.env.FACE_SWAP_API_URL || 'https://api.replicate.com/v1/predictions';
  const model = row?.model || process.env.FACE_SWAP_MODEL || 'codeplugtech/face-swap';

  return { apiUrl, apiKey, model };
}

export async function getRawFaceSwapRow() {
  return prisma.faceSwapSettings.findUnique({ where: { id: SINGLETON_ID } });
}

export async function upsertFaceSwapSettings(data: {
  apiUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
}) {
  return prisma.faceSwapSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}
