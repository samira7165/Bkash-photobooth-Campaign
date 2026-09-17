import sharp from 'sharp';
import path from 'path';
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

// Generic frame for custom "Other" careers — there's no way to pre-design
// one frame per arbitrary user-typed job title the way the 12 known careers
// each have their own, so every custom career shares this single career-
// agnostic design (public/others.png) instead. Composited the same way as
// the known-career frames below, plus a code-drawn "FUTURE {JOB}" + tagline
// layer underneath it (the frame artwork itself has no job-specific text),
// placed in the frame's one clear middle band so it doesn't collide with
// the frame's own script text/icons (upper third) or tag pills/big
// bottom headline (lower third).
const OTHERS_FRAME_PATH = path.join(process.cwd(), 'public', 'others.png');
const CUSTOM_CAREER_TAGLINE = 'DREAM BIG. A BRIGHTER TOMORROW.';

function customCareerTextLayer(job: string, width: number, height: number): Buffer {
  const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const displayJob = job.trim().length > 24 ? `${job.trim().slice(0, 24).trimEnd()}…` : job.trim();
  const headline = escapeXml(`FUTURE ${displayJob}`.toUpperCase());
  const bandCenterY = Math.round(height * 0.46);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="customCareerTextShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.65"/>
        </filter>
      </defs>
      <text x="${width / 2}" y="${bandCenterY}" font-family="sans-serif" font-size="${Math.round(width * 0.062)}" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1" filter="url(#customCareerTextShadow)">
        ${headline}
      </text>
      <text x="${width / 2}" y="${bandCenterY + Math.round(width * 0.038)}" font-family="sans-serif" font-size="${Math.round(width * 0.022)}" fill="#f1f5f9" text-anchor="middle" letter-spacing="1" filter="url(#customCareerTextShadow)">
        ${CUSTOM_CAREER_TAGLINE}
      </text>
    </svg>
  `;
  return Buffer.from(svg);
}

export async function frameGeneratedPhoto(photoPath: string, job: string): Promise<Buffer> {
  const knownFramePath = getDreamJobFrame(job);
  const framePath = knownFramePath || OTHERS_FRAME_PATH;
  const frame = await sharp(framePath).resize(OUTPUT_WIDTH, OUTPUT_HEIGHT).toBuffer();
  const overlays = knownFramePath
    ? [{ input: frame, left: 0, top: 0 }]
    : [
        { input: customCareerTextLayer(job, OUTPUT_WIDTH, OUTPUT_HEIGHT), left: 0, top: 0 },
        { input: frame, left: 0, top: 0 },
      ];
  // Fit the photo beneath the complete artwork without stretching the frame.
  // photoPath is normally the AI provider's output, written moments ago —
  // retry in case Windows still has it transiently locked (see fs-retry.ts).
  return withFileOpenRetry(`frameGeneratedPhoto:composite(${photoPath})`, () =>
    sharp(photoPath)
      .rotate()
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'cover', position: 'centre' })
      .composite(overlays)
      .png()
      .toBuffer(),
  );
}
