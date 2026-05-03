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
