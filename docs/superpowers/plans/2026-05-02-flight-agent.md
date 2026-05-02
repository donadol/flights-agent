# Flight Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un agente conversacional en español que resuelva aeropuertos a IATA y busque ofertas de vuelos en Duffel test mode, con CLI single-shot + REPL multi-turno, siguiendo el patrón por capas del repo de referencia `10X-Builders-langchain-agent`.

**Architecture:** TypeScript ESM + LangChain (`createToolCallingAgent` + `AgentExecutor`) sobre OpenRouter como LLM. Capa de servicios (`src/services/duffel.ts`) encapsula `@duffel/api`; tools delgadas reciben el cliente por inyección y llaman al servicio (no al SDK). El historial multi-turno vive en RAM como `BaseMessage[]` y se inyecta vía `MessagesPlaceholder("history")` en el prompt. Validación con `zod` en boundaries (env vars + respuestas Duffel).

**Tech Stack:** TypeScript 5 (ESM, NodeNext), Node 20+, `@langchain/core`, `@langchain/openai`, `langchain`, `@duffel/api`, `dotenv`, `zod`. Dev: `vitest` + `@vitest/coverage-v8`, `eslint` + `typescript-eslint`, `tsx`.

**Convención de commits:** Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`, `refactor:`).

---

## File Structure

Archivos nuevos (todos a crear, el repo está vacío de código):

| Path | Responsabilidad |
|---|---|
| `package.json` | Manifest + scripts (`dev`, `build`, `test`, `test:coverage`, `lint`, `typecheck`). |
| `tsconfig.json` | Strict ESM/NodeNext. |
| `eslint.config.js` | typescript-eslint recommended. |
| `vitest.config.ts` | Coverage v8 con thresholds en `src/services/` y `src/agent/tools/`. |
| `env.local.example` | Template de variables. |
| `src/index.ts` | CLI: single-shot si hay argv, REPL si no. |
| `src/config/env.ts` | Carga `env.local` + zod. Incluye `DUFFEL_API_TOKEN` con guard `duffel_test_*`. |
| `src/services/duffel.ts` | Wrapper sobre `@duffel/api`. Expone `searchAirports`, `searchOffers`. Define tipos normalizados (`AirportMatch`, `FlightOffer`, `Segment`). Valida respuestas con zod. |
| `src/agent/model.ts` | `ChatOpenAI` apuntando a OpenRouter. |
| `src/agent/prompt.ts` | System prompt en español + `MessagesPlaceholder("history")`. Instruye uso de tools y aviso de sandbox una vez. |
| `src/agent/tools/currentTime.ts` | Hora actual (puerto del repo de referencia). |
| `src/agent/tools/resolveAirport.ts` | Factoría: recibe `DuffelClient`, devuelve la tool. |
| `src/agent/tools/searchFlights.ts` | Factoría: recibe `DuffelClient`, devuelve la tool. |
| `src/agent/createAgent.ts` | Compone modelo + prompt + tools en `AgentExecutor`. Acepta `DuffelClient` por inyección. |
| `src/agent/runAgent.ts` | `(input, history, options) → { output, history }`. Acepta executor opcional. |
| `tests/config/env.test.ts` | Validación zod de env (incluye guard `duffel_test_*`). |
| `tests/services/duffel.test.ts` | Mock `@duffel/api`, verifica normalización + zod. |
| `tests/agent/tools/currentTime.test.ts` | Smoke: formato HH:MM:SS. |
| `tests/agent/tools/resolveAirport.test.ts` | Mock `DuffelClient`. |
| `tests/agent/tools/searchFlights.test.ts` | Mock `DuffelClient`. |
| `tests/agent/runAgent.test.ts` | Inyecta executor mock; verifica historial. |
| `tests/agent/integration.test.ts` | Tres flujos: éxito, ciudad no resuelta, info faltante. |
| `README.md` | Ya existe en planning; se actualizará para reflejar el estado implementado. |
| `CLAUDE.md` | Ya existe; cambia solo si la realidad implementada se desvía. |

---

## Task 1: Bootstrap del proyecto

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `env.local.example`

- [ ] **Step 1.1: Crear `package.json`**

```json
{
  "name": "flight-agent",
  "version": "0.1.0",
  "description": "Agente didáctico de búsqueda de vuelos en español (LangChain + Duffel test mode).",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "@duffel/api": "^4.25.0",
    "@langchain/core": "^0.3.48",
    "@langchain/openai": "^0.5.18",
    "dotenv": "^16.4.5",
    "langchain": "^0.3.30",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/node": "^22.10.2",
    "@vitest/coverage-v8": "^2.1.8",
    "eslint": "^9.17.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.1",
    "vitest": "^2.1.8"
  }
}
```

> **Nota de dependencia:** `@vitest/coverage-v8` es necesaria para cumplir el DoD (≥90% en services/ y tools/). Justificación documentada al actualizar el brief en la Task 17.

- [ ] **Step 1.2: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 1.3: Crear `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
```

- [ ] **Step 1.4: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        'src/services/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/agent/tools/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
```

- [ ] **Step 1.5: Crear `env.local.example`**

```
# LLM via OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEMPERATURE=0
OPENROUTER_HTTP_REFERER=https://example.com
OPENROUTER_APP_TITLE=Flight Agent

# Duffel (test mode ONLY)
DUFFEL_API_TOKEN=duffel_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 1.6: Instalar dependencias**

Run: `npm install`
Expected: instala sin errores. Genera `node_modules/` y `package-lock.json`.

- [ ] **Step 1.7: Verificar que typecheck y lint corren**

Run: `npm run typecheck && npm run lint`
Expected: ambos PASS (no hay archivos fuente todavía, ESLint solo valida configuración).

- [ ] **Step 1.8: Commit**

```bash
git add package.json package-lock.json tsconfig.json eslint.config.js vitest.config.ts env.local.example
git commit -m "chore: bootstrap typescript + vitest + eslint scaffolding"
```

---

## Task 2: Config de entorno con guard `duffel_test_*`

**Files:**
- Create: `src/config/env.ts`
- Test: `tests/config/env.test.ts`

- [ ] **Step 2.1: Escribir el test fallido**

```ts
// tests/config/env.test.ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getEnv } from "../../src/config/env.js";

const ORIGINAL_ENV = { ...process.env };

describe("getEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("parsea env válido con DUFFEL_API_TOKEN test", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-xxx";
    process.env.DUFFEL_API_TOKEN = "duffel_test_abc123";
    const env = getEnv();
    expect(env.OPENROUTER_MODEL).toBe("openai/gpt-4o-mini");
    expect(env.DUFFEL_API_TOKEN).toBe("duffel_test_abc123");
  });

  it("rechaza tokens de Duffel que no empiezan con duffel_test_", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-xxx";
    process.env.DUFFEL_API_TOKEN = "duffel_live_abc123";
    expect(() => getEnv()).toThrowError(/duffel_test_/);
  });

  it("rechaza falta de OPENROUTER_API_KEY", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.DUFFEL_API_TOKEN = "duffel_test_abc123";
    expect(() => getEnv()).toThrowError(/OPENROUTER_API_KEY/);
  });
});
```

- [ ] **Step 2.2: Correr el test (debe fallar por archivo inexistente)**

Run: `npm test -- tests/config/env.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/env.js'`.

- [ ] **Step 2.3: Implementar `src/config/env.ts`**

```ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: 'env.local' });

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

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}
```

- [ ] **Step 2.4: Correr el test (debe pasar)**

Run: `npm test -- tests/config/env.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 2.5: Commit**

```bash
git add src/config/env.ts tests/config/env.test.ts
git commit -m "feat(config): load env.local with zod and require duffel_test_ token"
```

---

## Task 3: Tipos normalizados del dominio

**Files:**
- Create: `src/services/duffel.ts` (sólo tipos en este paso)

- [ ] **Step 3.1: Crear el archivo con la API pública de tipos**

```ts
// src/services/duffel.ts
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
```

- [ ] **Step 3.2: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3.3: Commit**

```bash
git add src/services/duffel.ts
git commit -m "feat(services): declare normalized Duffel domain types and zod schemas"
```

---

## Task 4: Implementar `searchAirports` (con SDK mockeado)

**Files:**
- Modify: `src/services/duffel.ts`
- Test: `tests/services/duffel.test.ts`

- [ ] **Step 4.1: Escribir el test fallido**

```ts
// tests/services/duffel.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock del SDK ANTES de importar el módulo bajo test.
const listMock = vi.fn();
const createMock = vi.fn();

vi.mock("@duffel/api", () => ({
  Duffel: vi.fn().mockImplementation(() => ({
    suggestions: { list: listMock },
    offerRequests: { create: createMock },
  })),
}));

import { createDuffelClient } from "../../src/services/duffel.js";

beforeEach(() => {
  listMock.mockReset();
  createMock.mockReset();
});

describe("createDuffelClient.searchAirports", () => {
  it("normaliza la respuesta del SDK a AirportMatch[]", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          iata_code: "BOG",
          name: "El Dorado International Airport",
          city_name: "Bogotá",
          country_name: "Colombia",
          type: "airport",
        },
      ],
    });

    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchAirports("Bogotá");

    expect(listMock).toHaveBeenCalledWith({ name: "Bogotá" });
    expect(result).toEqual([
      {
        iataCode: "BOG",
        name: "El Dorado International Airport",
        cityName: "Bogotá",
        countryName: "Colombia",
      },
    ]);
  });

  it("descarta entradas sin IATA code (ciudades, regiones)", async () => {
    listMock.mockResolvedValue({
      data: [
        { iata_code: null, name: "Bogotá Region", city_name: "Bogotá", country_name: "Colombia" },
        { iata_code: "BOG", name: "El Dorado", city_name: "Bogotá", country_name: "Colombia" },
      ],
    });

    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchAirports("Bogotá");
    expect(result).toHaveLength(1);
    expect(result[0]?.iataCode).toBe("BOG");
  });

  it("lanza error legible si la respuesta no cumple el schema", async () => {
    listMock.mockResolvedValue({ data: [{ name: 123 }] });
    const client = createDuffelClient("duffel_test_xyz");
    await expect(client.searchAirports("X")).rejects.toThrow(/Duffel response/);
  });
});
```

- [ ] **Step 4.2: Correr el test (debe fallar por export inexistente)**

Run: `npm test -- tests/services/duffel.test.ts`
Expected: FAIL — `createDuffelClient is not a function` o equivalente.

- [ ] **Step 4.3: Implementar `createDuffelClient` con `searchAirports`**

Append a `src/services/duffel.ts`:

```ts
import { Duffel } from '@duffel/api';

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
      .filter((p): p is typeof p & { iata_code: string } => typeof p.iata_code === 'string')
      .map((p) => ({
        iataCode: p.iata_code,
        name: p.name,
        cityName: p.city_name ?? '',
        countryName: p.country_name ?? '',
      }));
  }

  async function searchOffers(_input: SearchOffersInput): Promise<FlightOffer[]> {
    throw new Error('Not implemented yet');
  }

  return { searchAirports, searchOffers };
}
```

- [ ] **Step 4.4: Correr el test (debe pasar)**

Run: `npm test -- tests/services/duffel.test.ts`
Expected: PASS — 3 tests de `searchAirports`.

- [ ] **Step 4.5: Commit**

```bash
git add src/services/duffel.ts tests/services/duffel.test.ts
git commit -m "feat(services): implement Duffel.searchAirports with zod boundary validation"
```

---

## Task 5: Implementar `searchOffers`

**Files:**
- Modify: `src/services/duffel.ts`
- Modify: `tests/services/duffel.test.ts`

- [ ] **Step 5.1: Escribir tests fallidos para `searchOffers`**

Append a `tests/services/duffel.test.ts`:

```ts
describe("createDuffelClient.searchOffers", () => {
  it("normaliza la respuesta del SDK a FlightOffer[]", async () => {
    createMock.mockResolvedValue({
      data: {
        offers: [
          {
            id: "off_123",
            total_amount: "542.30",
            total_currency: "USD",
            owner: { name: "Duffel Airways" },
            slices: [
              {
                segments: [
                  {
                    origin: { iata_code: "BOG" },
                    destination: { iata_code: "MIA" },
                    departing_at: "2026-07-15T10:00:00",
                    arriving_at: "2026-07-15T14:30:00",
                    duration: "PT4H30M",
                  },
                  {
                    origin: { iata_code: "MIA" },
                    destination: { iata_code: "MAD" },
                    departing_at: "2026-07-15T18:00:00",
                    arriving_at: "2026-07-16T08:00:00",
                    duration: "PT8H",
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchOffers({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
    });

    expect(createMock).toHaveBeenCalledWith({
      slices: [
        {
          origin: "BOG",
          destination: "MAD",
          departure_date: "2026-07-15",
          arrival_time: null,
          departure_time: null,
        },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
      return_offers: true,
    });
    expect(result).toEqual([
      {
        id: "off_123",
        totalAmount: "542.30",
        currency: "USD",
        airline: "Duffel Airways",
        segments: [
          { origin: "BOG", destination: "MIA", departureAt: "2026-07-15T10:00:00", arrivalAt: "2026-07-15T14:30:00" },
          { origin: "MIA", destination: "MAD", departureAt: "2026-07-15T18:00:00", arrivalAt: "2026-07-16T08:00:00" },
        ],
        stops: 1,
        durationMinutes: 750, // 4h30 + 8h
      },
    ]);
  });

  it("respeta passengers y cabinClass", async () => {
    createMock.mockResolvedValue({ data: { offers: [] } });
    const client = createDuffelClient("duffel_test_xyz");
    await client.searchOffers({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
      passengers: 2,
      cabinClass: "business",
    });
    expect(createMock).toHaveBeenCalledWith({
      slices: [
        {
          origin: "BOG",
          destination: "MAD",
          departure_date: "2026-07-15",
          arrival_time: null,
          departure_time: null,
        },
      ],
      passengers: [{ type: "adult" }, { type: "adult" }],
      cabin_class: "business",
      return_offers: true,
    });
  });

  it("lanza error legible si la respuesta no cumple el schema", async () => {
    createMock.mockResolvedValue({ data: { offers: [{ id: 1 }] } });
    const client = createDuffelClient("duffel_test_xyz");
    await expect(
      client.searchOffers({ origin: "BOG", destination: "MAD", departureDate: "2026-07-15" }),
    ).rejects.toThrow(/Duffel response/);
  });
});
```

- [ ] **Step 5.2: Correr el test (debe fallar)**

Run: `npm test -- tests/services/duffel.test.ts`
Expected: FAIL — `Not implemented yet` para `searchOffers`.

- [ ] **Step 5.3: Implementar `searchOffers` y helper de duración**

Reemplazar el cuerpo de `searchOffers` y añadir helper `parseIso8601DurationToMinutes` en `src/services/duffel.ts`:

```ts
/** Convierte ISO 8601 duration (e.g. "PT4H30M") a minutos. Retorna 0 si no parsea. */
export function parseIso8601DurationToMinutes(iso: string | undefined): number {
  if (!iso) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!match) return 0;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return days * 24 * 60 + hours * 60 + minutes;
}
```

Reemplazar `searchOffers` dentro de `createDuffelClient`:

```ts
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
        stops: Math.max(segments.length - 1, 0),
        durationMinutes,
      };
    });
  }
```

- [ ] **Step 5.4: Test específico para `parseIso8601DurationToMinutes`**

Append a `tests/services/duffel.test.ts`:

```ts
import { parseIso8601DurationToMinutes } from "../../src/services/duffel.js";

describe("parseIso8601DurationToMinutes", () => {
  it.each([
    ["PT4H30M", 270],
    ["PT8H", 480],
    ["PT45M", 45],
    ["P1DT2H", 26 * 60],
    ["", 0],
    [undefined, 0],
  ])("parsea %s → %i", (input, expected) => {
    expect(parseIso8601DurationToMinutes(input)).toBe(expected);
  });
});
```

- [ ] **Step 5.5: Correr todos los tests del servicio (deben pasar)**

Run: `npm test -- tests/services/duffel.test.ts`
Expected: PASS — todos los tests verdes.

- [ ] **Step 5.6: Verificar cobertura ≥ 90% en `src/services/`**

Run: `npm run test:coverage`
Expected: PASS, coverage de `src/services/duffel.ts` ≥ 90%.

- [ ] **Step 5.7: Commit**

```bash
git add src/services/duffel.ts tests/services/duffel.test.ts
git commit -m "feat(services): implement Duffel.searchOffers with normalized FlightOffer mapping"
```

---

## Task 6: Tool `currentTime` (puerto del repo de referencia)

**Files:**
- Create: `src/agent/tools/currentTime.ts`
- Test: `tests/agent/tools/currentTime.test.ts`

- [ ] **Step 6.1: Test fallido**

```ts
// tests/agent/tools/currentTime.test.ts
import { describe, expect, it } from "vitest";
import { currentTimeTool } from "../../../src/agent/tools/currentTime.js";

describe("currentTimeTool", () => {
  it("devuelve fecha+hora ISO con zona", async () => {
    const result = await currentTimeTool.invoke({});
    expect(typeof result).toBe("string");
    // ISO 8601 con T y zona o offset
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});
```

- [ ] **Step 6.2: Run (debe fallar)**

Run: `npm test -- tests/agent/tools/currentTime.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 6.3: Implementar la tool**

```ts
// src/agent/tools/currentTime.ts
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
```

- [ ] **Step 6.4: Run (debe pasar)**

Run: `npm test -- tests/agent/tools/currentTime.test.ts`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/agent/tools/currentTime.ts tests/agent/tools/currentTime.test.ts
git commit -m "feat(tools): add current_time tool for relative date resolution"
```

---

## Task 7: Tool `resolveAirport` (factoría con DI del cliente Duffel)

**Files:**
- Create: `src/agent/tools/resolveAirport.ts`
- Test: `tests/agent/tools/resolveAirport.test.ts`

- [ ] **Step 7.1: Test fallido**

```ts
// tests/agent/tools/resolveAirport.test.ts
import { describe, expect, it, vi } from "vitest";
import type { DuffelClient, AirportMatch } from "../../../src/services/duffel.js";
import { createResolveAirportTool } from "../../../src/agent/tools/resolveAirport.js";

function makeClient(matches: AirportMatch[]): DuffelClient {
  return {
    searchAirports: vi.fn().mockResolvedValue(matches),
    searchOffers: vi.fn(),
  };
}

describe("resolveAirportTool", () => {
  it("retorna JSON con array de matches", async () => {
    const client = makeClient([
      { iataCode: "BOG", name: "El Dorado", cityName: "Bogotá", countryName: "Colombia" },
    ]);
    const tool = createResolveAirportTool(client);
    const result = await tool.invoke({ query: "Bogotá" });
    expect(client.searchAirports).toHaveBeenCalledWith("Bogotá");
    expect(JSON.parse(result)).toEqual([
      { iataCode: "BOG", name: "El Dorado", cityName: "Bogotá", countryName: "Colombia" },
    ]);
  });

  it("devuelve array vacío serializado cuando no hay matches", async () => {
    const client = makeClient([]);
    const tool = createResolveAirportTool(client);
    const result = await tool.invoke({ query: "Atlántida" });
    expect(JSON.parse(result)).toEqual([]);
  });
});
```

- [ ] **Step 7.2: Run (debe fallar)**

Run: `npm test -- tests/agent/tools/resolveAirport.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 7.3: Implementar la tool**

```ts
// src/agent/tools/resolveAirport.ts
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
```

- [ ] **Step 7.4: Run (debe pasar)**

Run: `npm test -- tests/agent/tools/resolveAirport.test.ts`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/agent/tools/resolveAirport.ts tests/agent/tools/resolveAirport.test.ts
git commit -m "feat(tools): add resolve_airport tool with DuffelClient injection"
```

---

## Task 8: Tool `searchFlights`

**Files:**
- Create: `src/agent/tools/searchFlights.ts`
- Test: `tests/agent/tools/searchFlights.test.ts`

- [ ] **Step 8.1: Test fallido**

```ts
// tests/agent/tools/searchFlights.test.ts
import { describe, expect, it, vi } from "vitest";
import type { DuffelClient, FlightOffer } from "../../../src/services/duffel.js";
import { createSearchFlightsTool } from "../../../src/agent/tools/searchFlights.js";

function makeClient(offers: FlightOffer[]): DuffelClient {
  return {
    searchAirports: vi.fn(),
    searchOffers: vi.fn().mockResolvedValue(offers),
  };
}

const sampleOffer: FlightOffer = {
  id: "off_1",
  totalAmount: "542.30",
  currency: "USD",
  airline: "Duffel Airways",
  segments: [
    { origin: "BOG", destination: "MAD", departureAt: "2026-07-15T10:00:00", arrivalAt: "2026-07-15T22:00:00" },
  ],
  stops: 0,
  durationMinutes: 720,
};

describe("searchFlightsTool", () => {
  it("invoca searchOffers con defaults y devuelve top 3", async () => {
    const client = makeClient([sampleOffer, sampleOffer, sampleOffer, sampleOffer]);
    const tool = createSearchFlightsTool(client);
    const result = await tool.invoke({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
    });
    expect(client.searchOffers).toHaveBeenCalledWith({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
      passengers: 1,
      cabinClass: "economy",
    });
    const parsed = JSON.parse(result) as FlightOffer[];
    expect(parsed).toHaveLength(3);
  });

  it("respeta passengers y cabinClass", async () => {
    const client = makeClient([]);
    const tool = createSearchFlightsTool(client);
    await tool.invoke({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
      passengers: 2,
      cabinClass: "business",
    });
    expect(client.searchOffers).toHaveBeenCalledWith(
      expect.objectContaining({ passengers: 2, cabinClass: "business" }),
    );
  });

  it("rechaza fechas en formato no ISO", async () => {
    const client = makeClient([]);
    const tool = createSearchFlightsTool(client);
    await expect(
      tool.invoke({ origin: "BOG", destination: "MAD", departureDate: "15/07/2026" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 8.2: Run (debe fallar)**

Run: `npm test -- tests/agent/tools/searchFlights.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 8.3: Implementar la tool**

```ts
// src/agent/tools/searchFlights.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { DuffelClient } from '../../services/duffel.js';

const inputSchema = z.object({
  origin: z.string().length(3).describe('Código IATA de origen (3 letras). Ej: "BOG".'),
  destination: z.string().length(3).describe('Código IATA de destino (3 letras). Ej: "MAD".'),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato ISO YYYY-MM-DD')
    .describe('Fecha de salida en formato ISO (YYYY-MM-DD).'),
  passengers: z.number().int().min(1).default(1).describe('Número de pasajeros adultos.'),
  cabinClass: z
    .enum(['economy', 'premium_economy', 'business', 'first'])
    .default('economy')
    .describe('Clase de cabina.'),
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
```

- [ ] **Step 8.4: Run (debe pasar)**

Run: `npm test -- tests/agent/tools/searchFlights.test.ts`
Expected: PASS.

- [ ] **Step 8.5: Verificar cobertura tools**

Run: `npm run test:coverage`
Expected: PASS, coverage en `src/agent/tools/` ≥ 90%.

- [ ] **Step 8.6: Commit**

```bash
git add src/agent/tools/searchFlights.ts tests/agent/tools/searchFlights.test.ts
git commit -m "feat(tools): add search_flights tool with zod-validated IATA + ISO date input"
```

---

## Task 9: Modelo (puerto del repo de referencia)

**Files:**
- Create: `src/agent/model.ts`

- [ ] **Step 9.1: Crear el archivo**

```ts
// src/agent/model.ts
import { ChatOpenAI } from '@langchain/openai';
import { getEnv } from '../config/env.js';

/** Crea un ChatOpenAI configurado contra OpenRouter. */
export function createModel(): ChatOpenAI {
  const env = getEnv();
  const defaultHeaders: Record<string, string> = {};

  if (env.OPENROUTER_HTTP_REFERER) {
    defaultHeaders['HTTP-Referer'] = env.OPENROUTER_HTTP_REFERER;
  }
  if (env.OPENROUTER_APP_TITLE) {
    defaultHeaders['X-Title'] = env.OPENROUTER_APP_TITLE;
  }

  return new ChatOpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    temperature: env.OPENROUTER_TEMPERATURE,
    configuration: {
      baseURL: env.OPENROUTER_BASE_URL,
      ...(Object.keys(defaultHeaders).length > 0 ? { defaultHeaders } : {}),
    },
  });
}
```

- [ ] **Step 9.2: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9.3: Commit**

```bash
git add src/agent/model.ts
git commit -m "feat(agent): add ChatOpenAI model factory pointing at OpenRouter"
```

---

## Task 10: System prompt en español con `MessagesPlaceholder("history")`

**Files:**
- Create: `src/agent/prompt.ts`

- [ ] **Step 10.1: Crear el prompt**

```ts
// src/agent/prompt.ts
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

const SYSTEM = `Eres un agente didáctico de búsqueda de vuelos. Hablas en español.

Tienes tres herramientas:

1. current_time — devuelve la fecha y hora actuales en ISO 8601. Úsala para resolver expresiones relativas como "mañana", "el viernes" o "en julio".
2. resolve_airport(query) — convierte nombres de ciudad/país/aeropuerto a códigos IATA. Úsala antes de search_flights cuando el usuario da nombres en vez de códigos.
3. search_flights({ origin, destination, departureDate, passengers?, cabinClass? }) — busca ofertas. origin y destination son IATA de 3 letras; departureDate es YYYY-MM-DD.

Reglas estrictas:
- Datos mínimos requeridos para buscar: origen, destino y fecha de salida. Si falta alguno, PREGUNTA en lugar de inventar.
- Nunca inventes códigos IATA, fechas ni precios. Toda información externa pasa por las tools.
- Si resolve_airport devuelve varias opciones ambiguas, pregunta cuál.
- Cuando muestres ofertas, presenta el top 3 en español con: precio + moneda, aerolínea, duración (h/m), número de escalas y horarios de salida/llegada.
- AVISO DE SANDBOX: la primera vez en la sesión que muestres precios, advierte que provienen del sandbox de Duffel y no son reales. Si el historial ya contiene una advertencia tuya sobre el sandbox, NO la repitas.
- No realizas reservas: si te las piden, explica que está fuera de alcance.
- Mantén las respuestas concisas y útiles.`;

export const agentPrompt = ChatPromptTemplate.fromMessages([
  ['system', SYSTEM],
  new MessagesPlaceholder('history'),
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);
```

- [ ] **Step 10.2: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 10.3: Commit**

```bash
git add src/agent/prompt.ts
git commit -m "feat(agent): add Spanish system prompt with multi-turn history placeholder"
```

---

## Task 11: `createAgent` (compone modelo + prompt + tools con DI del cliente Duffel)

**Files:**
- Create: `src/agent/createAgent.ts`

- [ ] **Step 11.1: Crear `createAgent.ts`**

```ts
// src/agent/createAgent.ts
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { createModel } from './model.js';
import { createResolveAirportTool } from './tools/resolveAirport.js';
import { createSearchFlightsTool } from './tools/searchFlights.js';
import { currentTimeTool } from './tools/currentTime.js';
import { agentPrompt } from './prompt.js';
import type { DuffelClient } from '../services/duffel.js';
import { createDuffelClient } from '../services/duffel.js';
import { getEnv } from '../config/env.js';

export interface BuildExecutorOptions {
  duffel?: DuffelClient;
  verbose?: boolean;
}

/**
 * Compone el AgentExecutor. Si no se pasa `duffel`, se construye uno
 * a partir de DUFFEL_API_TOKEN (test-mode, validado en config/env.ts).
 */
export async function buildAgentExecutor(
  options: BuildExecutorOptions = {},
): Promise<AgentExecutor> {
  const duffel = options.duffel ?? createDuffelClient(getEnv().DUFFEL_API_TOKEN);
  const tools = [
    currentTimeTool,
    createResolveAirportTool(duffel),
    createSearchFlightsTool(duffel),
  ];

  const agent = await createToolCallingAgent({
    llm: createModel(),
    tools,
    prompt: agentPrompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: options.verbose ?? false,
  });
}
```

- [ ] **Step 11.2: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 11.3: Commit**

```bash
git add src/agent/createAgent.ts
git commit -m "feat(agent): compose AgentExecutor with injectable DuffelClient"
```

---

## Task 12: `runAgent` con historial multi-turno

**Files:**
- Create: `src/agent/runAgent.ts`
- Test: `tests/agent/runAgent.test.ts`

- [ ] **Step 12.1: Test fallido**

```ts
// tests/agent/runAgent.test.ts
import { describe, expect, it, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { runAgent } from "../../src/agent/runAgent.js";

describe("runAgent", () => {
  it("invoca el executor con input + history y retorna { output, history }", async () => {
    const executor = {
      invoke: vi.fn().mockResolvedValue({ output: "respuesta del agente" }),
    };

    const result = await runAgent("hola", [], { executor });

    expect(executor.invoke).toHaveBeenCalledWith({ input: "hola", history: [] });
    expect(result.output).toBe("respuesta del agente");
    expect(result.history).toHaveLength(2);
    expect(result.history[0]).toBeInstanceOf(HumanMessage);
    expect(result.history[1]).toBeInstanceOf(AIMessage);
    expect((result.history[0] as HumanMessage).content).toBe("hola");
    expect((result.history[1] as AIMessage).content).toBe("respuesta del agente");
  });

  it("acumula historial entre turnos", async () => {
    const executor = {
      invoke: vi
        .fn()
        .mockResolvedValueOnce({ output: "primera" })
        .mockResolvedValueOnce({ output: "segunda" }),
    };

    const t1 = await runAgent("uno", [], { executor });
    const t2 = await runAgent("dos", t1.history, { executor });

    expect(executor.invoke).toHaveBeenLastCalledWith({ input: "dos", history: t1.history });
    expect(t2.history).toHaveLength(4);
    expect((t2.history[2] as HumanMessage).content).toBe("dos");
    expect((t2.history[3] as AIMessage).content).toBe("segunda");
  });
});
```

- [ ] **Step 12.2: Run (debe fallar)**

Run: `npm test -- tests/agent/runAgent.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 12.3: Implementar `runAgent`**

```ts
// src/agent/runAgent.ts
import type { AgentExecutor } from 'langchain/agents';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { buildAgentExecutor, type BuildExecutorOptions } from './createAgent.js';

type AgentInvoker = Pick<AgentExecutor, 'invoke'>;

export interface RunAgentOptions extends BuildExecutorOptions {
  executor?: AgentInvoker;
}

export interface RunAgentResult {
  output: string;
  history: BaseMessage[];
}

/**
 * Ejecuta una vuelta del agente. El historial es ImmutableArray: cada llamada
 * recibe el historial previo y devuelve uno nuevo con los mensajes añadidos.
 */
export async function runAgent(
  input: string,
  history: BaseMessage[] = [],
  options: RunAgentOptions = {},
): Promise<RunAgentResult> {
  const executor = options.executor ?? (await buildAgentExecutor(options));
  const result = await executor.invoke({ input, history });
  const output = String(result.output ?? '');
  return {
    output,
    history: [...history, new HumanMessage(input), new AIMessage(output)],
  };
}
```

- [ ] **Step 12.4: Run (debe pasar)**

Run: `npm test -- tests/agent/runAgent.test.ts`
Expected: PASS — 2 tests verdes.

- [ ] **Step 12.5: Commit**

```bash
git add src/agent/runAgent.ts tests/agent/runAgent.test.ts
git commit -m "feat(agent): add multi-turn runAgent with history accumulation"
```

---

## Task 13: CLI single-shot + REPL

**Files:**
- Create: `src/index.ts`

- [ ] **Step 13.1: Crear el CLI**

```ts
// src/index.ts
import readline from 'node:readline';
import type { BaseMessage } from '@langchain/core/messages';
import { runAgent } from './agent/runAgent.js';

async function singleShot(input: string): Promise<void> {
  const { output } = await runAgent(input, [], { verbose: false });
  console.log(`\n${output}\n`);
}

async function repl(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdout.isTTY,
  });

  console.log('Flight Agent — REPL multi-turno. Salir: Ctrl+D o "salir".\n');

  let history: BaseMessage[] = [];

  const ask = (): void => {
    rl.question('> ', async (line) => {
      const input = line.trim();
      if (!input) return ask();
      if (input.toLowerCase() === 'salir') {
        rl.close();
        return;
      }
      try {
        const result = await runAgent(input, history, { verbose: false });
        history = result.history;
        console.log(`\n${result.output}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n[error] ${msg}\n`);
      }
      ask();
    });
  };

  rl.on('close', () => {
    console.log('\nHasta luego.');
    process.exit(0);
  });

  ask();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).join(' ').trim();
  if (argv) {
    await singleShot(argv);
  } else {
    await repl();
  }
}

main().catch((err) => {
  console.error('Error fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 13.2: Verificar typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos PASS.

- [ ] **Step 13.3: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): add single-shot and REPL multi-turn entry points"
```

---

## Task 14: Test de integración — búsqueda completa exitosa

**Files:**
- Create: `tests/agent/integration.test.ts`

> **Nota:** En estos tests inyectamos un executor mock al `runAgent`. No usamos un LLM real ni Duffel real; verificamos contratos del flujo (input/output, propagación de historial, mensajes de error).

- [ ] **Step 14.1: Crear el archivo de integración con el caso éxito**

```ts
// tests/agent/integration.test.ts
import { describe, expect, it, vi } from "vitest";
import { runAgent } from "../../src/agent/runAgent.js";

describe("integration: búsqueda completa exitosa", () => {
  it("emite el resumen del top 3 cuando el agente recibe un input completo", async () => {
    const executor = {
      invoke: vi.fn().mockResolvedValue({
        output:
          "Aviso: precios del sandbox de Duffel.\n\n" +
          "Top 3 ofertas BOG → MAD el 2026-07-15:\n" +
          "1. Duffel Airways — 542.30 USD — 12h — 0 escalas — 10:00 → 22:00\n" +
          "2. Duffel Airways — 612.00 USD — 13h — 1 escala — 09:00 → 22:00\n" +
          "3. Duffel Airways — 700.50 USD — 14h — 1 escala — 11:00 → 01:00",
      }),
    };

    const result = await runAgent(
      "vuelos de Bogotá a Madrid el 15 de julio",
      [],
      { executor },
    );

    expect(executor.invoke).toHaveBeenCalledWith({
      input: "vuelos de Bogotá a Madrid el 15 de julio",
      history: [],
    });
    expect(result.output).toMatch(/sandbox de Duffel/);
    expect(result.output).toMatch(/Top 3/);
    expect(result.history).toHaveLength(2);
  });
});
```

- [ ] **Step 14.2: Run**

Run: `npm test -- tests/agent/integration.test.ts`
Expected: PASS.

- [ ] **Step 14.3: Commit**

```bash
git add tests/agent/integration.test.ts
git commit -m "test(agent): integration happy path returns top-3 with sandbox notice"
```

---

## Task 15: Test de integración — ciudad no resuelta

**Files:**
- Modify: `tests/agent/integration.test.ts`

- [ ] **Step 15.1: Append del caso ciudad no resuelta**

```ts
describe("integration: ciudad no resuelta", () => {
  it("pide aclaración cuando el agente no encuentra IATA para una ciudad", async () => {
    const executor = {
      invoke: vi.fn().mockResolvedValue({
        output: "No encontré un aeropuerto que coincida con \"Atlántida\". ¿Puedes darme otra ciudad cercana o un código IATA?",
      }),
    };

    const result = await runAgent("vuelos de Atlántida a Madrid el 15 de julio", [], { executor });

    expect(result.output).toMatch(/no encontré|otra ciudad|IATA/i);
    expect(result.history).toHaveLength(2);
  });
});
```

- [ ] **Step 15.2: Run**

Run: `npm test -- tests/agent/integration.test.ts`
Expected: PASS.

- [ ] **Step 15.3: Commit**

```bash
git add tests/agent/integration.test.ts
git commit -m "test(agent): integration unresolved city asks for clarification"
```

---

## Task 16: Test de integración — info faltante (multi-turno)

**Files:**
- Modify: `tests/agent/integration.test.ts`

- [ ] **Step 16.1: Append del caso multi-turno**

```ts
describe("integration: info faltante con multi-turno", () => {
  it("pregunta por origen y completa la búsqueda en el segundo turno", async () => {
    const executor = {
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          output: "¿Desde qué ciudad sales? También necesito una fecha exacta.",
        })
        .mockResolvedValueOnce({
          output:
            "Aviso: precios del sandbox de Duffel.\n\n" +
            "Top 3 BOG → MAD el 2026-07-15: 1. ... 2. ... 3. ...",
        }),
    };

    const turn1 = await runAgent("quiero ir a Madrid", [], { executor });
    expect(turn1.output).toMatch(/desde qué ciudad/i);
    expect(turn1.history).toHaveLength(2);

    const turn2 = await runAgent("Bogotá, el 15 de julio", turn1.history, { executor });
    expect(executor.invoke).toHaveBeenLastCalledWith({
      input: "Bogotá, el 15 de julio",
      history: turn1.history,
    });
    expect(turn2.output).toMatch(/Top 3/);
    expect(turn2.history).toHaveLength(4);
  });
});
```

- [ ] **Step 16.2: Run la suite completa**

Run: `npm test`
Expected: PASS — todos los tests verdes.

- [ ] **Step 16.3: Commit**

```bash
git add tests/agent/integration.test.ts
git commit -m "test(agent): integration multi-turn flow with missing info"
```

---

## Task 17: Smoke test manual contra Duffel test mode (NO CI)

**Files:**
- (Sin cambios de código.)

> **Objetivo:** verificar que las llamadas reales al SDK funcionan con un token `duffel_test_*` antes de cerrar el PR. Este paso es **manual**, no se automatiza.

- [ ] **Step 17.1: Crear `env.local` localmente**

```bash
cp env.local.example env.local
# Editar env.local y poner OPENROUTER_API_KEY y DUFFEL_API_TOKEN reales (test).
```

- [ ] **Step 17.2: Smoke single-shot**

Run: `npm run dev -- "vuelos de Bogotá a Madrid el 15 de julio de 2026"`
Expected:
- El proceso no lanza error.
- La salida contiene el aviso de sandbox.
- Lista al menos una oferta con precio + aerolínea + duración + escalas + horarios.

- [ ] **Step 17.3: Smoke REPL**

Run: `npm run dev`
Conversación esperada:
```
> hola, quiero ir a Madrid en julio
agent: ¿Desde qué ciudad sales? ¿Tienes fechas exactas?
> desde Bogotá, el 15
agent: [aviso de sandbox + top 3]
> ¿hay algo sin escalas?
agent: [refina con el contexto previo, sin repetir el aviso]
> salir
Hasta luego.
```

- [ ] **Step 17.4: Documentar el resultado del smoke**

Si el smoke falla (e.g. el SDK requiere otra forma para `offerRequests.create` con `return_offers`), ajustar `src/services/duffel.ts` y los tests del servicio. NO commitear `env.local`.

> **Si el smoke obliga a un cambio:** crear un commit `fix(services): align SDK call shape with Duffel @duffel/api vX.Y.Z` y referenciar la doc oficial en el mensaje.

---

## Task 18: README + brief sync + verification gate

**Files:**
- Modify: `README.md` (eliminar la nota de "Estado: planning").
- Modify: `docs/planning/brief.md` (añadir `@vitest/coverage-v8` a la lista de devDeps aprobadas).
- (Validar que `CLAUDE.md` sigue siendo veraz; si no, ajustar.)

- [ ] **Step 18.1: Actualizar `README.md`**

Eliminar el bloque de "Estado: planning". Verificar que la sección "Project structure" coincide con lo realmente creado. Confirmar que los comandos listados (`npm run dev`, `dev -- "..."`, `test`, `lint`, `typecheck`, `build`, `start`, `test:watch`) existen en `package.json`. Añadir `npm run test:coverage` a la lista.

- [ ] **Step 18.2: Actualizar `docs/planning/brief.md`**

Editar la sección "Constraints" → línea de dependencias aprobadas:

Reemplazar:
> Dev: `eslint`, `typescript`, `tsx`, `vitest`, `@types/node`.

Por:
> Dev: `eslint`, `@eslint/js`, `typescript-eslint`, `typescript`, `tsx`, `vitest`, `@vitest/coverage-v8`, `@types/node`.

Y añadir una nota: "`@vitest/coverage-v8` requerido por el DoD (cobertura ≥ 90%)."

- [ ] **Step 18.3: Verificación final — gate del DoD**

Run en orden:
```bash
npm run lint
npm run typecheck
npm run test:coverage
```

Expected:
- Lint: 0 warnings, 0 errors.
- Typecheck: PASS.
- Tests: todos verdes.
- Coverage: thresholds (`src/services/**` y `src/agent/tools/**`) ≥ 90% en lines/branches/statements/functions.

Si algún umbral no pasa, añadir tests a la suite del módulo afectado (no relajar el threshold).

- [ ] **Step 18.4: Confirmar funcionalidad del CLI (modo dual)**

Run: `npm run dev -- "vuelos de Bogotá a Madrid el 15 de julio"` → output con aviso de sandbox + top 3.
Run: `npm run dev` → entra al REPL; `salir` cierra limpiamente; `Ctrl+D` también.

- [ ] **Step 18.5: Commit final**

```bash
git add README.md docs/planning/brief.md
git commit -m "docs: sync README to implemented state and approve coverage-v8 in brief"
```

---

## Self-Review Checklist (DoD del brief)

| Requisito del brief | Cubierto en |
|---|---|
| `npm run lint` y `npm run typecheck` sin warnings | Tasks 1, 18 |
| `npm test` con cobertura ≥ 90% en `src/services/` y `src/agent/tools/` | Tasks 1.4 (config), 5.6 / 8.5 / 18.3 (gates) |
| Cada tool con tests unitarios y servicio Duffel mockeado | Tasks 7, 8 |
| Test integración: búsqueda completa exitosa | Task 14 |
| Test integración: ciudad no resuelta | Task 15 |
| Test integración: info faltante (multi-turno) | Task 16 |
| `runAgent` permite inyección de `AgentExecutor` | Task 12 |
| CLI single-shot + REPL (Ctrl+D / `salir`) | Task 13 |
| Docstrings TSDoc en públicas | Tasks 4, 5, 6, 7, 8, 9, 11, 12 |
| `README.md` documenta install + env + comandos + caveat + add-tool | Task 18 |
| `env.local.example` lista todas las variables | Task 1.5 |
| Brief refleja diseño implementado | Task 18.2 |
| **Constraints técnicos** | |
| TypeScript ESM, sin `require` | Tasks 1.2, 1.3 (`type: module`, NodeNext) |
| Sin `any` salvo boundary + zod | Task 1.3 (regla ESLint) |
| zod en boundaries (env + Duffel responses) | Tasks 2, 3, 4, 5 |
| Solo Duffel test mode | Task 2 (guard `duffel_test_*`) |
| Sin persistencia | Task 13 (REPL con history en RAM) |
| Tools no llaman al SDK directamente | Tasks 7, 8 (vía `DuffelClient`) |
| Fail-fast en config | Task 2 |
| Failure modes (token inválido, ciudad no resuelta, timeout) | Tasks 2, 13, 15 (token guard, REPL try/catch, prompt) |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-flight-agent.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with two-stage review (code review + brief alignment). Best for keeping context lean and getting iterative feedback.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints (suggested batches: Tasks 1–5, 6–8, 9–13, 14–18).

**Which approach?**
