import { Guest, Table } from "./types";

export interface AssignmentConfig {
  balanceGuests: boolean;
  randomize: boolean;
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
  config: AssignmentConfig = { balanceGuests: true, randomize: false }
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

  let guestsToAssign = [...clearedGuests];
  if (config.randomize) {
    guestsToAssign = shuffleArray(guestsToAssign);
  } else {
    guestsToAssign.sort((a, b) => a.name.localeCompare(b.name));
  }

  let assignedCount = 0;
  const updatedGuests = [...guestsToAssign];
  const updatedTables = [...clearedTables];

  if (config.balanceGuests) {
    let tableIndex = 0;
    for (let i = 0; i < guestsToAssign.length; i++) {
      const guest = updatedGuests[i];
      let attempts = 0;
      while (attempts < tables.length) {
        const table = updatedTables[tableIndex];
        const seat = table.seats.find((s) => s.guestId === null);
        if (seat) {
          guest.assignedTableId = table.id;
          guest.seatPosition = seat.position;
          seat.guestId = guest.id;
          table.assignedGuests.push(guest.id);
          assignedCount++;
          tableIndex = (tableIndex + 1) % tables.length;
          break;
        }
        tableIndex = (tableIndex + 1) % tables.length;
        attempts++;
      }
      if (attempts >= tables.length) break;
    }
  } else {
    let tableIndex = 0;
    for (let i = 0; i < guestsToAssign.length; i++) {
      if (tableIndex >= tables.length) break;
      const guest = updatedGuests[i];
      const table = updatedTables[tableIndex];
      const seat = table.seats.find((s) => s.guestId === null);
      if (seat) {
        guest.assignedTableId = table.id;
        guest.seatPosition = seat.position;
        seat.guestId = guest.id;
        table.assignedGuests.push(guest.id);
        assignedCount++;
        if (table.assignedGuests.length >= table.capacity) tableIndex++;
      } else {
        tableIndex++;
        i--;
      }
    }
  }

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

  return { guests: updatedGuests, tables: updatedTables, success, message, unassignedCount };
}

function shuffleArray<T>(array: T[]): T[] {
  const s = [...array];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}
