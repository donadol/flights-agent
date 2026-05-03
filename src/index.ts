// src/index.ts
import readline from 'node:readline';
import type { BaseMessage } from '@langchain/core/messages';
import { runAgent } from './agent/runAgent.js';
import { translateAgentError } from './agent/errors.js';

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

  console.log('Flights Agent — REPL multi-turno. Salir: Ctrl+D o "salir".\n');

  let history: BaseMessage[] = [];
  process.stdout.write('> ');
  // Async iterator drains lines (interactive or piped) one at a time and
  // awaits each turn before reading the next; EOF / "salir" ends the loop.
  for await (const rawLine of rl) {
    const input = rawLine.trim();
    if (!input) {
      process.stdout.write('> ');
      continue;
    }
    if (input.toLowerCase() === 'salir') break;
    try {
      const result = await runAgent(input, history, { verbose: false });
      history = result.history;
      console.log(`\n${result.output}\n`);
    } catch (err) {
      console.error(`\n[error] ${translateAgentError(err)}\n`);
    }
    process.stdout.write('> ');
  }
  rl.close();
  console.log('\nHasta luego.');
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
  console.error('Error fatal:', translateAgentError(err));
  process.exit(1);
});
