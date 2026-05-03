# Flight Agent

Agente didáctico de búsqueda de vuelos en español, construido con LangChain y TypeScript. Conversa con el usuario, resuelve aeropuertos a códigos IATA y consulta ofertas reales en la API de Duffel.

El proyecto está implementado: CLI single-shot y REPL multi-turno, integración con Duffel test mode y OpenRouter, suite de 35 tests (unit + integración) y cobertura ≥ 90% en `src/services/` y `src/agent/tools/`. El diseño que guio la implementación vive en [`docs/planning/brief.md`](docs/planning/brief.md).

## Requirements

- Node.js 20+
- npm 10+
- Cuenta gratuita en [Duffel](https://duffel.com) (test mode)
- API key de [OpenRouter](https://openrouter.ai)

## Installation

```bash
npm install
```

## Environment setup

El proyecto carga configuración desde `env.local` en la raíz del repositorio.

```bash
# LLM vía OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEMPERATURE=0
OPENROUTER_HTTP_REFERER=https://your-app-domain.com
OPENROUTER_APP_TITLE=Flight Agent

# Duffel (solo test mode)
DUFFEL_API_TOKEN=duffel_test_xxxxxxxxxxxxxx
```

Copia `env.local.example` a `env.local` y completa los valores.

## Usage

**Modo single-shot** (una pregunta, una respuesta):

```bash
npm run dev -- "vuelos de Bogotá a Madrid el 15 de julio"
```

**Modo REPL** (conversación multi-turno):

```bash
npm run dev
> Hola, quiero ir a Madrid en julio
agent: ¿Desde qué ciudad sales? ¿Tienes fechas exactas?
> Bogotá, el 15
agent: [busca y devuelve top 3 ofertas]
> ¿hay algo sin escalas?
agent: [refina con el contexto previo]
```

Salir del REPL: `Ctrl+D` o escribir `salir`.

## Scripts

- `npm run dev`: ejecuta el agente con `tsx`.
- `npm run build`: compila a `dist/`.
- `npm run start`: ejecuta el build compilado.
- `npm run test`: corre los tests una vez.
- `npm run test:watch`: tests en modo watch.
- `npm run test:coverage`: tests con cobertura (≥90% en `src/services/` y `src/agent/tools/`).
- `npm run lint`: corre ESLint.
- `npm run typecheck`: valida tipos sin emitir build.

## Architecture overview

El proyecto sigue una arquitectura por capas, alineada con [`10X-Builders-langchain-agent`](https://github.com/) (repo de referencia), con una capa adicional de servicios que encapsula el SDK de Duffel.

- **Interface layer** (`src/index.ts`): CLI con dos modos (single-shot y REPL).
- **Application layer** (`src/agent/runAgent.ts`): expone una función de ejecución con DI para tests.
- **Composition layer** (`src/agent/createAgent.ts`): ensambla modelo, prompt y tools en un `AgentExecutor`.
- **Domain capabilities** (`src/agent/tools/*`): `resolveAirport`, `searchFlights`, `currentTime`.
- **Services layer** (`src/services/duffel.ts`): cliente Duffel con tipos normalizados.
- **Configuration layer** (`src/config/env.ts`): carga y valida `env.local` con `zod`.

El detalle completo del diseño está en [`docs/planning/brief.md`](docs/planning/brief.md).

## Project structure

```
src/
├── index.ts                    # CLI: single-shot + REPL
├── config/
│   └── env.ts                  # Env + validación zod (lazy dotenv)
├── services/
│   └── duffel.ts               # Cliente Duffel + tipos normalizados + zod schemas
└── agent/
    ├── model.ts                # ChatOpenAI vía OpenRouter
    ├── prompt.ts               # System prompt en español
    ├── tools/
    │   ├── resolveAirport.ts   # ciudad → IATA (factoría con DI)
    │   ├── searchFlights.ts    # IATA + fecha → ofertas (factoría con DI)
    │   └── currentTime.ts      # hora actual / fechas relativas
    ├── createAgent.ts          # Compone agente (DuffelClient inyectable)
    └── runAgent.ts             # Ejecuta una vuelta multi-turno
tests/                          # Vitest: mismo layout que src/ + integración
tsconfig.json                   # Build (rootDir: src)
tsconfig.test.json              # Typecheck que también cubre tests/
```

## Add a new tool

1. Crea un archivo en `src/agent/tools/`.
2. Si la tool consume un servicio externo, encapsúlalo primero en `src/services/`.
3. Exporta la tool con `tool(...)` de LangChain. Define el input schema con `zod`.
4. Regístrala en `src/agent/createAgent.ts`.
5. Actualiza `src/agent/prompt.ts` para describir cuándo usarla.
6. Añade tests unitarios mockeando el servicio.

## Implementation notes

- Hay dos `tsconfig`s: `tsconfig.json` para `npm run build` (solo producción, `rootDir: src`); `tsconfig.test.json` para `npm run typecheck` (cubre `src` + `tests`, `noEmit: true`).
- `env.local` se carga relativo a `process.cwd()`. Ejecuta `npm run dev` desde la raíz del proyecto.
- Las tools nunca llaman a `@duffel/api` directamente: consumen `DuffelClient` inyectado a través de `createAgent`.
- El SDK `@duffel/api` 4.x marca el parámetro `query` de `suggestions.list` como deprecated en favor de `name`, pero el endpoint en vivo `/places/suggestions` aún requiere `query`. Pasamos `query` en consecuencia.

## Notes

- **Precios simulados**: Duffel test mode devuelve ofertas mayoritariamente de su aerolínea ficticia (Duffel Airways) con precios sandbox. La integración (auth, schema, flujos) es production-grade; los precios no son reales y el agente lo advierte una vez por sesión.
- **Sin persistencia**: el historial conversacional vive solo en memoria del proceso REPL.
- **Solo test mode**: el código nunca debe apuntar al endpoint de producción de Duffel.
