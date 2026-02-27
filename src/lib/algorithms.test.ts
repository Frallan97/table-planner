import { describe, test, expect } from "bun:test";
import { autoAssignGuests, type AssignmentConfig } from "./algorithms";
import { createLineTable, createRoundTable, type Guest, DietaryRestriction } from "./types";

const defaultConfig: AssignmentConfig = {
  balanceGuests: true,
  randomize: false,
  companionPlacement: "next-to",
};

function makeGuest(name: string, overrides: Partial<Guest> = {}): Guest {
  return {
    id: crypto.randomUUID(),
    name,
    dietaryRestrictions: [DietaryRestriction.NONE],
    assignedTableId: null,
    seatPosition: null,
    guestOf: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("autoAssignGuests", () => {
  test("no guests returns early", () => {
    const result = autoAssignGuests([], [], defaultConfig);
    expect(result.success).toBe(false);
    expect(result.message).toContain("No guests");
    expect(result.unassignedCount).toBe(0);
  });

  test("no tables returns all unassigned", () => {
    const guests = [makeGuest("Alice"), makeGuest("Bob")];
    const result = autoAssignGuests(guests, [], defaultConfig);
    expect(result.success).toBe(false);
    expect(result.message).toContain("No tables");
    expect(result.unassignedCount).toBe(2);
  });

  test("single table assignment", () => {
    const guests = [makeGuest("Alice"), makeGuest("Bob")];
    const table = createRoundTable("T1", 4, { x: 0, y: 0 });
    const result = autoAssignGuests(guests, [table], defaultConfig);
    expect(result.success).toBe(true);
    expect(result.unassignedCount).toBe(0);
    const assigned = result.guests.filter((g) => g.assignedTableId !== null);
    expect(assigned.length).toBe(2);
  });

  test("insufficient capacity", () => {
    const guests = [makeGuest("Alice"), makeGuest("Bob"), makeGuest("Charlie")];
    const table = createRoundTable("T1", 2, { x: 0, y: 0 });
    const result = autoAssignGuests(guests, [table], defaultConfig);
    expect(result.success).toBe(false);
    expect(result.unassignedCount).toBe(1);
  });

  test("companion pairing", () => {
    const host = makeGuest("Alice");
    const companion = makeGuest("Bob", { guestOf: host.id });
    const table = createRoundTable("T1", 6, { x: 0, y: 0 });
    const result = autoAssignGuests([host, companion], [table], defaultConfig);
    expect(result.success).toBe(true);
    // Both should be at the same table
    const assignedHost = result.guests.find((g) => g.name === "Alice");
    const assignedCompanion = result.guests.find((g) => g.name === "Bob");
    expect(assignedHost?.assignedTableId).toBe(assignedCompanion?.assignedTableId);
  });

  test("balanced distribution across tables", () => {
    const guests = Array.from({ length: 8 }, (_, i) => makeGuest(`Guest ${i + 1}`));
    const tables = [
      createRoundTable("T1", 6, { x: 0, y: 0 }),
      createRoundTable("T2", 6, { x: 200, y: 0 }),
    ];
    const result = autoAssignGuests(guests, tables, defaultConfig);
    expect(result.success).toBe(true);
    // With balancing on, distribution should be even (4-4)
    const t1Count = result.guests.filter((g) => g.assignedTableId === result.tables[0].id).length;
    const t2Count = result.guests.filter((g) => g.assignedTableId === result.tables[1].id).length;
    expect(t1Count).toBe(4);
    expect(t2Count).toBe(4);
  });

  test("line table assignment works", () => {
    const guests = [makeGuest("Alice")];
    const table = createLineTable("L1", 3, false, { x: 0, y: 0 });
    const result = autoAssignGuests(guests, [table], defaultConfig);
    expect(result.success).toBe(true);
    expect(result.unassignedCount).toBe(0);
  });
});
