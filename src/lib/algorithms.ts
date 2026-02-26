import { Guest, Table, TableType } from "./types";

export type CompanionPlacement = "next-to" | "across" | "none";

export interface AssignmentConfig {
  balanceGuests: boolean;
  randomize: boolean;
  companionPlacement: CompanionPlacement;
}

export interface AssignmentResult {
  guests: Guest[];
  tables: Table[];
  success: boolean;
  message: string;
  unassignedCount: number;
}

export function autoAssignGuests(
  guests: Guest[],
  tables: Table[],
  config: AssignmentConfig = { balanceGuests: true, randomize: false, companionPlacement: "next-to" }
): AssignmentResult {
  if (guests.length === 0) {
    return { guests, tables, success: false, message: "No guests to assign", unassignedCount: 0 };
  }
  if (tables.length === 0) {
    return { guests, tables, success: false, message: "No tables configured", unassignedCount: guests.length };
  }

  const clearedGuests = guests.map((g) => ({ ...g, assignedTableId: null, seatPosition: null }));
  const clearedTables = tables.map((t) => ({
    ...t,
    assignedGuests: [] as string[],
    seats: t.seats.map((s) => ({ ...s, guestId: null })),
  }));

  const guestById = new Map(clearedGuests.map((g) => [g.id, g]));
  const updatedTables = [...clearedTables];

  let assignedCount = 0;

  const assignSeat = (guest: Guest, table: Table, seatPos: number) => {
    const seat = table.seats[seatPos];
    if (!seat || seat.guestId !== null) return false;
    guest.assignedTableId = table.id;
    guest.seatPosition = seatPos;
    seat.guestId = guest.id;
    table.assignedGuests.push(guest.id);
    assignedCount++;
    return true;
  };

  // Build pairs: host + companion
  const paired = new Set<string>();
  const pairs: [Guest, Guest][] = [];
  const singles: Guest[] = [];

  if (config.companionPlacement !== "none") {
    for (const g of clearedGuests) {
      if (paired.has(g.id)) continue;
      if (g.guestOf && guestById.has(g.guestOf)) {
        const host = guestById.get(g.guestOf)!;
        if (!paired.has(host.id)) {
          pairs.push([host, g]);
          paired.add(host.id);
          paired.add(g.id);
        }
      }
    }
    for (const g of clearedGuests) {
      if (!paired.has(g.id)) singles.push(g);
    }
  } else {
    singles.push(...clearedGuests);
  }

  if (config.randomize) {
    shuffleArray(pairs);
    shuffleArray(singles);
  } else {
    pairs.sort((a, b) => a[0].name.localeCompare(b[0].name));
    singles.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Find a companion seat pair on the given table
  const findPairSeats = (
    table: Table,
    placement: "next-to" | "across"
  ): [number, number] | null => {
    const empty = new Set(
      table.seats.filter((s) => s.guestId === null).map((s) => s.position)
    );
    if (empty.size < 2) return null;

    if (table.tableType === TableType.LINE && !table.singleSided) {
      const endCount = (table.endSeatLeft ? 1 : 0) + (table.endSeatRight ? 1 : 0);
      const sideSeats = table.seats.length - endCount;
      const perSide = Math.ceil(sideSeats / 2);

      if (placement === "across") {
        for (let i = 0; i < perSide; i++) {
          const across = perSide + i;
          if (across < sideSeats && empty.has(i) && empty.has(across)) {
            return [i, across];
          }
        }
      }
      // next-to: find two adjacent seats on the same side
      for (let i = 0; i < perSide - 1; i++) {
        if (empty.has(i) && empty.has(i + 1)) return [i, i + 1];
      }
      for (let i = perSide; i < sideSeats - 1; i++) {
        if (empty.has(i) && empty.has(i + 1)) return [i, i + 1];
      }
    } else if (table.tableType === TableType.ROUND) {
      const n = table.seats.length;
      if (placement === "across") {
        const half = Math.floor(n / 2);
        for (let i = 0; i < n; i++) {
          const opp = (i + half) % n;
          if (empty.has(i) && empty.has(opp)) return [i, opp];
        }
      }
      // next-to: find two adjacent seats
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        if (empty.has(i) && empty.has(next)) return [i, next];
      }
    } else {
      // Single-sided LINE, U_SHAPE, or any other: just find adjacent
      const positions = [...empty].sort((a, b) => a - b);
      for (let i = 0; i < positions.length - 1; i++) {
        if (positions[i + 1] - positions[i] === 1) {
          return [positions[i], positions[i + 1]];
        }
      }
    }

    // Fallback: any two empty seats
    const arr = [...empty];
    if (arr.length >= 2) return [arr[0], arr[1]];
    return null;
  };

  // Assign pairs first
  if (config.balanceGuests) {
    let tableIdx = 0;
    for (const [host, companion] of pairs) {
      let assigned = false;
      for (let attempts = 0; attempts < updatedTables.length; attempts++) {
        const table = updatedTables[tableIdx];
        const pairSeats = findPairSeats(table, config.companionPlacement as "next-to" | "across");
        if (pairSeats) {
          assignSeat(host, table, pairSeats[0]);
          assignSeat(companion, table, pairSeats[1]);
          assigned = true;
          tableIdx = (tableIdx + 1) % updatedTables.length;
          break;
        }
        tableIdx = (tableIdx + 1) % updatedTables.length;
      }
      if (!assigned) {
        // Couldn't place as pair, fall back to singles
        singles.push(host, companion);
      }
    }

    // Assign singles
    for (const guest of singles) {
      if (guest.assignedTableId !== null) continue;
      let placed = false;
      for (let attempts = 0; attempts < updatedTables.length; attempts++) {
        const table = updatedTables[tableIdx];
        const seat = table.seats.find((s) => s.guestId === null);
        if (seat) {
          assignSeat(guest, table, seat.position);
          placed = true;
          tableIdx = (tableIdx + 1) % updatedTables.length;
          break;
        }
        tableIdx = (tableIdx + 1) % updatedTables.length;
      }
      if (!placed) break;
    }
  } else {
    let tableIdx = 0;
    for (const [host, companion] of pairs) {
      let assigned = false;
      while (tableIdx < updatedTables.length) {
        const table = updatedTables[tableIdx];
        const pairSeats = findPairSeats(table, config.companionPlacement as "next-to" | "across");
        if (pairSeats) {
          assignSeat(host, table, pairSeats[0]);
          assignSeat(companion, table, pairSeats[1]);
          assigned = true;
          if (table.assignedGuests.length >= table.capacity) tableIdx++;
          break;
        }
        tableIdx++;
      }
      if (!assigned) singles.push(host, companion);
    }

    for (const guest of singles) {
      if (guest.assignedTableId !== null) continue;
      while (tableIdx < updatedTables.length) {
        const table = updatedTables[tableIdx];
        const seat = table.seats.find((s) => s.guestId === null);
        if (seat) {
          assignSeat(guest, table, seat.position);
          if (table.assignedGuests.length >= table.capacity) tableIdx++;
          break;
        }
        tableIdx++;
      }
    }
  }

  const updatedGuests = clearedGuests;
  const unassignedCount = guests.length - assignedCount;
  let message: string;
  let success = true;

  if (unassignedCount === 0) {
    message = `Assigned all ${assignedCount} guests`;
  } else if (assignedCount > 0) {
    message = `Assigned ${assignedCount}. ${unassignedCount} couldn't fit`;
    success = false;
  } else {
    message = "No capacity available";
    success = false;
  }

  if (pairs.length > 0 && config.companionPlacement !== "none") {
    const placedPairs = pairs.filter(
      ([h, c]) => h.assignedTableId !== null && c.assignedTableId !== null
    ).length;
    message += ` (${placedPairs}/${pairs.length} pairs seated ${config.companionPlacement === "across" ? "across" : "together"})`;
  }

  return { guests: updatedGuests, tables: updatedTables, success, message, unassignedCount };
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
