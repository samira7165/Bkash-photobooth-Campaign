import sharp from 'sharp';

export async function brandGeneratedPhoto(photoPath: string, logoPath: string): Promise<Buffer> {
  const { data: photo, info } = await sharp(photoPath)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const margin = Math.round(Math.min(info.width, info.height) * 0.025);
  const logo = await sharp(logoPath)
    .resize({
      width: Math.max(1, Math.round(info.width * 0.24)),
      height: Math.max(1, Math.round(info.height * 0.2)),
      fit: 'inside',
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return sharp(photo)
    .composite([{
      input: logo.data,
      left: info.width - logo.info.width - margin,
      top: margin,
    }])
    .jpeg({ quality: 95 })
    .toBuffer();
}
