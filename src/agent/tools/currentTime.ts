import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Devuelve fecha y hora actuales en ISO 8601 con offset.
 * Útil para resolver expresiones relativas como "el viernes" o "en julio".
 */
export const currentTimeTool = tool(
  async () => new Date().toISOString(),
  {
    name: 'current_time',
    description: 'Devuelve la fecha y hora actuales en ISO 8601 (UTC). Úsala para resolver fechas relativas en español como "mañana" o "el 15 de julio".',
    schema: z.object({}),
  },
);
