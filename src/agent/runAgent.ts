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
