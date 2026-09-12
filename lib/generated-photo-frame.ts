import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from './output-size';
import { withFileOpenRetry } from './fs-retry';

const FRAMES: Record<string, string> = {
  doctor: 'doctor.png',
  engineer: 'engineer.png',
  footballer: 'Footballer.png',
  'professional gamer': 'professional_gamer.png',
  gamer: 'professional_gamer.png',
  journalist: 'Journalist.png',
  lawyer: 'lawyer.png',
  military: 'military.png',
  painter: 'future_painter.png',
  photographer: 'Photographer.png',
  pilot: 'pilot.png',
  scientist: 'future_Scientist.png',
  singer: 'singer.png',
};

export function getDreamJobFrame(job: string): string | null {
  const key = job.trim().toLowerCase().replace(/[-_\s]+/g, ' ');
  const filename = Object.prototype.hasOwnProperty.call(FRAMES, key) ? FRAMES[key] : null;
  return filename ? path.join(process.cwd(), 'public', 'photo frame', filename) : null;
}

export async function frameGeneratedPhoto(photoPath: string, job: string): Promise<Buffer> {
  const framePath = getDreamJobFrame(job);
  // photoPath is normally the AI provider's output, written moments ago —
  // retry in case Windows still has it transiently locked (see fs-retry.ts).
  if (!framePath) return withFileOpenRetry(`frameGeneratedPhoto:read(${photoPath})`, () => fs.readFile(photoPath));

  const frame = await sharp(framePath).resize(OUTPUT_WIDTH, OUTPUT_HEIGHT).toBuffer();
  // Fit the photo beneath the complete artwork without stretching the frame.
  return withFileOpenRetry(`frameGeneratedPhoto:composite(${photoPath})`, () =>
    sharp(photoPath)
      .rotate()
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'cover', position: 'centre' })
      .composite([{ input: frame, left: 0, top: 0 }])
      .png()
      .toBuffer(),
  );
}
