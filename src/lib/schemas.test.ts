import { describe, test, expect } from "bun:test";
import { floorPlanSummarySchema, floorPlanFullSchema, tableSchema, guestSchema, floorLabelSchema } from "./schemas";

describe("floorPlanSummarySchema", () => {
  test("valid data passes", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      name: "My Plan",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };
    const result = floorPlanSummarySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test("missing fields rejected", () => {
    const result = floorPlanSummarySchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  test("invalid uuid rejected", () => {
    const data = {
      id: "not-a-uuid",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      name: "My Plan",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };
    const result = floorPlanSummarySchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("tableSchema", () => {
  test("valid table passes", () => {
    const data = {
      id: "abc",
      name: "Table 1",
      tableType: "ROUND",
      position: { x: 100, y: 200 },
      rotation: 0,
      seats: [{ position: 0, guestId: null, label: "Seat 1" }],
      capacity: 1,
      assignedGuests: [],
      singleSided: false,
      endSeatLeft: false,
      endSeatRight: false,
      topSeats: 0,
      leftSeats: 0,
      rightSeats: 0,
    };
    const result = tableSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test("invalid table type rejected", () => {
    const data = {
      id: "abc",
      name: "Table 1",
      tableType: "TRIANGLE",
      position: { x: 0, y: 0 },
      rotation: 0,
      seats: [],
      capacity: 0,
      assignedGuests: [],
      singleSided: false,
      endSeatLeft: false,
      endSeatRight: false,
      topSeats: 0,
      leftSeats: 0,
      rightSeats: 0,
    };
    const result = tableSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("guestSchema", () => {
  test("valid guest passes", () => {
    const data = {
      id: "g1",
      name: "Alice",
      dietaryRestrictions: ["NONE"],
      assignedTableId: null,
      seatPosition: null,
      guestOf: null,
      createdAt: "2024-01-01T00:00:00Z",
    };
    const result = guestSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("floorLabelSchema", () => {
  test("valid label passes", () => {
    const data = {
      id: "l1",
      text: "Stage",
      position: { x: 0, y: 0 },
      rotation: 0,
      width: 100,
      height: 40,
      fontSize: 14,
    };
    const result = floorLabelSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("floorPlanFullSchema", () => {
  test("valid full floor plan passes", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      name: "Reception",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
      tables: [],
      guests: [],
      labels: [],
    };
    const result = floorPlanFullSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
