// tests/agent/tools/searchFlights.test.ts
import { describe, expect, it, vi } from "vitest";
import type { DuffelClient, FlightOffer } from "../../../src/services/duffel.js";
import { createSearchFlightsTool } from "../../../src/agent/tools/searchFlights.js";

function makeClient(offers: FlightOffer[]): DuffelClient {
  return {
    searchAirports: vi.fn(),
    searchOffers: vi.fn().mockResolvedValue(offers),
  };
}

const sampleOffer: FlightOffer = {
  id: "off_1",
  totalAmount: "542.30",
  currency: "USD",
  airline: "Duffel Airways",
  segments: [
    { origin: "BOG", destination: "MAD", departureAt: "2026-07-15T10:00:00", arrivalAt: "2026-07-15T22:00:00" },
  ],
  stops: 0,
  durationMinutes: 720,
};

describe("searchFlightsTool", () => {
  it("invoca searchOffers con defaults y devuelve top 3", async () => {
    const client = makeClient([sampleOffer, sampleOffer, sampleOffer, sampleOffer]);
    const tool = createSearchFlightsTool(client);
    const result = await tool.invoke({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
    });
    expect(client.searchOffers).toHaveBeenCalledWith({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
      passengers: 1,
      cabinClass: "economy",
    });
    const parsed = JSON.parse(result) as FlightOffer[];
    expect(parsed).toHaveLength(3);
  });

  it("respeta passengers y cabinClass", async () => {
    const client = makeClient([]);
    const tool = createSearchFlightsTool(client);
    await tool.invoke({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
      passengers: 2,
      cabinClass: "business",
    });
    expect(client.searchOffers).toHaveBeenCalledWith(
      expect.objectContaining({ passengers: 2, cabinClass: "business" }),
    );
  });

  it("rechaza fechas en formato no ISO", async () => {
    const client = makeClient([]);
    const tool = createSearchFlightsTool(client);
    await expect(
      tool.invoke({ origin: "BOG", destination: "MAD", departureDate: "15/07/2026" }),
    ).rejects.toThrow();
  });
});
