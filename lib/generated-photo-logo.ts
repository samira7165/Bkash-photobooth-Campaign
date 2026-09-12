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

  // Defensive: without flattening first, any transparent region in the input
  // (e.g. a future frame asset with a non-rectangular/rounded shape) would
  // otherwise be filled with black by Sharp's default JPEG encoding.
  //
  // Quality 80 + mozjpeg targets the ~300-800KB delivered size needed for
  // fast SMS/download-link loading on mobile, while staying well above the
  // point where face detail/skin texture visibly degrades — this is the
  // single final encode of the whole pipeline (the only lossy step besides
  // the intermediate normalizeOutputImage in lib/ai-generation.ts), so it's
  // not compounding quality loss across multiple JPEG re-encodes.
  return sharp(photo)
    .composite([{
      input: logo.data,
      left: info.width - logo.info.width,
      top: 0,
    }])
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();
}
