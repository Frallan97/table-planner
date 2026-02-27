import { z } from "zod";

export const floorPlanSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const seatSchema = z.object({
  position: z.number(),
  guestId: z.string().nullable(),
  label: z.string(),
});

export const tableSchema = z.object({
  id: z.string(),
  name: z.string(),
  tableType: z.enum(["LINE", "U_SHAPE", "ROUND"]),
  position: z.object({ x: z.number(), y: z.number() }),
  rotation: z.number(),
  seats: z.array(seatSchema),
  capacity: z.number(),
  assignedGuests: z.array(z.string()),
  singleSided: z.boolean(),
  endSeatLeft: z.boolean(),
  endSeatRight: z.boolean(),
  topSeats: z.number(),
  leftSeats: z.number(),
  rightSeats: z.number(),
});

export const guestSchema = z.object({
  id: z.string(),
  name: z.string(),
  dietaryRestrictions: z.array(z.string()),
  assignedTableId: z.string().nullable(),
  seatPosition: z.number().nullable(),
  guestOf: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});

export const floorLabelSchema = z.object({
  id: z.string(),
  text: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  rotation: z.number(),
  width: z.number(),
  height: z.number(),
  fontSize: z.number(),
});

export const floorPlanFullSchema = floorPlanSummarySchema.extend({
  tables: z.array(tableSchema),
  guests: z.array(guestSchema),
  labels: z.array(floorLabelSchema),
});

export type FloorPlanSummaryParsed = z.infer<typeof floorPlanSummarySchema>;
export type FloorPlanFullParsed = z.infer<typeof floorPlanFullSchema>;
