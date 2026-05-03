// src/agent/errors.ts
import { ZodError } from 'zod';

/**
 * Forma de error de @duffel/api 4.x al fallar una llamada HTTP.
 * Identificada por el par `meta.status` numérico + `errors[]`.
 */
interface DuffelApiError {
  meta: { status: number };
  errors: Array<{ title?: string; message?: string; code?: string }>;
}

function isDuffelApiError(err: unknown): err is DuffelApiError {
  if (typeof err !== 'object' || err === null) return false;
  const meta = (err as { meta?: unknown }).meta;
  const errors = (err as { errors?: unknown }).errors;
  return (
    typeof meta === 'object' &&
    meta !== null &&
    typeof (meta as { status?: unknown }).status === 'number' &&
    Array.isArray(errors)
  );
}

/**
 * Forma de error del SDK OpenAI (que `@langchain/openai` usa contra OpenRouter):
 * un `Error` con `status` numérico inyectado.
 */
interface OpenAiLikeError {
  status: number;
  message: string;
}

function isOpenAiLikeError(err: unknown): err is OpenAiLikeError {
  if (typeof err !== 'object' || err === null) return false;
  return (
    typeof (err as { status?: unknown }).status === 'number' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

function formatZodIssues(err: ZodError): string {
  const issues = err.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return `Configuración inválida:\n${issues}`;
}

function isNetworkTimeout(err: Error): boolean {
  return /ETIMEDOUT|ECONNRESET|ENOTFOUND|timeout/i.test(err.message);
}

/**
 * Traduce errores que pueden burbujear desde el agente a mensajes en español
 * accionables para el usuario final del CLI. Detecta:
 *
 * - `ZodError` → listado por campo de la config inválida.
 * - Errores Duffel (`meta.status` + `errors[]`) → token revocado, validación,
 *   o caída del servicio.
 * - Errores OpenAI/OpenRouter (`status` + `message`) → API key inválida,
 *   rate limit, o caída del servicio.
 * - Cualquier otro `Error` con timeout/red en el mensaje → reintenta.
 * - Fallback: `err.message` o `String(err)`.
 */
export function translateAgentError(err: unknown): string {
  if (err instanceof ZodError) {
    return formatZodIssues(err);
  }

  if (isDuffelApiError(err)) {
    const status = err.meta.status;
    if (status === 401 || status === 403) {
      return (
        `Tu DUFFEL_API_TOKEN parece inválido o inactivo (Duffel respondió ${status}). ` +
        'Verifica que sigue activo en duffel.com y que empieza con `duffel_test_`.'
      );
    }
    if (status >= 500) {
      return (
        `Duffel respondió con un error de servidor (${status}). ` +
        'Reintenta en un momento.'
      );
    }
    const first = err.errors[0];
    const detail = first?.message ?? first?.title ?? 'sin detalle';
    return `Duffel rechazó la petición (${status}): ${detail}`;
  }

  if (isOpenAiLikeError(err)) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return (
        `Tu OPENROUTER_API_KEY parece inválida (OpenRouter respondió ${status}). ` +
        'Revisa env.local y la consola de OpenRouter.'
      );
    }
    if (status === 429) {
      return 'OpenRouter te rate-limiteó. Espera unos segundos y reintenta.';
    }
    if (status >= 500) {
      return (
        `OpenRouter respondió con un error de servidor (${status}). ` +
        'Reintenta en un momento.'
      );
    }
  }

  if (err instanceof Error) {
    if (isNetworkTimeout(err)) {
      return 'No hubo respuesta a tiempo de un servicio externo. Reintenta en un momento.';
    }
    return err.message;
  }

  return String(err);
}
