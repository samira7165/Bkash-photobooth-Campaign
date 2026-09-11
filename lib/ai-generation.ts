import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import sharp from 'sharp';
import {
  getNextAiProvider,
  markAiProviderFailed,
  markAiProviderSuccess,
} from './provider-manager';
import { buildPrompt, BuiltPrompt } from './prompt-builder';
import { findOverlayForJob } from './overlay-compositor';

const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 1800;

/**
 * Prompt used when an admin-uploaded reference poster exists for this job.
 * The AI receives the reference image + the user's photo and is instructed
 * to preserve the reference's design/text exactly, only generating the
 * background and placing the person into it.
 */
function buildReferencePosterPrompt(job: string): string {
  return `You are generating a photorealistic "Dream Career" poster.

I am providing two images:
1. REFERENCE POSTER — the exact design template you MUST preserve. Keep the frame, all text, logos, colors, and layout EXACTLY as shown — do not change, translate, misspell, move, resize, or omit any text or design element from it.
2. USER PHOTO — the person who must appear in the poster. Preserve their exact facial features, skin tone, hairstyle, ethnicity, and age with the highest possible accuracy. The person must be immediately recognizable as the same individual from this photo.

Task: Recreate the reference poster exactly as-is, but place the person from the user photo naturally into the scene as a professional ${job}, dressed appropriately for that role. You may generate or adjust the background/scene behind them to fit a realistic ${job} setting, but the poster's frame, text, and design elements must remain identical to the reference.

RULES:
- Reproduce ALL text from the reference EXACTLY — same wording, same spelling, same position.
- The person's face must be pixel-accurate to the user photo — same identity, unmistakably recognizable.
- Show them naturally framed within the reference's composition.
- Photorealistic, professional photography lighting, natural skin texture, sharp focus, high resolution.
- Output must be exactly ${POSTER_WIDTH}x${POSTER_HEIGHT} pixels, vertical 2:3 portrait format.
- Do not add any watermark, signature, or extra text beyond what's in the reference.`;
}

interface GenerateParams {
  originalImagePath: string;
  job: string;
  gender: string;
  name?: string;
}

const GEMINI_HOST = 'generativelanguage.googleapis.com';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-exp-image-generation';

function isGeminiUrl(apiUrl: string): boolean {
  return apiUrl.includes(GEMINI_HOST);
}

function isReplicateUrl(apiUrl: string): boolean {
  return apiUrl.includes('replicate.com');
}

function isOpenAiUrl(apiUrl: string): boolean {
  return apiUrl.includes('api.openai.com');
}

function mimeTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return map[ext] || 'image/jpeg';
}

function extForMimeType(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[mime] || '.png';
}

/**
 * Demo mode fallback helper — creates an attractive photobooth preview
 * with dream job badge and user photo when no API provider is configured.
 */
async function generateDemoImage(
  sourcePath: string,
  outputPath: string,
  job: string,
  userName?: string,
): Promise<string> {
  const original = await sharp(sourcePath).resize(800, 800, { fit: 'cover' }).toBuffer();
  const meta = await sharp(original).metadata();
  const width = meta.width || 800;
  const height = meta.height || 800;

  const escapedJob = job.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').toUpperCase();
  const escapedUser = userName
    ? userName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : '';
  const title = `DREAM JOB: ${escapedJob}`;
  const subtitle = escapedUser ? `Prepared for ${escapedUser}` : 'AI Photobooth Preview';

  const svgBanner = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0);stop-opacity:0" />
          <stop offset="40%" style="stop-color:rgba(15,23,42,0.6);stop-opacity:0.6" />
          <stop offset="100%" style="stop-color:rgba(15,23,42,0.95);stop-opacity:0.95" />
        </linearGradient>
      </defs>
      <rect x="0" y="${height - 180}" width="${width}" height="180" fill="url(#grad)"/>
      <text x="${width / 2}" y="${height - 90}" font-family="sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">
        ${title}
      </text>
      <text x="${width / 2}" y="${height - 50}" font-family="sans-serif" font-size="18" fill="#e2e8f0" text-anchor="middle">
        ${subtitle}
      </text>
    </svg>
  `;

  await sharp(original)
    .composite([{ input: Buffer.from(svgBanner), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  console.log(`[AI Demo] Generated demo preview image saved: ${outputPath}`);
  return outputPath;
}

/**
 * Generate the user's dream job photo via a direct image-to-image pipeline:
 * Takes the user's captured photo and prompt, and transforms the user's
 * clothes and surroundings into their dream job while preserving their real face.
 * Returns the raw AI (or demo) photo — no overlay composited yet.
 */
async function generateRawPhoto(params: GenerateParams, referenceImagePath: string | null): Promise<string> {
  const { originalImagePath, job, gender, name } = params;

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const generatedDir = path.join(uploadDir, 'generated');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const outputPath = path.join(generatedDir, `generated_${uuidv4()}.png`);

  console.log(`[AI] Generating dream job image for job="${job}" gender="${gender}" name="${name || 'Anonymous'}"`);

  if (!fs.existsSync(originalImagePath)) {
    throw new Error(`Original user image not found at path: ${originalImagePath}`);
  }

  // Read the original user photo as base64
  const imageBuffer = fs.readFileSync(originalImagePath);
  const base64Image = imageBuffer.toString('base64');

  // Build the face-preserving prompt specifically engineered for dream job transformation
  const built = await buildPrompt(
    {
      name: name || '',
      gender,
      job,
    },
    base64Image,
  );

  // When a reference poster exists for this job, Gemini/OpenAI get a
  // dedicated two-image prompt instead — the reference's design/text is
  // preserved exactly, only the background + person are generated.
  const referencePrompt = referenceImagePath ? buildReferencePosterPrompt(job) : null;

  console.log(`[AI] Prompt template: "${built.templateName}"`);
  console.log(`[AI] Prompt: ${referencePrompt || built.prompt}`);
  if (built.negativePrompt) {
    console.log(`[AI] Negative prompt: ${built.negativePrompt}`);
  }
  if (referenceImagePath) {
    console.log(`[AI] Using reference poster: ${referenceImagePath}`);
  }

  const maxAttempts = 5;
  let lastError = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const provider = await getNextAiProvider();

    if (!provider) {
      const envUrl = process.env.AI_API_URL;
      const envKey = process.env.AI_API_KEY;

      if (!envUrl || !envKey) {
        console.warn('[AI] No active AI provider or .env credentials configured — creating demo photobooth preview');
        return await generateDemoImage(originalImagePath, outputPath, job, name);
      }

      try {
        console.log(`[AI] Attempting generation via .env AI_API_URL: ${envUrl}`);
        if (isGeminiUrl(envUrl)) {
          return await callGeminiApi(envKey, null, referencePrompt || built.prompt, originalImagePath, outputPath, referenceImagePath);
        } else if (isReplicateUrl(envUrl)) {
          return await callReplicateApi(
            envUrl,
            envKey,
            null,
            built.prompt,
            built.negativePrompt,
            originalImagePath,
            outputPath,
          );
        } else if (isOpenAiUrl(envUrl)) {
          return await callOpenAiApi(envUrl, envKey, null, referencePrompt || built.prompt, originalImagePath, outputPath, referenceImagePath);
        } else {
          return await callAiApi(envUrl, envKey, null, built, outputPath);
        }
      } catch (err: any) {
        lastError = err.message;
        console.error(`[AI] .env AI provider failed: ${lastError}`);
        break;
      }
    }

    try {
      console.log(
        `[AI] Generating image via provider "${provider.name}" (priority ${provider.priority}, attempt ${attempt + 1})`,
      );

      let finalPath: string;
      if (isGeminiUrl(provider.apiUrl)) {
        finalPath = await callGeminiApi(
          provider.apiKey,
          provider.model,
          referencePrompt || built.prompt,
          originalImagePath,
          outputPath,
          referenceImagePath,
        );
      } else if (isReplicateUrl(provider.apiUrl)) {
        finalPath = await callReplicateApi(
          provider.apiUrl,
          provider.apiKey,
          provider.model,
          built.prompt,
          built.negativePrompt,
          originalImagePath,
          outputPath,
        );
      } else if (isOpenAiUrl(provider.apiUrl)) {
        finalPath = await callOpenAiApi(
          provider.apiUrl,
          provider.apiKey,
          provider.model,
          referencePrompt || built.prompt,
          originalImagePath,
          outputPath,
          referenceImagePath,
        );
      } else {
        finalPath = await callAiApi(
          provider.apiUrl,
          provider.apiKey,
          provider.model,
          built,
          outputPath,
        );
      }

      await markAiProviderSuccess(provider.id);
      console.log(`[AI] Dream job image successfully generated: ${finalPath}`);
      return finalPath;
    } catch (err: any) {
      lastError = err.message;
      console.error(`[AI] Provider "${provider.name}" failed: ${lastError}`);
      await markAiProviderFailed(provider.id, lastError);
    }
  }

  console.warn(`[AI] All AI generation attempts failed (last error: ${lastError}). Falling back to demo preview mode.`);
  return await generateDemoImage(originalImagePath, outputPath, job, name);
}

/**
 * Generates the dream-job poster. If an admin has uploaded a reference
 * poster for this job (or the 'Other' fallback), it's sent to the AI
 * alongside the user's photo with instructions to preserve the reference's
 * design/text exactly and only generate the background + person — so the
 * frame/text come from the AI matching the reference, not from a fixed
 * code-side composite. Falls back to the plain single-image generation
 * (no reference) if no overlay has been uploaded for this job yet.
 *
 * Either way, the final output is strictly resized/cropped to exactly
 * 1200x1800 as a safety net, since providers don't always honor the
 * requested output size.
 */
export async function generateImage(params: GenerateParams): Promise<string> {
  const { job } = params;

  const overlay = await findOverlayForJob(job);
  if (!overlay) {
    console.warn(`[Overlay] No reference poster uploaded for job="${job}" (or fallback 'Other') — generating without one`);
  }

  const rawPhotoPath = await generateRawPhoto(params, overlay?.imagePath || null);

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const generatedDir = path.join(uploadDir, 'generated');
  const finalPath = path.join(generatedDir, `poster_${uuidv4()}.png`);

  await sharp(rawPhotoPath)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: 'cover', position: 'center' })
    .png()
    .toFile(finalPath);

  return finalPath;
}

/**
 * Google Gemini Multimodal Image Generation / Editing:
 * Sends the user's photo together with the face-preserving dream job prompt.
 */
async function callGeminiApi(
  apiKey: string,
  model: string | null,
  prompt: string,
  inputPath: string,
  outputPath: string,
  referenceImagePath?: string | null,
): Promise<string> {
  const modelName = model || DEFAULT_GEMINI_MODEL;
  const url = `https://${GEMINI_HOST}/v1beta/models/${modelName}:generateContent`;

  const imageBuffer = fs.readFileSync(inputPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = mimeTypeFor(inputPath);

  const parts: any[] = [];

  if (referenceImagePath && fs.existsSync(referenceImagePath)) {
    const refBuffer = fs.readFileSync(referenceImagePath);
    parts.push({
      inlineData: {
        mimeType: mimeTypeFor(referenceImagePath),
        data: refBuffer.toString('base64'),
      },
    });
  }

  parts.push({
    inlineData: {
      mimeType,
      data: base64Image,
    },
  });
  parts.push({
    text: prompt,
  });

  console.log(`[AI] Calling Gemini (${modelName}) multimodal image transformation${referenceImagePath ? ' with reference poster' : ''}...`);

  const response = await axios.post(
    url,
    {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    },
    {
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 120_000,
    },
  );

  const responseParts = response.data?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((p: any) => p.inlineData || p.inline_data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;

  if (!inlineData?.data) {
    const textPart = responseParts.find((p: any) => p.text);
    const textMsg = textPart?.text || 'Gemini response did not contain image data';
    throw new Error(`Gemini image generation failed: ${textMsg}`);
  }

  const returnedMime = inlineData.mimeType || inlineData.mime_type || 'image/png';
  const finalPath = outputPath.replace(/\.png$/i, extForMimeType(returnedMime));

  fs.writeFileSync(finalPath, Buffer.from(inlineData.data, 'base64'));
  console.log(`[AI] Gemini image saved: ${finalPath}`);
  return finalPath;
}

/**
 * Replicate Image-to-Image call:
 * Sends the user's photo and dream job prompt to Replicate and polls for completion.
 */
async function callReplicateApi(
  apiUrl: string,
  apiKey: string,
  model: string | null,
  prompt: string,
  negativePrompt: string,
  inputPath: string,
  outputPath: string,
): Promise<string> {
  const mimeType = mimeTypeFor(inputPath);
  const base64 = fs.readFileSync(inputPath).toString('base64');
  const dataUri = `data:${mimeType};base64,${base64}`;
  const targetUrl = apiUrl.includes('predictions')
    ? apiUrl
    : 'https://api.replicate.com/v1/predictions';

  console.log(`[AI] Calling Replicate img2img (model: ${model || 'default'})...`);

  const createRes = await axios.post(
    targetUrl,
    {
      ...(model && { model }),
      input: {
        image: dataUri,
        input_image: dataUri,
        prompt,
        negative_prompt: negativePrompt || undefined,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    },
  );

  if (createRes.data.output) {
    const url = Array.isArray(createRes.data.output) ? createRes.data.output[0] : createRes.data.output;
    const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, Buffer.from(imgRes.data));
    console.log(`[AI] Replicate image generated directly: ${outputPath}`);
    return outputPath;
  }

  const predictionUrl = createRes.data.urls?.get;
  if (!predictionUrl) {
    throw new Error('No prediction URL returned from Replicate');
  }

  const startTime = Date.now();
  while (Date.now() - startTime < 120_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await axios.get(predictionUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (poll.data.status === 'succeeded') {
      const url = Array.isArray(poll.data.output) ? poll.data.output[0] : poll.data.output;
      const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
      fs.writeFileSync(outputPath, Buffer.from(imgRes.data));
      console.log(`[AI] Replicate image generated and saved: ${outputPath}`);
      return outputPath;
    }

    if (poll.data.status === 'failed' || poll.data.status === 'canceled') {
      throw new Error(`Replicate failed: ${poll.data.error || 'Generation failed'}`);
    }
  }

  throw new Error('Replicate timed out after 2 minutes');
}

/**
 * Generic REST AI Provider:
 * Sends prompt, negative prompt, user base64 photo, and job metadata.
 */
async function callAiApi(
  apiUrl: string,
  apiKey: string,
  model: string | null,
  built: BuiltPrompt,
  outputPath: string,
): Promise<string> {
  console.log(`[AI] Calling generic REST AI provider: ${apiUrl}`);

  const response = await axios.post(
    apiUrl,
    {
      ...built.requestBody,
      ...(model && { model }),
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120_000,
      responseType: 'arraybuffer',
    },
  );

  fs.writeFileSync(outputPath, Buffer.from(response.data));
  console.log(`[AI] Generated image saved: ${outputPath}`);
  return outputPath;
}

/**
 * OpenAI Images (gpt-image-1) edit endpoint:
 * Sends the user's photo + prompt as multipart form data.
 */
async function callOpenAiApi(
  apiUrl: string,
  apiKey: string,
  model: string | null,
  prompt: string,
  inputPath: string,
  outputPath: string,
  referenceImagePath?: string | null,
): Promise<string> {
  const targetUrl = apiUrl.includes('/images/') ? apiUrl : 'https://api.openai.com/v1/images/edits';
  const imageBuffer = fs.readFileSync(inputPath);
  const mimeType = mimeTypeFor(inputPath);

  const form = new FormData();
  if (referenceImagePath && fs.existsSync(referenceImagePath)) {
    const refBuffer = fs.readFileSync(referenceImagePath);
    form.append('image[]', new Blob([refBuffer], { type: mimeTypeFor(referenceImagePath) }), path.basename(referenceImagePath));
  }
  form.append('image[]', new Blob([imageBuffer], { type: mimeType }), path.basename(inputPath));
  form.append('prompt', prompt);
  form.append('model', model || 'gpt-image-1');
  form.append('size', '1024x1536');

  console.log(`[AI] Calling OpenAI images/edits (model: ${model || 'gpt-image-1'})${referenceImagePath ? ' with reference poster' : ''}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI image generation failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI response did not contain image data');
  }

  fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
  console.log(`[AI] OpenAI image saved: ${outputPath}`);
  return outputPath;
}
