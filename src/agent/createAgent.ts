// src/agent/createAgent.ts
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { createModel } from './model.js';
import { createResolveAirportTool } from './tools/resolveAirport.js';
import { createSearchFlightsTool } from './tools/searchFlights.js';
import { currentTimeTool } from './tools/currentTime.js';
import { agentPrompt, AGENT_SYSTEM_PROMPT } from './prompt.js';
import type { DuffelClient } from '../services/duffel.js';
import { createDuffelClient } from '../services/duffel.js';
import { getEnv } from '../config/env.js';

export interface BuildExecutorOptions {
  duffel?: DuffelClient;
  verbose?: boolean;
}

/**
 * Lanza si alguna tool registrada no está nombrada en el system prompt.
 * Atrapa el drift más común: renombrar una tool y olvidar el prompt.
 */
export function assertToolsCoveredByPrompt(
  toolNames: readonly string[],
  systemPrompt: string,
): void {
  const missing = toolNames.filter((n) => !systemPrompt.includes(n));
  if (missing.length > 0) {
    throw new Error(
      `Tools no documentadas en el system prompt: ${missing.join(', ')}. ` +
        `Actualiza AGENT_SYSTEM_PROMPT en src/agent/prompt.ts.`,
    );
  }
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

  assertToolsCoveredByPrompt(
    tools.map((t) => t.name),
    AGENT_SYSTEM_PROMPT,
  );

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
