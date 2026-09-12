import sharp from 'sharp';
import path from 'path';
import { withFileOpenRetry } from './fs-retry';

// original-photo.png is a mostly-transparent decorative overlay (border,
// corner ornaments, logo/text) — not a solid card with a small photo cutout
// — so it belongs on top of a full-bleed photo, the same way the per-career
// frames in generated-photo-frame.ts work. 880x1208 matches the frame
// artwork's own inside/content area.
//
// Despite the name, callers now pass the AI-generated career photo here, not
// the raw captured one — this frame is the bKash-branded alternative to the
// per-career frame, both applied to the same generated image (see
// lib/queue.ts / lib/participant-queue.ts).
const CANVAS = { width: 880, height: 1208 };

export async function frameOriginalPhoto(photoPath: string): Promise<Buffer> {
  const frame = await sharp(path.join(process.cwd(), 'public', 'frames', 'original-photo.png'))
    .resize(CANVAS.width, CANVAS.height)
    .toBuffer();

  // photoPath is now the AI-generated photo, written moments ago — retry in
  // case Windows still has it transiently locked (see fs-retry.ts).
  const photo = await withFileOpenRetry(`frameOriginalPhoto(${photoPath})`, () =>
    sharp(photoPath)
      .rotate()
      .resize(CANVAS.width, CANVAS.height, {
        fit: 'cover',
        position: 'centre',
      })
      .flatten({ background: '#ffffff' })
      .toBuffer(),
  );

  return sharp(photo)
    .composite([{ input: frame, left: 0, top: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}
