import sharp from 'sharp';

export async function brandGeneratedPhoto(photoPath: string | Buffer, logoPath: string): Promise<Buffer> {
  const { data: photo, info } = await sharp(photoPath)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const logo = await sharp(logoPath)
    .trim()
    .resize({
      width: Math.max(1, Math.round(info.width * 0.18)),
      height: Math.max(1, Math.round(info.height * 0.1)),
      fit: 'inside',
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return sharp(photo)
    .composite([{
      input: logo.data,
      left: info.width - logo.info.width,
      top: 0,
    }])
    .jpeg({ quality: 95 })
    .toBuffer();
}
