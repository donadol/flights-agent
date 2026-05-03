import { describe, expect, it, vi } from "vitest";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { buildAgentExecutor } from "../../src/agent/createAgent.js";
import type { DuffelClient } from "../../src/services/duffel.js";

/**
 * Fake mínimo que satisface lo que `createToolCallingAgent` consume:
 * - `bindTools(...)` para registrar las tools (retorna `this` para encadenar).
 * - `_generate` y `_llmType` para satisfacer la clase abstracta de LangChain.
 *
 * No invocamos el LLM en el test — solo construimos el executor y
 * verificamos el wiring. Si LangChain renombra `bindTools` o cambia la
 * forma de createToolCallingAgent, este test rompe.
 */
class FakeToolCallingChatModel extends BaseChatModel {
  _llmType(): string {
    return "fake-tool-calling";
  }
  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    return {
      generations: [{ text: "", message: new AIMessage("") }],
    };
  }
  bindTools(_tools: unknown): this {
    return this;
  }
}

function makeDuffel(): DuffelClient {
  return {
    searchAirports: vi.fn(),
    searchOffers: vi.fn(),
  };
}

describe("buildAgentExecutor composition", () => {
  it("registra las 3 tools del MVP en el AgentExecutor", async () => {
    const exec = await buildAgentExecutor({
      duffel: makeDuffel(),
      model: new FakeToolCallingChatModel({}),
    });

    const names = exec.tools.map((t) => t.name).sort();
    expect(names).toEqual(["current_time", "resolve_airport", "search_flights"]);
  });

  it("propaga `verbose` al AgentExecutor", async () => {
    const verboseExec = await buildAgentExecutor({
      duffel: makeDuffel(),
      model: new FakeToolCallingChatModel({}),
      verbose: true,
    });
    const quietExec = await buildAgentExecutor({
      duffel: makeDuffel(),
      model: new FakeToolCallingChatModel({}),
      verbose: false,
    });

    expect(verboseExec.verbose).toBe(true);
    expect(quietExec.verbose).toBe(false);
  });

  it("llama bindTools en el modelo inyectado para el handshake de tool-calling", async () => {
    const model = new FakeToolCallingChatModel({});
    const bindSpy = vi.spyOn(model, "bindTools");

    await buildAgentExecutor({ duffel: makeDuffel(), model });

    expect(bindSpy).toHaveBeenCalled();
    const boundTools = bindSpy.mock.calls[0]?.[0] as Array<{ name: string }>;
    expect(boundTools.map((t) => t.name).sort()).toEqual([
      "current_time",
      "resolve_airport",
      "search_flights",
    ]);
  });

  it("dispara la assertion de drift si el prompt no documenta una tool", async () => {
    // Indirectamente: si en el futuro alguien renombra una tool sin actualizar
    // AGENT_SYSTEM_PROMPT, buildAgentExecutor lanza antes de createToolCallingAgent.
    // Probamos el guard directo con un prompt vacío vía la propia función — ya
    // cubierto en createAgent.test.ts. Aquí confirmamos que en condiciones
    // normales (default de tools + prompt) NO lanza.
    await expect(
      buildAgentExecutor({
        duffel: makeDuffel(),
        model: new FakeToolCallingChatModel({}),
      }),
    ).resolves.toBeDefined();
  });
});
