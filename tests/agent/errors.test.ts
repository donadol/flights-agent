import { describe, expect, it } from "vitest";
import { z } from "zod";
import { translateAgentError } from "../../src/agent/errors.js";

describe("translateAgentError", () => {
  describe("ZodError", () => {
    it("lista campos inválidos con paths", () => {
      const schema = z.object({ a: z.string(), b: z.number() });
      const result = schema.safeParse({ a: 1, b: "x" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = translateAgentError(result.error);
        expect(msg).toMatch(/Configuración inválida/);
        expect(msg).toMatch(/- a:/);
        expect(msg).toMatch(/- b:/);
      }
    });
  });

  describe("Duffel errors", () => {
    function duffelError(status: number, errors: Array<{ title?: string; message?: string }> = []): unknown {
      return { meta: { status, request_id: "req_x" }, errors };
    }

    it("401/403 → token revocado/inválido con guía", () => {
      const m = translateAgentError(duffelError(401));
      expect(m).toMatch(/DUFFEL_API_TOKEN/);
      expect(m).toMatch(/inválido o inactivo/);
      expect(m).toMatch(/duffel_test_/);
    });

    it("403 también es token", () => {
      expect(translateAgentError(duffelError(403))).toMatch(/DUFFEL_API_TOKEN/);
    });

    it("5xx → reintenta", () => {
      const m = translateAgentError(duffelError(503));
      expect(m).toMatch(/Duffel respondió con un error de servidor \(503\)/);
      expect(m).toMatch(/Reintenta/);
    });

    it("422 con detalle → surface el message", () => {
      const m = translateAgentError(
        duffelError(422, [{ title: "Invalid fields sets", message: "A combination of these fields are not valid." }]),
      );
      expect(m).toMatch(/Duffel rechazó la petición \(422\)/);
      expect(m).toMatch(/A combination of these fields/);
    });

    it("422 sin detalle → fallback 'sin detalle'", () => {
      const m = translateAgentError(duffelError(422, []));
      expect(m).toMatch(/sin detalle/);
    });
  });

  describe("OpenRouter / OpenAI errors", () => {
    function openAiError(status: number, message = "boom"): unknown {
      return Object.assign(new Error(message), { status });
    }

    it("401/403 → API key inválida", () => {
      const m = translateAgentError(openAiError(401));
      expect(m).toMatch(/OPENROUTER_API_KEY/);
      expect(m).toMatch(/inválida/);
    });

    it("429 → rate limit con espera", () => {
      const m = translateAgentError(openAiError(429));
      expect(m).toMatch(/rate-limiteó/);
      expect(m).toMatch(/Espera/);
    });

    it("5xx → reintenta", () => {
      const m = translateAgentError(openAiError(502));
      expect(m).toMatch(/OpenRouter respondió con un error de servidor \(502\)/);
      expect(m).toMatch(/Reintenta/);
    });
  });

  describe("Errores genéricos", () => {
    it("timeout/red → mensaje de reintento", () => {
      expect(translateAgentError(new Error("connect ETIMEDOUT 1.2.3.4:443"))).toMatch(
        /No hubo respuesta a tiempo/,
      );
      expect(translateAgentError(new Error("ECONNRESET"))).toMatch(/No hubo respuesta a tiempo/);
      expect(translateAgentError(new Error("getaddrinfo ENOTFOUND api.duffel.com"))).toMatch(
        /No hubo respuesta a tiempo/,
      );
      expect(translateAgentError(new Error("request timeout"))).toMatch(/No hubo respuesta a tiempo/);
    });

    it("Error genérico → devuelve message", () => {
      expect(translateAgentError(new Error("algo se rompió"))).toBe("algo se rompió");
    });

    it("string → String() del valor", () => {
      expect(translateAgentError("texto crudo")).toBe("texto crudo");
    });

    it("null/undefined → String() del valor", () => {
      expect(translateAgentError(undefined)).toBe("undefined");
      expect(translateAgentError(null)).toBe("null");
    });
  });

  describe("Discriminación entre Duffel y OpenAI", () => {
    it("error con meta.status pero sin errors[] no es Duffel → cae a Error.message", () => {
      const looksDuffelButIsnt = Object.assign(new Error("custom"), {
        meta: { status: 401 },
      });
      // Sin `errors[]` el guard de Duffel falla; cae al branch OpenAI-like (status existe).
      // En este caso status=401 pero no hay `meta.status` exclusivo de Duffel, confirma que
      // el discriminador se basa en `errors[]`.
      const m = translateAgentError(looksDuffelButIsnt);
      // Debería ser tratado como OpenAI (status: 401 + message: string)... pero no, status
      // está en el objeto, no en raíz. Verificar que cae a Error.message.
      expect(m).toBe("custom");
    });

    it("Duffel real (con errors[] array) toma precedencia sobre OpenAI-like", () => {
      const both = Object.assign(new Error("ignored"), {
        status: 999,
        meta: { status: 403 },
        errors: [],
      });
      const m = translateAgentError(both);
      expect(m).toMatch(/DUFFEL_API_TOKEN/);
      expect(m).not.toMatch(/OPENROUTER/);
    });
  });
});
