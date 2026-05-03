import { describe, expect, it } from "vitest";
import { assertToolsCoveredByPrompt } from "../../src/agent/createAgent.js";
import { AGENT_SYSTEM_PROMPT } from "../../src/agent/prompt.js";

describe("assertToolsCoveredByPrompt", () => {
  it("acepta tools cuyos nombres aparecen en el prompt", () => {
    expect(() =>
      assertToolsCoveredByPrompt(
        ["current_time", "resolve_airport", "search_flights"],
        AGENT_SYSTEM_PROMPT,
      ),
    ).not.toThrow();
  });

  it("lanza listando los nombres ausentes del prompt", () => {
    expect(() =>
      assertToolsCoveredByPrompt(
        ["current_time", "tool_olvidada"],
        AGENT_SYSTEM_PROMPT,
      ),
    ).toThrowError(/tool_olvidada/);
  });

  it("lanza si TODAS las tools faltan", () => {
    expect(() =>
      assertToolsCoveredByPrompt(["xx_one", "yy_two"], "Tools: foo, bar."),
    ).toThrowError(/xx_one, yy_two/);
  });

  it("acepta lista vacía sin error", () => {
    expect(() => assertToolsCoveredByPrompt([], "cualquier prompt")).not.toThrow();
  });
});
