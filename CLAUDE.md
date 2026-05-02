# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Qué es este proyecto

Agente didáctico de búsqueda de vuelos en español: LangChain + TypeScript + OpenRouter (LLM) + Duffel API (test mode). Patrón de capas inspirado en `10X-Builders-langchain-agent`. Está en fase de planning — el diseño completo vive en [`docs/planning/brief.md`](docs/planning/brief.md).

**El brief es la fuente de verdad del diseño.** Si cambia el alcance, los constraints, o la arquitectura, actualízalo primero. El código y la documentación deben mantenerse alineados con él.

## Restricciones técnicas no negociables

- **TypeScript ESM**, Node 20+. Sin CommonJS, sin `require`.
- **No `any`** salvo en boundaries inmediatamente seguidos de validación con `zod`.
- **`zod` en los límites**: env vars y respuestas externas (Duffel). El resto del código asume tipos confiables.
- **Solo Duffel test mode**: `DUFFEL_API_TOKEN` siempre `duffel_test_*`. El cliente nunca debe poder apuntar a producción.
- **Sin persistencia**: el historial conversacional vive solo en RAM del proceso REPL. No archivos, no DB.
- **Tools no llaman al SDK de Duffel directamente**: pasan por `src/services/duffel.ts`. Esto mantiene los tests rápidos y aislados.
- **Fail-fast en config**: env inválido aborta el proceso con mensaje claro antes de cualquier llamada externa.

## Responsabilidades por capa

- `src/index.ts` — CLI single-shot y REPL. Lo más fino posible; delega en `runAgent`.
- `src/config/env.ts` — carga `env.local` y valida con zod.
- `src/services/duffel.ts` — wrapper sobre `@duffel/api` con tipos normalizados (`FlightOffer`, `Segment`, etc.).
- `src/agent/model.ts` — instancia `ChatOpenAI` configurado contra OpenRouter.
- `src/agent/prompt.ts` — system prompt en español, instrucciones de uso de tools.
- `src/agent/tools/*` — tools pequeñas componibles. Cada una recibe su servicio por inyección.
- `src/agent/createAgent.ts` — ensambla modelo + prompt + tools en `AgentExecutor`.
- `src/agent/runAgent.ts` — `{ input, history } → { output, history }`. Acepta `AgentExecutor` opcional para DI en tests.

## Testing

- **`vitest`**, cobertura **≥ 90%** en `src/services/` y `src/agent/tools/`.
- Cada tool tiene unit tests con el servicio mockeado (no se mockea `@duffel/api` directamente).
- Test de integración del agente con Duffel mockeado para: búsqueda exitosa, ciudad no resuelta, info faltante (multi-turno).
- `runAgent` recibe un executor inyectable para evitar red en tests rápidos.

## Cómo añadir una nueva tool

1. Si depende de un servicio externo, **primero** encapsúlalo en `src/services/`.
2. Crea `src/agent/tools/<nombre>.ts`. Define el input con `zod` y exporta vía `tool(...)`.
3. Regístrala en `src/agent/createAgent.ts`.
4. Actualiza `src/agent/prompt.ts` describiendo *cuándo* usarla.
5. Tests unitarios mockeando el servicio. Mantén la cobertura ≥ 90%.
6. Si la tool añade un nuevo failure mode, documéntalo en el brief.

## Multi-turno

- El historial es un array de mensajes en RAM (LangChain `MessagesPlaceholder("history")`).
- El REPL en `index.ts` mantiene la historia entre turnos del mismo proceso.
- Cuando faltan datos, el agente pregunta — **no inventa** códigos IATA, fechas ni precios.

## Caveat de precios simulados

Duffel test mode devuelve precios sandbox (Duffel Airways + algunas aerolíneas reales con datos ficticios). El agente debe **advertir una vez por sesión** que los precios no son reales. La lógica de la advertencia vive en el agente, no en las tools.

## Dependencias

Aprobadas inicialmente: `@duffel/api`, `@langchain/core`, `@langchain/openai`, `langchain`, `dotenv`, `zod`. Dev: `eslint`, `typescript`, `tsx`, `vitest`, `@types/node`. **Cualquier dependencia nueva requiere justificación funcional** (no añadir por costumbre).

## Comandos

- `npm run dev` — REPL.
- `npm run dev -- "pregunta"` — single-shot.
- `npm run typecheck` — tipos sin build.
- `npm run lint` — ESLint, sin warnings.
- `npm run test` — vitest una vez.
- `npm run test:watch` — vitest en watch.

## Disciplina de cambios

- Cambios de alcance, arquitectura o constraints → actualiza `brief.md` primero.
- Cambios de uso visible → actualiza `README.md`.
- Cambios de patrón interno → actualiza `CLAUDE.md`.
- No introducir abstracciones especulativas (YAGNI). Tres líneas similares es mejor que una abstracción prematura.
- No añadir error handling defensivo para escenarios imposibles. Confía en los tipos y en la validación de boundary.
