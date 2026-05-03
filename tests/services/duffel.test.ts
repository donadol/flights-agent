// tests/services/duffel.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock del SDK ANTES de importar el módulo bajo test.
const listMock = vi.fn();
const createMock = vi.fn();

vi.mock("@duffel/api", () => ({
  Duffel: vi.fn().mockImplementation(() => ({
    suggestions: { list: listMock },
    offerRequests: { create: createMock },
  })),
}));

import { createDuffelClient, parseIso8601DurationToMinutes } from "../../src/services/duffel.js";

beforeEach(() => {
  listMock.mockReset();
  createMock.mockReset();
});

describe("createDuffelClient.searchAirports", () => {
  it("normaliza la respuesta del SDK a AirportMatch[]", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          iata_code: "BOG",
          name: "El Dorado International Airport",
          city_name: "Bogotá",
          country_name: "Colombia",
          type: "airport",
        },
      ],
    });

    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchAirports("Bogotá");

    expect(listMock).toHaveBeenCalledWith({ name: "Bogotá" });
    expect(result).toEqual([
      {
        iataCode: "BOG",
        name: "El Dorado International Airport",
        cityName: "Bogotá",
        countryName: "Colombia",
      },
    ]);
  });

  it("descarta entradas sin IATA code (ciudades, regiones)", async () => {
    listMock.mockResolvedValue({
      data: [
        { iata_code: null, name: "Bogotá Region", city_name: "Bogotá", country_name: "Colombia" },
        { iata_code: "BOG", name: "El Dorado", city_name: "Bogotá", country_name: "Colombia" },
      ],
    });

    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchAirports("Bogotá");
    expect(result).toHaveLength(1);
    expect(result[0]?.iataCode).toBe("BOG");
  });

  it("lanza error legible si la respuesta no cumple el schema", async () => {
    listMock.mockResolvedValue({ data: [{ name: 123 }] });
    const client = createDuffelClient("duffel_test_xyz");
    await expect(client.searchAirports("X")).rejects.toThrow(/Duffel response/);
  });

  it("usa string vacío cuando city_name o country_name vienen ausentes", async () => {
    listMock.mockResolvedValue({
      data: [{ iata_code: "JFK", name: "JFK Intl" }],
    });
    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchAirports("New York");
    expect(result).toEqual([
      { iataCode: "JFK", name: "JFK Intl", cityName: "", countryName: "" },
    ]);
  });

  it("descarta entradas con iata_code vacío o de longitud distinta de 3", async () => {
    listMock.mockResolvedValue({
      data: [
        { iata_code: "", name: "Empty", city_name: "X", country_name: "Y" },
        { iata_code: "AB", name: "TooShort", city_name: "X", country_name: "Y" },
        { iata_code: "ABCD", name: "TooLong", city_name: "X", country_name: "Y" },
        { iata_code: "MAD", name: "Madrid Barajas", city_name: "Madrid", country_name: "España" },
      ],
    });
    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchAirports("Madrid");
    expect(result).toHaveLength(1);
    expect(result[0]?.iataCode).toBe("MAD");
  });
});

describe("createDuffelClient.searchOffers", () => {
  it("normaliza la respuesta del SDK a FlightOffer[]", async () => {
    createMock.mockResolvedValue({
      data: {
        offers: [
          {
            id: "off_123",
            total_amount: "542.30",
            total_currency: "USD",
            owner: { name: "Duffel Airways" },
            slices: [
              {
                segments: [
                  {
                    origin: { iata_code: "BOG" },
                    destination: { iata_code: "MIA" },
                    departing_at: "2026-07-15T10:00:00",
                    arriving_at: "2026-07-15T14:30:00",
                    duration: "PT4H30M",
                  },
                  {
                    origin: { iata_code: "MIA" },
                    destination: { iata_code: "MAD" },
                    departing_at: "2026-07-15T18:00:00",
                    arriving_at: "2026-07-16T08:00:00",
                    duration: "PT8H",
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const client = createDuffelClient("duffel_test_xyz");
    const result = await client.searchOffers({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
    });

    expect(createMock).toHaveBeenCalledWith({
      slices: [
        {
          origin: "BOG",
          destination: "MAD",
          departure_date: "2026-07-15",
          arrival_time: null,
          departure_time: null,
        },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
      return_offers: true,
    });
    expect(result).toEqual([
      {
        id: "off_123",
        totalAmount: "542.30",
        currency: "USD",
        airline: "Duffel Airways",
        segments: [
          { origin: "BOG", destination: "MIA", departureAt: "2026-07-15T10:00:00", arrivalAt: "2026-07-15T14:30:00" },
          { origin: "MIA", destination: "MAD", departureAt: "2026-07-15T18:00:00", arrivalAt: "2026-07-16T08:00:00" },
        ],
        stops: 1,
        durationMinutes: 750, // 4h30 + 8h
      },
    ]);
  });

  it("respeta passengers y cabinClass", async () => {
    createMock.mockResolvedValue({ data: { offers: [] } });
    const client = createDuffelClient("duffel_test_xyz");
    await client.searchOffers({
      origin: "BOG",
      destination: "MAD",
      departureDate: "2026-07-15",
      passengers: 2,
      cabinClass: "business",
    });
    expect(createMock).toHaveBeenCalledWith({
      slices: [
        {
          origin: "BOG",
          destination: "MAD",
          departure_date: "2026-07-15",
          arrival_time: null,
          departure_time: null,
        },
      ],
      passengers: [{ type: "adult" }, { type: "adult" }],
      cabin_class: "business",
      return_offers: true,
    });
  });

  it("lanza error legible si la respuesta no cumple el schema", async () => {
    createMock.mockResolvedValue({ data: { offers: [{ id: 1 }] } });
    const client = createDuffelClient("duffel_test_xyz");
    await expect(
      client.searchOffers({ origin: "BOG", destination: "MAD", departureDate: "2026-07-15" }),
    ).rejects.toThrow(/Duffel response/);
  });
});

describe("parseIso8601DurationToMinutes", () => {
  it.each([
    ["PT4H30M", 270],
    ["PT8H", 480],
    ["PT45M", 45],
    ["P1DT2H", 26 * 60],
    ["", 0],
    [undefined, 0],
    ["invalid", 0],
    ["PT1H2M30S", 62],          // seconds rounded down (30s → 0 min)
    ["PT2H0M120S", 122],        // 120s = 2 min
    ["PT1H30M5S", 90],          // 5s rounds to 0 min
    ["PT1H2M3S4Z", 0],          // unknown trailing component → reject
    ["1H30M", 0],               // missing leading P → reject
  ])("parsea %s → %i", (input, expected) => {
    expect(parseIso8601DurationToMinutes(input)).toBe(expected);
  });
});
