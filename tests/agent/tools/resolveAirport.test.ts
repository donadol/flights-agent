import { describe, expect, it, vi } from "vitest";
import type { DuffelClient, AirportMatch } from "../../../src/services/duffel.js";
import { createResolveAirportTool } from "../../../src/agent/tools/resolveAirport.js";

function makeClient(matches: AirportMatch[]): DuffelClient {
  return {
    searchAirports: vi.fn().mockResolvedValue(matches),
    searchOffers: vi.fn(),
  };
}

describe("resolveAirportTool", () => {
  it("retorna JSON con array de matches", async () => {
    const client = makeClient([
      { iataCode: "BOG", name: "El Dorado", cityName: "Bogotá", countryName: "Colombia" },
    ]);
    const tool = createResolveAirportTool(client);
    const result = await tool.invoke({ query: "Bogotá" });
    expect(client.searchAirports).toHaveBeenCalledWith("Bogotá");
    expect(JSON.parse(result)).toEqual([
      { iataCode: "BOG", name: "El Dorado", cityName: "Bogotá", countryName: "Colombia" },
    ]);
  });

  it("devuelve array vacío serializado cuando no hay matches", async () => {
    const client = makeClient([]);
    const tool = createResolveAirportTool(client);
    const result = await tool.invoke({ query: "Atlántida" });
    expect(JSON.parse(result)).toEqual([]);
  });
});
