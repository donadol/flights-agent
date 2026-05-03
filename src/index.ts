// src/index.ts
import readline from 'node:readline';
import type { BaseMessage } from '@langchain/core/messages';
import { ZodError } from 'zod';
import { runAgent } from './agent/runAgent.js';

function formatError(err: unknown): string {
  if (err instanceof ZodError) {
    const issues = err.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    return `Configuración inválida:\n${issues}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

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
      console.error(`\n[error] ${formatError(err)}\n`);
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
  console.error('Error fatal:', formatError(err));
  process.exit(1);
});
