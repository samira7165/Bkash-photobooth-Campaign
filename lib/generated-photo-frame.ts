import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

const FRAMES: Record<string, string> = {
  doctor: 'doctor.png',
  engineer: 'engineer.png',
  footballer: 'Footballer.png',
  'professional gamer': 'gamer.png',
  gamer: 'gamer.png',
  journalist: 'Journalist.png',
  lawyer: 'lawyer.png',
  military: 'military-Photoroom.png',
  painter: 'painter.png',
  photographer: 'Photographer.png',
  pilot: 'pilot.png',
  scientist: 'scientist.png',
  singer: 'singer.png',
};

export function getDreamJobFrame(job: string): string | null {
  const key = job.trim().toLowerCase().replace(/[-_\s]+/g, ' ');
  const filename = Object.prototype.hasOwnProperty.call(FRAMES, key) ? FRAMES[key] : null;
  return filename ? path.join(process.cwd(), 'public', 'photo frame', filename) : null;
}

export async function frameGeneratedPhoto(photoPath: string, job: string): Promise<Buffer> {
  const framePath = getDreamJobFrame(job);
  if (!framePath) return fs.readFile(photoPath);

  const frame = await fs.readFile(framePath);
  const { width, height } = await sharp(frame).metadata();
  // Fit the photo beneath the complete artwork without stretching the frame.
  return sharp(photoPath)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .composite([{ input: frame, left: 0, top: 0 }])
    .png()
    .toBuffer();
}
