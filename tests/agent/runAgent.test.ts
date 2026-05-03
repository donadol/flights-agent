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
