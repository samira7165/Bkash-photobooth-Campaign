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
// agnostic design (public/others.png) instead. The known-career frames each
// have "FUTURE {JOB}" + a tagline baked into their own artwork across the
// top; others.png has no job baked in (it's generic), so a matching
// code-drawn version is composited on top of it in that same top band —
// on top of the frame, not under it, since the frame's own top-left script
// text/icons sit there too and the job title needs to win that space.
const OTHERS_FRAME_PATH = path.join(process.cwd(), 'public', 'others.png');
const CUSTOM_CAREER_TAGLINE = 'DREAM BIG. A BRIGHTER TOMORROW.';

function customCareerTextLayer(job: string, width: number, height: number): Buffer {
  const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Longer job titles need a smaller size to avoid running off the canvas —
  // a fixed font size (tuned against a short word like "Astronaut")
  // overflowed badly on something like "Fashion Designer". Solve backwards
  // from a safe max width instead of guessing a size. The job name gets its
  // own line (below the fixed word "FUTURE"), so it gets the full width
  // budget rather than sharing one line with "FUTURE ".
  const displayJob = job.trim().length > 30 ? `${job.trim().slice(0, 30).trimEnd()}…` : job.trim();
  const jobLine = escapeXml(displayJob.toUpperCase());
  const maxLineWidth = width * 0.82;
  const AVG_CHAR_WIDTH_RATIO = 0.68; // bold uppercase sans-serif, approximate
  const jobFontSize = Math.min(
    Math.round(width * 0.08),
    Math.floor(maxLineWidth / (jobLine.length * AVG_CHAR_WIDTH_RATIO)),
  );
  const futureFontSize = Math.round(width * 0.055);
  const taglineFontSize = Math.round(width * 0.022);
  const futureY = Math.round(height * 0.048);
  const jobY = futureY + Math.round(jobFontSize * 1.05);
  const taglineY = jobY + Math.round(taglineFontSize * 2.2);

  // others.png has its own script text/icons starting almost immediately
  // below the top border, so the job title needs a solid backing band —
  // otherwise the text and the frame's own artwork just visually clash
  // instead of the title cleanly winning that space.
  const bandTop = Math.round(height * 0.018);
  const bandBottom = taglineY + Math.round(taglineFontSize * 1.6);
  const bandInset = Math.round(width * 0.035);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="customCareerGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${Math.round(width * 0.006)}" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="customCareerBand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0b1b3a;stop-opacity:0.92" />
          <stop offset="100%" style="stop-color:#0b1b3a;stop-opacity:0.8" />
        </linearGradient>
      </defs>
      <rect x="${bandInset}" y="${bandTop}" width="${width - bandInset * 2}" height="${bandBottom - bandTop}" rx="18" fill="url(#customCareerBand)"/>
      <text x="${width / 2}" y="${futureY}" font-family="sans-serif" font-size="${futureFontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging" letter-spacing="6" filter="url(#customCareerGlow)">
        FUTURE
      </text>
      <text x="${width / 2}" y="${jobY}" font-family="sans-serif" font-size="${jobFontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="hanging" letter-spacing="1" filter="url(#customCareerGlow)">
        ${jobLine}
      </text>
      <text x="${width / 2}" y="${taglineY}" font-family="sans-serif" font-size="${taglineFontSize}" font-weight="bold" fill="#e6f0ff" text-anchor="middle" dominant-baseline="hanging" letter-spacing="1" filter="url(#customCareerGlow)">
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
        { input: frame, left: 0, top: 0 },
        { input: customCareerTextLayer(job, OUTPUT_WIDTH, OUTPUT_HEIGHT), left: 0, top: 0 },
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
