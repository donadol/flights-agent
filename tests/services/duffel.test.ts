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

import { createDuffelClient } from "../../src/services/duffel.js";

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
