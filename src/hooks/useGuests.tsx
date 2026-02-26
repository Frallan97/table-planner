import { useMemo, useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { Guest, DietaryRestriction } from "@/lib/types";

export function useGuests() {
  const [storedGuests, setStoredGuests] = useLocalStorage<Guest[]>("tablePlanner_guests", []);

  const guests = useMemo(
    () =>
      storedGuests.map((guest) => {
        const patched = { ...guest };
        if (patched.seatPosition === undefined) patched.seatPosition = null;
        if (patched.guestOf === undefined) patched.guestOf = null;
        return patched;
      }),
    [storedGuests]
  );

  const setGuests = useCallback(
    (value: Guest[] | ((prev: Guest[]) => Guest[])) => {
      setStoredGuests(value);
    },
    [setStoredGuests]
  );

  const addGuest = (name: string, dietaryRestrictions: DietaryRestriction[] = [], guestOf: string | null = null) => {
    const newGuest: Guest = {
      id: crypto.randomUUID(),
      name: name.trim(),
      dietaryRestrictions,
      assignedTableId: null,
      seatPosition: null,
      guestOf,
      createdAt: new Date(),
    };
    setGuests((prev) => [...prev, newGuest]);
    return newGuest;
  };

  const addGuestsBulk = (names: string[]) => {
    const newGuests: Guest[] = names
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name) => ({
        id: crypto.randomUUID(),
        name,
        dietaryRestrictions: [DietaryRestriction.NONE],
        assignedTableId: null,
        seatPosition: null,
        guestOf: null,
        createdAt: new Date(),
      }));
    setGuests((prev) => [...prev, ...newGuests]);
    return newGuests;
  };

  const updateGuest = (id: string, updates: Partial<Guest>) => {
    setGuests((prev) =>
      prev.map((guest) =>
        guest.id === id ? { ...guest, ...updates } : guest
      )
    );
  };

  const deleteGuest = (id: string) => {
    setGuests((prev) => prev.filter((guest) => guest.id !== id));
  };

  const clearAssignments = () => {
    setGuests((prev) =>
      prev.map((guest) => ({ ...guest, assignedTableId: null, seatPosition: null }))
    );
  };

  const clearAllGuests = () => {
    setGuests([]);
  };

  const assignGuestToTable = (guestId: string, tableId: string | null) => {
    setGuests((prev) =>
      prev.map((guest) =>
        guest.id === guestId ? { ...guest, assignedTableId: tableId } : guest
      )
    );
  };

  return {
    guests,
    setGuests,
    addGuest,
    addGuestsBulk,
    updateGuest,
    deleteGuest,
    clearAssignments,
    clearAllGuests,
    assignGuestToTable,
  };
}
