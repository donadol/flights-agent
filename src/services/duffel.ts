// src/services/duffel.ts
import { Duffel } from '@duffel/api';
import { z } from 'zod';

/** Coincidencia de aeropuerto resuelta a IATA. */
export interface AirportMatch {
  iataCode: string;
  name: string;
  cityName: string;
  countryName: string;
}

/** Tramo individual de un itinerario. */
export interface Segment {
  origin: string;          // IATA
  destination: string;     // IATA
  departureAt: string;     // ISO datetime
  arrivalAt: string;       // ISO datetime
}

/** Oferta de vuelo normalizada. */
export interface FlightOffer {
  id: string;
  totalAmount: string;
  currency: string;
  airline: string;
  segments: Segment[];
  stops: number;
  durationMinutes: number;
}

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface SearchOffersInput {
  origin: string;
  destination: string;
  departureDate: string;   // ISO date YYYY-MM-DD
  passengers?: number;     // default 1
  cabinClass?: CabinClass;
}

/** Cliente de servicios para el dominio. Ver Task 4-5 para implementación. */
export interface DuffelClient {
  searchAirports(query: string): Promise<AirportMatch[]>;
  searchOffers(input: SearchOffersInput): Promise<FlightOffer[]>;
}

// Schemas zod usados en Tasks 4 y 5 (declarados aquí para co-locar el contrato).
export const placeSuggestionSchema = z.object({
  iata_code: z.string().nullable(),
  name: z.string(),
  city_name: z.string().nullable().optional(),
  country_name: z.string().nullable().optional(),
  type: z.string().optional(),
});

export const placesResponseSchema = z.object({
  data: z.array(placeSuggestionSchema),
});

export const segmentSchema = z.object({
  origin: z.object({ iata_code: z.string() }),
  destination: z.object({ iata_code: z.string() }),
  departing_at: z.string(),
  arriving_at: z.string(),
  duration: z.string().optional(),
});

export const sliceSchema = z.object({
  segments: z.array(segmentSchema).min(1),
});

export const offerSchema = z.object({
  id: z.string(),
  total_amount: z.string(),
  total_currency: z.string(),
  owner: z.object({ name: z.string() }),
  slices: z.array(sliceSchema).min(1),
});

export const offerRequestResponseSchema = z.object({
  data: z.object({
    offers: z.array(offerSchema),
  }),
});

/**
 * Crea un cliente normalizado del dominio sobre @duffel/api.
 * @param token Token Duffel test mode (validado upstream en config/env.ts).
 */
export function createDuffelClient(token: string): DuffelClient {
  const duffel = new Duffel({ token });

  async function searchAirports(query: string): Promise<AirportMatch[]> {
    // En @duffel/api 4.x el parámetro `query` está deprecado en favor de `name`.
    const raw = await duffel.suggestions.list({ name: query });
    const parsed = placesResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Duffel response /places: ${parsed.error.message}`);
    }
    return parsed.data.data
      .filter((p): p is typeof p & { iata_code: string } => typeof p.iata_code === 'string' && p.iata_code.length === 3)
      .map((p) => ({
        iataCode: p.iata_code,
        name: p.name,
        cityName: p.city_name ?? '',
        countryName: p.country_name ?? '',
      }));
  }

  async function searchOffers(): Promise<FlightOffer[]> {
    throw new Error('Not implemented yet');
  }

  return { searchAirports, searchOffers };
}
