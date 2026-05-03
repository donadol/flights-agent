// src/agent/tools/searchFlights.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { cabinClassSchema, type DuffelClient } from '../../services/duffel.js';

const inputSchema = z.object({
  origin: z.string().length(3).describe('Código IATA de origen (3 letras). Ej: "BOG".'),
  destination: z.string().length(3).describe('Código IATA de destino (3 letras). Ej: "MAD".'),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato ISO YYYY-MM-DD')
    .describe('Fecha de salida en formato ISO (YYYY-MM-DD).'),
  passengers: z.number().int().min(1).default(1).describe('Número de pasajeros adultos.'),
  cabinClass: cabinClassSchema.default('economy').describe('Clase de cabina.'),
});

/**
 * Crea la tool `search_flights` enlazada a un DuffelClient.
 * Devuelve hasta 3 ofertas (top por orden de Duffel) en JSON.
 */
export function createSearchFlightsTool(client: DuffelClient) {
  return tool(
    async (input) => {
      const offers = await client.searchOffers(input);
      return JSON.stringify(offers.slice(0, 3));
    },
    {
      name: 'search_flights',
      description:
        'Busca ofertas de vuelos. Requiere códigos IATA de origen y destino y fecha ISO YYYY-MM-DD. Si tienes nombres de ciudades, llama primero a resolve_airport.',
      schema: inputSchema,
    },
  );
}
