// tests/agent/integration.test.ts
import { describe, expect, it, vi } from "vitest";
import { runAgent } from "../../src/agent/runAgent.js";

describe("integration: búsqueda completa exitosa", () => {
  it("emite el resumen del top 3 cuando el agente recibe un input completo", async () => {
    const executor = {
      invoke: vi.fn().mockResolvedValue({
        output:
          "Aviso: precios del sandbox de Duffel.\n\n" +
          "Top 3 ofertas BOG → MAD el 2026-07-15:\n" +
          "1. Duffel Airways — 542.30 USD — 12h — 0 escalas — 10:00 → 22:00\n" +
          "2. Duffel Airways — 612.00 USD — 13h — 1 escala — 09:00 → 22:00\n" +
          "3. Duffel Airways — 700.50 USD — 14h — 1 escala — 11:00 → 01:00",
      }),
    };

    const result = await runAgent(
      "vuelos de Bogotá a Madrid el 15 de julio",
      [],
      { executor },
    );

    expect(executor.invoke).toHaveBeenCalledWith({
      input: "vuelos de Bogotá a Madrid el 15 de julio",
      history: [],
    });
    expect(result.output).toMatch(/sandbox de Duffel/);
    expect(result.output).toMatch(/Top 3/);
    expect(result.history).toHaveLength(2);
  });
});

describe("integration: ciudad no resuelta", () => {
  it("pide aclaración cuando el agente no encuentra IATA para una ciudad", async () => {
    const executor = {
      invoke: vi.fn().mockResolvedValue({
        output: "No encontré un aeropuerto que coincida con \"Atlántida\". ¿Puedes darme otra ciudad cercana o un código IATA?",
      }),
    };

    const result = await runAgent("vuelos de Atlántida a Madrid el 15 de julio", [], { executor });

    expect(result.output).toMatch(/no encontré|otra ciudad|IATA/i);
    expect(result.history).toHaveLength(2);
  });
});

describe("integration: info faltante con multi-turno", () => {
  it("pregunta por origen y completa la búsqueda en el segundo turno", async () => {
    const executor = {
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          output: "¿Desde qué ciudad sales? También necesito una fecha exacta.",
        })
        .mockResolvedValueOnce({
          output:
            "Aviso: precios del sandbox de Duffel.\n\n" +
            "Top 3 BOG → MAD el 2026-07-15: 1. ... 2. ... 3. ...",
        }),
    };

    const turn1 = await runAgent("quiero ir a Madrid", [], { executor });
    expect(turn1.output).toMatch(/desde qué ciudad/i);
    expect(turn1.history).toHaveLength(2);

    const turn2 = await runAgent("Bogotá, el 15 de julio", turn1.history, { executor });
    expect(executor.invoke).toHaveBeenLastCalledWith({
      input: "Bogotá, el 15 de julio",
      history: turn1.history,
    });
    expect(turn2.output).toMatch(/Top 3/);
    expect(turn2.history).toHaveLength(4);
  });
});
