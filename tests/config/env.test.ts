import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getEnv } from "../../src/config/env.js";

const ORIGINAL_ENV = { ...process.env };

describe("getEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("parsea env válido con DUFFEL_API_TOKEN test", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-xxx";
    process.env.DUFFEL_API_TOKEN = "duffel_test_abc123";
    const env = getEnv();
    expect(env.OPENROUTER_MODEL).toBe("openai/gpt-4o-mini");
    expect(env.DUFFEL_API_TOKEN).toBe("duffel_test_abc123");
  });

  it("rechaza tokens de Duffel que no empiezan con duffel_test_", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-xxx";
    process.env.DUFFEL_API_TOKEN = "duffel_live_abc123";
    expect(() => getEnv()).toThrowError(/duffel_test_/);
  });

  it("rechaza falta de OPENROUTER_API_KEY", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.DUFFEL_API_TOKEN = "duffel_test_abc123";
    expect(() => getEnv()).toThrowError(/OPENROUTER_API_KEY/);
  });

  it("rechaza falta de DUFFEL_API_TOKEN", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-xxx";
    delete process.env.DUFFEL_API_TOKEN;
    expect(() => getEnv()).toThrowError(/DUFFEL_API_TOKEN/);
  });
});
