import sharp from 'sharp';
import path from 'path';

// Coordinates of the white photo opening in the supplied 289 × 432 artwork.
// Render at 3× so the photo retains detail in the downloaded image.
const SCALE = 3;
const OPENING = { left: 15, top: 14, width: 259, height: 365 };

export async function frameOriginalPhoto(photoPath: string): Promise<Buffer> {
  const photo = await sharp(photoPath)
    .rotate()
    .resize(OPENING.width * SCALE, OPENING.height * SCALE, {
      fit: 'cover',
      position: 'centre',
    })
    .flatten({ background: '#ffffff' })
    .toBuffer();

  return sharp(path.join(process.cwd(), 'public', 'frames', 'original-photo.png'))
    .resize(289 * SCALE, 432 * SCALE)
    .composite([{ input: photo, left: OPENING.left * SCALE, top: OPENING.top * SCALE }])
    .jpeg({ quality: 95 })
    .toBuffer();
}
