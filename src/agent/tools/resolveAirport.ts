import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { DuffelClient } from '../../services/duffel.js';

const inputSchema = z.object({
  query: z.string().min(1).describe('Nombre de ciudad, país o código IATA. Ej: "Bogotá", "Madrid, España", "JFK".'),
});

/**
 * Crea la tool `resolve_airport` enlazada a un DuffelClient.
 * Resuelve nombres en lenguaje natural a códigos IATA.
 */
export function createResolveAirportTool(client: DuffelClient) {
  return tool(
    async ({ query }) => {
      const matches = await client.searchAirports(query);
      return JSON.stringify(matches);
    },
    {
      name: 'resolve_airport',
      description:
        'Resuelve un nombre de ciudad/país/aeropuerto a una lista de aeropuertos con código IATA. Úsala antes de search_flights cuando el usuario da nombres en vez de códigos.',
      schema: inputSchema,
    },
  );
}
