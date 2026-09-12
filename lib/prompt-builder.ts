import prisma from './db';
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from './output-size';

export interface PromptContext {
  name: string;
  gender: string; // "male" or "female"
  job: string;
}

export interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
  requestBody: Record<string, any>;
  templateName: string;
  requestBodyError?: string;
}

interface TemplateFields {
  name: string;
  promptText: string;
  negativePrompt?: string | null;
  requestBodyTemplate?: string | null;
}

// Some career labels shown to the user don't produce the best results if
// sent to the AI verbatim — e.g. "Painter" reads to an image model as a
// house/wall painter rather than a fine artist. Translate just the word that
// reaches the prompt right here; the original label keeps showing
// everywhere else (career tile, DB, admin, SMS).
const PROMPT_JOB_WORD_OVERRIDES: Record<string, string> = {
  painter: 'Artist',
};

function promptJobWord(job: string): string {
  return PROMPT_JOB_WORD_OVERRIDES[job.trim().toLowerCase()] || job;
}

function genderVars(gender: string) {
  return {
    genderWord: gender === 'male' ? 'man' : 'woman',
    genderBoy: gender === 'male' ? 'boy' : 'girl',
    genderSubject: gender === 'male' ? 'he' : 'she',
    genderPossessive: gender === 'male' ? 'his' : 'her',
    genderTitle: gender === 'male' ? 'Mr' : 'Ms',
  };
}

export function getJobClothingAndSetting(job: string, gender: string): { clothing: string; surroundings: string } {
  const g = genderVars(gender);
  const normalized = job.trim().toLowerCase();

  switch (normalized) {
    case 'doctor':
      return {
        clothing: `a clean white medical doctor coat over professional scrubs with a stethoscope draped around the neck and hospital badge`,
        surroundings: `inside a modern, well-lit hospital clinic or medical consultation room with subtle medical equipment in soft focus`,
      };
    case 'pilot':
      return {
        clothing: `an airline captain pilot uniform with gold stripe epaulets on the shoulders, pilot wings badge, white dress shirt, and dark tie`,
        surroundings: `inside the cockpit of a modern commercial airliner with glowing instrument panels and sky visible through windows`,
      };
    case 'engineer':
      return {
        clothing: `an engineering safety hard hat, clean high-visibility reflective vest over professional field shirt, holding digital blueprints`,
        surroundings: `at a state-of-the-art engineering project site or modern high-tech architectural infrastructure facility`,
      };
    case 'scientist':
      return {
        clothing: `a crisp white laboratory coat over smart professional attire, protective safety goggles, and research credential badge`,
        surroundings: `inside an advanced scientific research laboratory with glass beakers, microscopes, and high-tech lab equipment`,
      };
    case 'military':
      return {
        clothing: `a prestigious military officer service dress uniform with insignia, service medals, and formal officer beret or cap`,
        surroundings: `at a formal military headquarters courtyard or dignified ceremonial parade ground with flags in the background`,
      };
    case 'artist':
      return {
        clothing: `an artistic smock or apron with subtle paint smudges, holding a wooden palette and paintbrush like a fine artist`,
        surroundings: `inside a sunlit art studio filled with canvas paintings on easels and colorful artist supplies`,
      };
    case 'professional gamer':
    case 'gamer':
      return {
        clothing: `a sleek esports team jersey or stylish gaming hoodie with premium over-ear gaming headset with microphone`,
        surroundings: `inside a neon-lit esports arena or high-end gaming room with RGB LED lighting and multiple monitor displays`,
      };
    case 'journalist':
      return {
        clothing: `smart-casual news correspondent attire with a press badge and lanyard, holding a broadcast microphone with windscreen`,
        surroundings: `at a bustling press conference or modern television newsroom broadcast studio`,
      };
    case 'photographer':
      return {
        clothing: `a stylish photography field vest over casual shirt, holding a high-end DSLR camera with a professional lens`,
        surroundings: `inside a photography studio with softbox lights and backdrops, or on an exotic scenic location`,
      };
    case 'lawyer':
      return {
        clothing: `an elegant tailored formal dark business suit, white shirt, formal tie or scarf, holding leather legal case folders`,
        surroundings: `inside a prestigious law library with rich mahogany bookshelves filled with legal volumes`,
      };
    case 'singer':
      return {
        clothing: `a glamorous musical stage performance outfit, singing into a vintage chrome vocal microphone on a stand`,
        surroundings: `on a concert stage with dramatic spotlights, stage haze, and an arena crowd in soft aesthetic blur`,
      };
    case 'footballer':
      return {
        clothing: `a professional football soccer team kit and athletic jersey, athletic stance and fitness`,
        surroundings: `on the grass pitch of an iconic stadium with floodlights glowing under the evening sky`,
      };
    default:
      return {
        clothing: `appropriate professional ${job} uniform, attire, and gear`,
        surroundings: `a realistic, authentic professional workplace setting for a ${job}`,
      };
  }
}

const FACE_PRESERVATION_TEXT =
  'Preserve the exact same person, face, facial structure, skin tone, eye shape, nose, mouth, hair, and facial expression as shown in the input photo. Keep the face and identity completely identical and unchanged.';

/** Plain-text variable resolution — used for the prompt / negative prompt themselves. */
export function resolveVariables(template: string, ctx: PromptContext): string {
  const g = genderVars(ctx.gender);
  const promptJob = promptJobWord(ctx.job);
  const details = getJobClothingAndSetting(promptJob, ctx.gender);
  const vars: Record<string, string> = {
    '{{name}}': ctx.name,
    '{{gender}}': ctx.gender,
    '{{job}}': promptJob,
    '{{genderWord}}': g.genderWord,
    '{{genderBoy}}': g.genderBoy,
    '{{genderSubject}}': g.genderSubject,
    '{{genderPossessive}}': g.genderPossessive,
    '{{genderTitle}}': g.genderTitle,
    '{{job_lower}}': promptJob.toLowerCase(),
    '{{job_uppercase}}': promptJob.toUpperCase(),
    '{{job_clothing}}': details.clothing,
    '{{job_surroundings}}': details.surroundings,
    '{{output_width}}': String(OUTPUT_WIDTH),
    '{{output_height}}': String(OUTPUT_HEIGHT),
    '{{face_preservation_instruction}}': FACE_PRESERVATION_TEXT,
  };

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(key).join(value);
  }
  return result;
}

/** JSON-string-safe escaping so substituted values can't break the surrounding JSON. */
function escapeForJson(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/** Same variable set as resolveVariables, but each value is JSON-escaped — for use inside requestBodyTemplate. */
function resolveVariablesJsonSafe(template: string, ctx: PromptContext): string {
  const g = genderVars(ctx.gender);
  const promptJob = promptJobWord(ctx.job);
  const details = getJobClothingAndSetting(promptJob, ctx.gender);
  const vars: Record<string, string> = {
    '{{name}}': ctx.name,
    '{{gender}}': ctx.gender,
    '{{job}}': promptJob,
    '{{genderWord}}': g.genderWord,
    '{{genderBoy}}': g.genderBoy,
    '{{genderSubject}}': g.genderSubject,
    '{{genderPossessive}}': g.genderPossessive,
    '{{genderTitle}}': g.genderTitle,
    '{{job_lower}}': promptJob.toLowerCase(),
    '{{job_uppercase}}': promptJob.toUpperCase(),
    '{{job_clothing}}': details.clothing,
    '{{job_surroundings}}': details.surroundings,
    '{{output_width}}': String(OUTPUT_WIDTH),
    '{{output_height}}': String(OUTPUT_HEIGHT),
    '{{face_preservation_instruction}}': FACE_PRESERVATION_TEXT,
  };

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(key).join(escapeForJson(value));
  }
  return result;
}

/**
 * Resolve a template's fields (either a DB row or an ad-hoc set of fields from
 * the admin preview endpoint) against a context, producing the final prompt,
 * negative prompt, and request body. Does no DB access — safe for previews.
 */
export function resolveTemplate(
  fields: TemplateFields,
  ctx: PromptContext,
  imageBase64: string,
): BuiltPrompt {
  const prompt = resolveVariables(fields.promptText, ctx);
  const negativePrompt = fields.negativePrompt ? resolveVariables(fields.negativePrompt, ctx) : '';

  let requestBody: Record<string, any>;
  let requestBodyError: string | undefined;

  if (fields.requestBodyTemplate && fields.requestBodyTemplate.trim()) {
    let bodyStr = resolveVariablesJsonSafe(fields.requestBodyTemplate, ctx);
    bodyStr = bodyStr.split('{{prompt}}').join(escapeForJson(prompt));
    bodyStr = bodyStr.split('{{negativePrompt}}').join(escapeForJson(negativePrompt));
    bodyStr = bodyStr.split('{{imageBase64}}').join(escapeForJson(imageBase64));

    try {
      requestBody = JSON.parse(bodyStr);
    } catch (e: any) {
      console.error('[Prompt] Failed to parse custom request body template:', e.message);
      requestBodyError = e.message;
      requestBody = { prompt, negative_prompt: negativePrompt, image: imageBase64 };
    }
  } else {
    requestBody = {
      prompt,
      negative_prompt: negativePrompt,
      image: imageBase64,
      gender: ctx.gender,
      job: ctx.job,
    };
  }

  return { prompt, negativePrompt, requestBody, templateName: fields.name, requestBodyError };
}

const CUSTOM_CAREER_FRAME_INSTRUCTION =
  " Add a stylish decorative photo-frame border around the entire edge of the image, thematically " +
  "matching this career, like a framed portrait card — the frame must sit within the outer 5-8% " +
  "margin of the image and must not cover the subject's face.";

/**
 * @param isCustomJob Custom "Other" careers (routed to OpenAI — see
 * lib/ai-generation.ts) have no pre-made frame PNG to composite afterward,
 * so they use a separate default template (isDefaultForCustom) whose prompt
 * asks the model to bake its own frame into the image, rather than the
 * template used for the 12 known careers.
 */
export async function buildPrompt(ctx: PromptContext, imageBase64: string, isCustomJob = false): Promise<BuiltPrompt> {
  // 1. Use the configured default template for this job's category
  let template = isCustomJob
    ? await prisma.promptTemplate.findFirst({ where: { isDefaultForCustom: true } })
    : null;
  if (!template) {
    template = await prisma.promptTemplate.findFirst({ where: { isDefault: true } });
  }

  // 2. Fall back to a hardcoded default if nothing is configured in the DB
  if (!template) {
    const promptJob = promptJobWord(ctx.job);
    const details = getJobClothingAndSetting(promptJob, ctx.gender);
    let defaultPrompt = `A high quality photorealistic portrait of the exact same person from the input photo. ${FACE_PRESERVATION_TEXT} Change their clothing and outfit into: ${details.clothing}. Change the background and surroundings into: ${details.surroundings}. Seamless composition, natural lighting, professional studio photography, crisp focus, 8k resolution, highly detailed.`;
    if (isCustomJob) defaultPrompt += CUSTOM_CAREER_FRAME_INSTRUCTION;
    const defaultNegative =
      'different face, changed face, altered facial features, distorted eyes, bad anatomy, deformed hands, cartoon, 3d render, anime, illustration, painting, blurry, low resolution, artifacts, watermark, text, signature';

    console.log('[Prompt] Using template: "Hardcoded Default (Face-Preserving Image-to-Image)"');
    console.log(`[Prompt] Final prompt: ${defaultPrompt}`);

    return {
      prompt: defaultPrompt,
      negativePrompt: defaultNegative,
      requestBody: {
        prompt: defaultPrompt,
        negative_prompt: defaultNegative,
        image: imageBase64,
        gender: ctx.gender,
        job: promptJob,
      },
      templateName: 'Hardcoded Default',
    };
  }

  const result = resolveTemplate(template, ctx, imageBase64);

  console.log(`[Prompt] Using template: "${template.name}"`);
  console.log(`[Prompt] Final prompt: ${result.prompt}`);
  if (result.negativePrompt) console.log(`[Prompt] Negative: ${result.negativePrompt}`);
  if (result.requestBodyError) {
    console.error(`[Prompt] Request body template invalid, using default body: ${result.requestBodyError}`);
  }

  return result;
}

export function getAvailableVariables(): { variable: string; description: string; example: string }[] {
  return [
    { variable: '{{name}}', description: "User's name", example: 'Samira' },
    { variable: '{{gender}}', description: 'Raw gender value', example: 'male / female' },
    { variable: '{{genderWord}}', description: 'Man or Woman', example: 'man / woman' },
    { variable: '{{genderBoy}}', description: 'Boy or Girl', example: 'boy / girl' },
    { variable: '{{genderSubject}}', description: 'He or She', example: 'he / she' },
    { variable: '{{genderPossessive}}', description: 'His or Her', example: 'his / her' },
    { variable: '{{genderTitle}}', description: 'Mr or Ms', example: 'Mr / Ms' },
    { variable: '{{job}}', description: 'Selected dream job', example: 'Doctor' },
    { variable: '{{job_lower}}', description: 'Job in lowercase', example: 'doctor' },
    { variable: '{{job_uppercase}}', description: 'Job in uppercase', example: 'DOCTOR' },
    { variable: '{{job_clothing}}', description: 'Specific attire for the job', example: 'white doctor coat with stethoscope' },
    { variable: '{{job_surroundings}}', description: 'Specific environment for the job', example: 'modern hospital clinic' },
    { variable: '{{output_width}}', description: 'Fixed output canvas width in pixels — use in OUTPUT-style instructions instead of hardcoding a number', example: '1200' },
    { variable: '{{output_height}}', description: 'Fixed output canvas height in pixels', example: '1800' },
    { variable: '{{face_preservation_instruction}}', description: 'Strict instruction to keep user face and identity unchanged', example: 'Preserve the exact same person, face...' },
    { variable: '{{prompt}}', description: 'Resolved main prompt (request body only)', example: '' },
    { variable: '{{negativePrompt}}', description: 'Resolved negative prompt (request body only)', example: '' },
    { variable: '{{imageBase64}}', description: 'Base64 encoded user photo (request body only)', example: '' },
  ];
}
