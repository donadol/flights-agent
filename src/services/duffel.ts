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
  /** Total de paradas en el itinerario (segments.length - 1, MVP one-way). */
  stops: number;
  /** Suma de tiempos de vuelo de los segmentos (NO incluye layovers). */
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
 * Convierte ISO 8601 duration (e.g. "PT4H30M", "PT1H2M3S") a minutos enteros.
 * Soporta días, horas, minutos y segundos (segundos se redondean hacia abajo).
 * Retorna 0 si la cadena es vacía/undefined o no comienza con "P" o tiene
 * componentes no reconocidos (ancla en `$`).
 */
export function parseIso8601DurationToMinutes(iso: string | undefined): number {
  if (!iso) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 24 * 60 + hours * 60 + minutes + Math.floor(seconds / 60);
}

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

  async function searchOffers(input: SearchOffersInput): Promise<FlightOffer[]> {
    const passengers = Array.from({ length: input.passengers ?? 1 }, () => ({ type: 'adult' as const }));

    const raw = await duffel.offerRequests.create({
      slices: [
        {
          origin: input.origin,
          destination: input.destination,
          departure_date: input.departureDate,
          // @duffel/api 4.x exige estos campos en CreateOfferRequestSlice; null = sin filtro.
          arrival_time: null,
          departure_time: null,
        },
      ],
      passengers,
      cabin_class: input.cabinClass ?? 'economy',
      return_offers: true,
    });

    const parsed = offerRequestResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Duffel response /offer_requests: ${parsed.error.message}`);
    }

    return parsed.data.data.offers.map((offer) => {
      const segments: Segment[] = offer.slices.flatMap((slice) =>
        slice.segments.map((s) => ({
          origin: s.origin.iata_code,
          destination: s.destination.iata_code,
          departureAt: s.departing_at,
          arrivalAt: s.arriving_at,
        })),
      );
      const durationMinutes = offer.slices
        .flatMap((slice) => slice.segments)
        .reduce((sum, s) => sum + parseIso8601DurationToMinutes(s.duration), 0);
      return {
        id: offer.id,
        totalAmount: offer.total_amount,
        currency: offer.total_currency,
        airline: offer.owner.name,
        segments,
        // MVP one-way only. For multi-slice round-trips, compute stops per-slice and expose as a list.
        stops: Math.max(segments.length - 1, 0),
        durationMinutes,
      };
    });
  }

  return { searchAirports, searchOffers };
}
