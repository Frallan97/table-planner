import { useMemo, useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import {
  Table,
  TableType,
  createLineTable,
  createUShapeTable,
  createRoundTable,
} from "@/lib/types";

function makeSeatArray(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    position: i,
    guestId: null,
    label: `Seat ${i + 1}`,
  }));
}

export function useTables() {
  const [storedTables, setStoredTables] = useLocalStorage<Table[]>(
    "tablePlanner_tables_v2",
    []
  );

  const tables = useMemo(
    () => storedTables.filter((t) => t.tableType !== undefined),
    [storedTables]
  );

  const setTables = useCallback(
    (value: Table[] | ((prev: Table[]) => Table[])) => {
      setStoredTables(value);
    },
    [setStoredTables]
  );

  const nextName = (_type: TableType) => {
    const existing = tables.length;
    return `Table ${existing + 1}`;
  };

  const nextPosition = () => {
    const positions = [
      { x: 300, y: 200 },
      { x: 750, y: 200 },
      { x: 300, y: 550 },
      { x: 750, y: 550 },
      { x: 1100, y: 200 },
      { x: 1100, y: 550 },
    ];
    const idx = tables.length % positions.length;
    return { ...positions[idx] };
  };

  const addLineTable = (seatsPerSide = 6, singleSided = false) => {
    const t = createLineTable(
      nextName(TableType.LINE),
      seatsPerSide,
      singleSided,
      nextPosition()
    );
    setTables((prev) => [...prev, t]);
    return t.id;
  };

  const addUShapeTable = (top = 10, left = 8, right = 8) => {
    const t = createUShapeTable(
      nextName(TableType.U_SHAPE),
      top,
      left,
      right,
      nextPosition()
    );
    setTables((prev) => [...prev, t]);
    return t.id;
  };

  const addRoundTable = (seatCount = 8) => {
    const t = createRoundTable(
      nextName(TableType.ROUND),
      seatCount,
      nextPosition()
    );
    setTables((prev) => [...prev, t]);
    return t.id;
  };

  const updateTable = (id: string, updates: Partial<Table>) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const reconfigureSeats = (
    id: string,
    config: {
      seatsPerSide?: number;
      singleSided?: boolean;
      endSeatLeft?: boolean;
      endSeatRight?: boolean;
      topSeats?: number;
      leftSeats?: number;
      rightSeats?: number;
      seatCount?: number;
    }
  ) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        let newSeats = t.seats;
        let capacity = t.capacity;
        let singleSided = t.singleSided;
        let endSeatLeft = t.endSeatLeft ?? false;
        let endSeatRight = t.endSeatRight ?? false;
        let topSeats = t.topSeats;
        let leftSeats = t.leftSeats;
        let rightSeats = t.rightSeats;

        if (t.tableType === TableType.LINE) {
          const endCount = (t.endSeatLeft ? 1 : 0) + (t.endSeatRight ? 1 : 0);
          const currentSideSeats = t.seats.length - endCount;
          const ps = config.seatsPerSide ?? (t.singleSided ? currentSideSeats : currentSideSeats / 2);
          singleSided = config.singleSided ?? t.singleSided;
          endSeatLeft = config.endSeatLeft ?? endSeatLeft;
          endSeatRight = config.endSeatRight ?? endSeatRight;
          const sideTotal = singleSided ? ps : ps * 2;
          const endTotal = (endSeatLeft ? 1 : 0) + (endSeatRight ? 1 : 0);
          capacity = sideTotal + endTotal;
          newSeats = makeSeatArray(capacity);
        } else if (t.tableType === TableType.U_SHAPE) {
          topSeats = config.topSeats ?? t.topSeats;
          leftSeats = config.leftSeats ?? t.leftSeats;
          rightSeats = config.rightSeats ?? t.rightSeats;
          capacity = topSeats + leftSeats + rightSeats;
          newSeats = makeSeatArray(capacity);
        } else if (t.tableType === TableType.ROUND) {
          capacity = config.seatCount ?? t.seats.length;
          newSeats = makeSeatArray(capacity);
        }

        return {
          ...t,
          seats: newSeats,
          capacity,
          assignedGuests: [],
          singleSided,
          endSeatLeft,
          endSeatRight,
          topSeats,
          leftSeats,
          rightSeats,
        };
      })
    );
  };

  const duplicateTables = (ids: string[]): string[] => {
    const newIds: string[] = [];
    setTables((prev) => {
      const sources = ids
        .map((id) => prev.find((t) => t.id === id))
        .filter(Boolean) as Table[];
      if (sources.length === 0) return prev;

      const tableNumberRe = /^Table\s+(\d+)/i;
      let maxNum = 0;
      for (const t of prev) {
        const m = t.name.match(tableNumberRe);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      }

      const copies = sources.map((src, i) => {
        const newId = crypto.randomUUID();
        newIds.push(newId);
        const offset = 60 + i * 20;
        maxNum++;
        return {
          ...src,
          id: newId,
          name: `Table ${maxNum}`,
          position: {
            x: src.position.x + offset,
            y: src.position.y + offset,
          },
          assignedGuests: [],
          seats: src.seats.map((s) => ({ ...s, guestId: null })),
        };
      });

      return [...prev, ...copies];
    });
    return newIds;
  };

  const deleteTable = (id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAllTables = () => {
    setTables([]);
  };

  const clearTableAssignments = () => {
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        assignedGuests: [],
        seats: t.seats.map((s) => ({ ...s, guestId: null })),
      }))
    );
  };

  const assignGuestToSeat = (
    tableId: string,
    seatPosition: number,
    guestId: string
  ) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          assignedGuests: t.assignedGuests.includes(guestId)
            ? t.assignedGuests
            : [...t.assignedGuests, guestId],
          seats: t.seats.map((s) =>
            s.position === seatPosition ? { ...s, guestId } : s
          ),
        };
      })
    );
  };

  const removeGuestFromSeat = (tableId: string, seatPosition: number) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const seat = t.seats.find((s) => s.position === seatPosition);
        if (!seat?.guestId) return t;
        return {
          ...t,
          assignedGuests: t.assignedGuests.filter(
            (gid) => gid !== seat.guestId
          ),
          seats: t.seats.map((s) =>
            s.position === seatPosition ? { ...s, guestId: null } : s
          ),
        };
      })
    );
  };

  return {
    tables,
    setTables,
    addLineTable,
    addUShapeTable,
    addRoundTable,
    updateTable,
    reconfigureSeats,
    duplicateTables,
    deleteTable,
    clearAllTables,
    clearTableAssignments,
    assignGuestToSeat,
    removeGuestFromSeat,
  };
}
