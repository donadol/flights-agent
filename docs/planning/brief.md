# Technical Brief — Flights Agent

## 1. Título de la tarea

Agente didáctico de búsqueda de vuelos en español, capaz de buscar ofertas reales de itinerarios mediante la API de Duffel y mantener una conversación multi-turno para refinar la búsqueda.

---

## 2. Contexto

Este proyecto extiende el patrón del agente didáctico construido en `10X-Builders-langchain-agent` (LangChain + TypeScript + OpenRouter), aplicándolo a un dominio nuevo: la búsqueda de vuelos.

El sistema actual del repo de referencia es un agente de consola con dos herramientas simples (`calculator`, `current_time`) que muestra cómo razonar y componer tools. Su arquitectura por capas (CLI → runAgent → createAgent → tools/prompt/model + config validado con zod) es sólida pero su dominio es trivial.

El entorno actual es Node.js 20+, TypeScript ESM, LangChain, OpenRouter como puerta al LLM, vitest para pruebas y eslint para estilo.

El problema que resuelve este nuevo proyecto:

- El agente original no muestra cómo integrar APIs externas reales con esquemas complejos.
- No ilustra cómo componer **varias** tools en una secuencia razonada (resolver entidad → buscar).
- No demuestra **conversación multi-turno** con preguntas de aclaración.
- El dominio "calculadora + hora" no genera valor demostrable más allá de lo pedagógico.

El objetivo de esta tarea es construir un agente de búsqueda de vuelos que:

- Muestre la integración con una API real de viajes (Duffel) usando su SDK oficial de TypeScript.
- Demuestre el patrón de **tools pequeñas componibles** (resolver aeropuerto → buscar) sobre el de "una mega-tool".
- Permita una experiencia conversacional (alcance multi-turno) con un REPL en consola.
- Mantenga el enfoque pedagógico y la disciplina de calidad del repo de referencia (capas claras, validación, tests, lint).

> ⚠️ Nota técnica relevante: Amadeus Self-Service será decommissioned el 17 de julio de 2026, lo que descarta la opción más natural de "datos reales gratis". Tras evaluar Travelpayouts, SerpAPI, Skyscanner, flightapi.io y otras alternativas, **Duffel test mode** se eligió como mejor balance entre DX (SDK oficial TypeScript), sostenibilidad y calidad de su contrato de API. Los precios del sandbox son simulados, lo cual se documenta y se comunica al usuario una vez por sesión: el aprendizaje real está en la *forma* de la integración, no en los precios.

---

## 3. Requerimientos técnicos

### Tech Stack

- **Lenguaje**: TypeScript (ESM)
- **Versión mínima**: Node.js 20+
- **Framework de agente**: LangChain (`@langchain/core`, `@langchain/openai`, `langchain`)
- **LLM**: OpenRouter (vía interfaz OpenAI-compatible)
- **API de vuelos**: Duffel (`@duffel/api`) — modo test
- **Validación**: `zod` (env y respuestas externas)
- **Tests**: `vitest`
- **Lint / formato**: `eslint` (config alineada al repo de referencia)
- **Carga de env**: `dotenv` desde `env.local`

---

### Arquitectura

Patrón por capas, alineado con el repo de referencia, con una capa adicional de **servicios** para encapsular el SDK de Duffel y mantener las tools testeables en aislamiento.

```
src/
├── index.ts                    # CLI: modo single-shot + REPL
├── config/
│   └── env.ts                  # Carga env.local + validación con zod
├── services/
│   └── duffel.ts               # Cliente Duffel + tipos normalizados (FlightOffer, etc.)
├── agent/
│   ├── model.ts                # ChatOpenAI vía OpenRouter
│   ├── prompt.ts               # System prompt en español, instrucciones de uso de tools
│   ├── tools/
│   │   ├── resolveAirport.ts   # ciudad/país → IATA (Duffel /places/suggestions)
│   │   ├── searchFlights.ts    # IATA + fecha ISO → ofertas
│   │   └── currentTime.ts      # heredada del repo de referencia
│   ├── createAgent.ts          # Compone modelo + prompt + tools en AgentExecutor
│   └── runAgent.ts             # Ejecuta una vuelta: { input, history } → { output, history }
└── tests/                      # Vitest: unit por capa + integración del agente
```

**Principios y patrones:**

- **Separation of concerns por capa**: configuración, servicios externos, capacidades del dominio (tools), composición del agente, ejecución y CLI.
- **Dependency Injection**: `runAgent` acepta un `AgentExecutor` opcional para tests rápidos sin red. Las tools reciben el cliente de servicios por inyección.
- **Stateless tools**: cada tool es pura respecto a su input; el contexto multi-turno vive en el `history` del agente, no dentro de las tools.
- **Fail-fast en config**: si faltan variables de entorno o son inválidas, el proceso aborta con mensaje claro antes de cualquier llamada al LLM o a Duffel.
- **Boundary validation con zod**: tanto las env vars como las respuestas de Duffel se validan en sus límites; el resto del código asume tipos confiables.

---

### Input y Output esperados

**Input al agente (CLI / REPL):**

```
Tipo: string en lenguaje natural (español)
Ejemplos:
  - "vuelos de Bogotá a Madrid el 15 de julio"
  - "quiero ir a Buenos Aires desde Lima en agosto, lo más barato"
  - "¿hay algo sin escalas?"          (refinamiento dentro del REPL)
```

**Input a la tool `resolve_airport`:**

```ts
ResolveAirportInput
- query: string         // "Bogotá", "Madrid, España", "JFK"
```

**Output de `resolve_airport`:**

```ts
AirportMatch[]
- iataCode: string      // "BOG"
- name: string          // "El Dorado International Airport"
- cityName: string      // "Bogotá"
- countryName: string   // "Colombia"
```

**Input a la tool `search_flights`:**

```ts
SearchFlightsInput
- origin: string                                                // IATA, "BOG"
- destination: string                                           // IATA, "MAD"
- departureDate: string                                         // ISO date, "2026-07-15"
- passengers: number                                            // default 1
- cabinClass?: "economy" | "premium_economy" | "business" | "first"
```

**Output de `search_flights`:**

```ts
FlightOffer[]
- id: string
- totalAmount: string         // "542.30"
- currency: string            // "USD"
- airline: string             // ej. "Duffel Airways"
- segments: Segment[]         // tramos: origen, destino, salida, llegada
- stops: number
- durationMinutes: number
```

**Output al usuario:**

Texto conversacional en español, con resumen legible del top 3 de ofertas (precio + aerolínea + duración + escalas + horarios). Si faltan datos para buscar, el agente pregunta en lugar de inventar. La primera vez por sesión, advierte que los precios son del sandbox de Duffel.

---

### Comportamiento esperado

El agente debe:

- Recibir una petición de vuelos en lenguaje natural.
- Identificar los datos mínimos requeridos: origen, destino, fecha de salida.
- Pedir aclaraciones cuando falte algún dato (alcance multi-turno).
- Componer herramientas: resolver ciudades a IATA, resolver fechas relativas con `current_time` cuando aplique, y luego buscar.
- Invocar Duffel únicamente a través de la capa `services/duffel.ts`.
- Resumir los resultados en español de forma clara, destacando precio, aerolínea, duración y escalas.
- Mantener contexto entre turnos del REPL para permitir refinamientos ("¿algo más barato?", "¿sin escalas?", "y si salgo dos días después?").
- Advertir, una vez por sesión, que los precios provienen del sandbox de Duffel.

El agente no debe:

- Inventar códigos IATA, fechas ni precios — todo dato externo viaja vía tools.
- Realizar reservas (fuera de alcance).
- Persistir nada en disco (historial solo en RAM del proceso REPL).

---

## 4. Constraints

- **Solo TypeScript ESM** (sin CommonJS, sin `require`).
- **Solo Duffel test mode**: el código nunca debe apuntar a producción; el SDK se inicializa con `DUFFEL_API_TOKEN` que en este proyecto siempre será un token `duffel_test_*`.
- **Sin persistencia**: la conversación vive solo en la memoria del proceso REPL.
- **Type hints completos**: prohibido `any` salvo en los límites donde se valida con zod inmediatamente después.
- **Validación con zod en los boundaries**: env vars y respuestas Duffel.
- **Lint y estilo**: `eslint` con la config del repo de referencia; sin warnings.
- **Sin dependencias adicionales** sin justificación. Aprobadas inicialmente: `@duffel/api`, `@langchain/core`, `@langchain/openai`, `langchain`, `dotenv`, `zod`. Dev: `eslint`, `@eslint/js`, `typescript-eslint`, `typescript`, `tsx`, `vitest`, `@vitest/coverage-v8`, `@types/node`.
- `@vitest/coverage-v8` requerido por el DoD (cobertura ≥ 90%). `@eslint/js` y `typescript-eslint` provistos por la config de ESLint.
- **Failure modes cubiertos**:
  - Env inválido → fail-fast con mensaje claro.
  - Token Duffel inválido o inactivo → mensaje legible al usuario, sin stack trace crudo.
  - Aeropuerto no resuelto → el agente pregunta de nuevo, no inventa.
  - Caída de Duffel o timeout → el agente lo comunica y ofrece reintentar.
- **Compatibilidad CLI**: el modo single-shot (`npm run dev -- "pregunta"`) sigue siendo válido y testeable, igual que en el repo de referencia.

---

## 5. Definition of Done

El trabajo se considera terminado cuando:

- `npm run lint` y `npm run typecheck` pasan sin warnings.
- `npm test` pasa con cobertura **≥ 90%** en `src/services/` y `src/agent/tools/`.
- Cada tool tiene tests unitarios con el servicio Duffel mockeado.
- Existe un test de integración del agente con Duffel mockeado que cubre, como mínimo:
  - Búsqueda completa exitosa.
  - Caso de ciudad no resuelta (el agente pide aclaración).
  - Caso de información faltante (alcance multi-turno).
- `runAgent` permite inyección de un `AgentExecutor` para tests rápidos sin red.
- El CLI funciona en ambos modos:
  - `npm run dev -- "vuelos de Bogotá a Madrid el 15 de julio"` (single-shot).
  - `npm run dev` (REPL multi-turno; salida con `Ctrl+D` o `salir`).
- Todas las funciones públicas, tools y servicios tienen docstrings TSDoc breves.
- `README.md` documenta: instalación, variables de entorno (incluyendo `DUFFEL_API_TOKEN`), comandos, caveat de precios simulados, y cómo añadir una nueva tool.
- `env.local.example` lista todas las variables necesarias con un ejemplo seguro.
- Este `brief.md` refleja con precisión el diseño implementado.
