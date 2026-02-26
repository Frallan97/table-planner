import { useLocalStorage } from "./useLocalStorage";
import { Guest, DietaryRestriction } from "@/lib/types";

export function useGuests() {
  const [storedGuests, setStoredGuests] = useLocalStorage<Guest[]>("tablePlanner_guests", []);

  // Migration: Ensure all guests have seatPosition
  const guests = storedGuests.map((guest) => {
    if (guest.seatPosition === undefined) {
      return { ...guest, seatPosition: null };
    }
    return guest;
  });

  const setGuests = (value: Guest[] | ((prev: Guest[]) => Guest[])) => {
    setStoredGuests(value);
  };

  const addGuest = (name: string, dietaryRestrictions: DietaryRestriction[] = []) => {
    const newGuest: Guest = {
      id: crypto.randomUUID(),
      name: name.trim(),
      dietaryRestrictions,
      assignedTableId: null,
      seatPosition: null,
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
