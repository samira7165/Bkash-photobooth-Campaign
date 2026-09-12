import * as fs from 'fs';
import * as path from 'path';
import { frameOriginalPhoto } from './original-photo-frame';
import { frameGeneratedPhoto } from './generated-photo-frame';
import { brandGeneratedPhoto } from './generated-photo-logo';

// The framed/branded output never changes once produced, but computing it
// (Sharp decode + resize + composite, twice for the "ai" image) is real CPU
// work best done once — either right after generation, or lazily on first
// view — rather than on every single view/download request.

function renderedDir(): string {
  const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'rendered');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function renderOriginal(cacheKey: string, originalImagePath: string): Promise<string> {
  const buffer = await frameOriginalPhoto(originalImagePath);
  const outPath = path.join(renderedDir(), `${cacheKey}_original.jpg`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

export async function renderBrandedGenerated(cacheKey: string, generatedImagePath: string, job: string): Promise<string> {
  const framed = await frameGeneratedPhoto(generatedImagePath, job);
  const buffer = await brandGeneratedPhoto(framed, path.join(process.cwd(), 'public', 'logos', 'Logo.png'));
  const outPath = path.join(renderedDir(), `${cacheKey}_generated.jpg`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}
