// Single source of truth for the fixed output canvas — used by
// lib/ai-generation.ts (normalizing every provider's raw output),
// lib/generated-photo-frame.ts (compositing frame artwork to this exact
// size), and lib/prompt-builder.ts (exposing {{output_width}}/
// {{output_height}} so prompt text doesn't have to hardcode "1200x1800").
export const OUTPUT_WIDTH = 1200;
export const OUTPUT_HEIGHT = 1800;
