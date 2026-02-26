export enum DietaryRestriction {
  VEGETARIAN = "VEGETARIAN",
  VEGAN = "VEGAN",
  PESCATARIAN = "PESCATARIAN",
  LACTOSE_INTOLERANT = "LACTOSE_INTOLERANT",
  NONE = "NONE",
}

export interface Guest {
  id: string;
  name: string;
  dietaryRestrictions: DietaryRestriction[];
  assignedTableId: string | null;
  seatPosition: number | null;
  guestOf: string | null;
  createdAt: Date;
}

export enum TableType {
  LINE = "LINE",
  U_SHAPE = "U_SHAPE",
  ROUND = "ROUND",
}

export interface Seat {
  position: number;
  guestId: string | null;
  label: string;
}

export interface Table {
  id: string;
  name: string;
  tableType: TableType;
  position: { x: number; y: number };
  rotation: number;
  seats: Seat[];
  capacity: number;
  assignedGuests: string[];
  // LINE: seats are only on one side
  singleSided: boolean;
  // LINE: chairs at the short ends
  endSeatLeft: boolean;
  endSeatRight: boolean;
  // U_SHAPE: seats per arm
  topSeats: number;
  leftSeats: number;
  rightSeats: number;
}

export const DIETARY_RESTRICTION_LABELS: Record<DietaryRestriction, string> = {
  [DietaryRestriction.VEGETARIAN]: "Vegetarian",
  [DietaryRestriction.VEGAN]: "Vegan",
  [DietaryRestriction.PESCATARIAN]: "Pescatarian",
  [DietaryRestriction.LACTOSE_INTOLERANT]: "Lactose Intolerant",
  [DietaryRestriction.NONE]: "None",
};

function makeSeatArray(count: number): Seat[] {
  return Array.from({ length: count }, (_, i) => ({
    position: i,
    guestId: null,
    label: `Seat ${i + 1}`,
  }));
}

export function createLineTable(
  name: string,
  seatsPerSide: number,
  singleSided: boolean,
  position: { x: number; y: number },
  endSeatLeft = false,
  endSeatRight = false
): Table {
  const sideTotal = singleSided ? seatsPerSide : seatsPerSide * 2;
  const endTotal = (endSeatLeft ? 1 : 0) + (endSeatRight ? 1 : 0);
  const total = sideTotal + endTotal;
  return {
    id: crypto.randomUUID(),
    name,
    tableType: TableType.LINE,
    position,
    rotation: 0,
    seats: makeSeatArray(total),
    capacity: total,
    assignedGuests: [],
    singleSided,
    endSeatLeft,
    endSeatRight,
    topSeats: 0,
    leftSeats: 0,
    rightSeats: 0,
  };
}

export function createUShapeTable(
  name: string,
  topSeats: number,
  leftSeats: number,
  rightSeats: number,
  position: { x: number; y: number }
): Table {
  const total = topSeats + leftSeats + rightSeats;
  return {
    id: crypto.randomUUID(),
    name,
    tableType: TableType.U_SHAPE,
    position,
    rotation: 0,
    seats: makeSeatArray(total),
    capacity: total,
    assignedGuests: [],
    singleSided: false,
    endSeatLeft: false,
    endSeatRight: false,
    topSeats,
    leftSeats,
    rightSeats,
  };
}

export function createRoundTable(
  name: string,
  seatCount: number,
  position: { x: number; y: number }
): Table {
  return {
    id: crypto.randomUUID(),
    name,
    tableType: TableType.ROUND,
    position,
    rotation: 0,
    seats: makeSeatArray(seatCount),
    capacity: seatCount,
    assignedGuests: [],
    singleSided: false,
    endSeatLeft: false,
    endSeatRight: false,
    topSeats: 0,
    leftSeats: 0,
    rightSeats: 0,
  };
}

export interface FloorLabel {
  id: string;
  text: string;
  position: { x: number; y: number };
  rotation: number;
  width: number;
  height: number;
  fontSize: number;
}

export type SelectedItem =
  | { type: "table"; ids: string[] }
  | { type: "label"; id: string }
  | null;
