import dotenv from 'dotenv';
import { z } from 'zod';

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_TEMPERATURE: z.coerce.number().default(0),
  OPENROUTER_HTTP_REFERER: z.string().url().optional(),
  OPENROUTER_APP_TITLE: z.string().min(1).optional(),
  DUFFEL_API_TOKEN: z
    .string()
    .startsWith('duffel_test_', 'DUFFEL_API_TOKEN must be a test-mode token (duffel_test_*)'),
});

export type AppEnv = z.infer<typeof envSchema>;

let envFileLoaded = false;

export function getEnv(): AppEnv {
  if (!envFileLoaded) {
    dotenv.config({ path: 'env.local' });
    envFileLoaded = true;
  }
  return envSchema.parse(process.env);
}
