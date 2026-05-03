import { describe, expect, it } from "vitest";
import { currentTimeTool } from "../../../src/agent/tools/currentTime.js";

describe("currentTimeTool", () => {
  it("devuelve fecha+hora ISO con zona", async () => {
    const result = await currentTimeTool.invoke({});
    expect(typeof result).toBe("string");
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});
