// Test script for table planner core functionality
import { Guest, Table, DietaryRestriction, TableShape, TABLE_SHAPE_CAPACITIES } from "./src/lib/types";
import { autoAssignGuests } from "./src/lib/algorithms";

// Test 1: Create mock guests
console.log("\n📋 TEST 1: Creating Guests");
const mockGuests: Guest[] = [
  {
    id: "1",
    name: "John Smith",
    dietaryRestrictions: [DietaryRestriction.VEGETARIAN],
    assignedTableId: null,
    createdAt: new Date(),
  },
  {
    id: "2",
    name: "Jane Doe",
    dietaryRestrictions: [DietaryRestriction.VEGAN],
    assignedTableId: null,
    createdAt: new Date(),
  },
  {
    id: "3",
    name: "Bob Johnson",
    dietaryRestrictions: [DietaryRestriction.PESCATARIAN],
    assignedTableId: null,
    createdAt: new Date(),
  },
  {
    id: "4",
    name: "Alice Williams",
    dietaryRestrictions: [DietaryRestriction.LACTOSE_INTOLERANT],
    assignedTableId: null,
    createdAt: new Date(),
  },
  {
    id: "5",
    name: "Charlie Brown",
    dietaryRestrictions: [DietaryRestriction.NONE],
    assignedTableId: null,
    createdAt: new Date(),
  },
  {
    id: "6",
    name: "Diana Prince",
    dietaryRestrictions: [DietaryRestriction.VEGETARIAN, DietaryRestriction.LACTOSE_INTOLERANT],
    assignedTableId: null,
    createdAt: new Date(),
  },
];

console.log(`✅ Created ${mockGuests.length} guests`);
mockGuests.forEach((g) => {
  console.log(`   - ${g.name}: ${g.dietaryRestrictions.join(", ")}`);
});

// Test 2: Create mock tables
console.log("\n🪑 TEST 2: Creating Tables");
const mockTables: Table[] = [
  {
    id: "t1",
    name: "Table 1",
    shape: TableShape.SQUARE,
    capacity: TABLE_SHAPE_CAPACITIES[TableShape.SQUARE],
    position: { x: 0, y: 0 },
    assignedGuests: [],
  },
  {
    id: "t2",
    name: "Table 2",
    shape: TableShape.RECTANGLE,
    capacity: TABLE_SHAPE_CAPACITIES[TableShape.RECTANGLE],
    position: { x: 1, y: 0 },
    assignedGuests: [],
  },
];

console.log(`✅ Created ${mockTables.length} tables`);
mockTables.forEach((t) => {
  console.log(`   - ${t.name}: ${t.shape} (capacity: ${t.capacity})`);
});

const totalCapacity = mockTables.reduce((sum, t) => sum + t.capacity, 0);
console.log(`   Total capacity: ${totalCapacity} seats`);

// Test 3: Auto-assign with balanced distribution
console.log("\n🎯 TEST 3: Auto-Assign (Balanced Distribution)");
const result1 = autoAssignGuests(mockGuests, mockTables, {
  balanceGuests: true,
  randomize: false,
});

console.log(`✅ ${result1.message}`);
console.log(`   Success: ${result1.success}`);
console.log(`   Unassigned: ${result1.unassignedCount}`);

result1.tables.forEach((table) => {
  const assignedGuestNames = result1.guests
    .filter((g) => g.assignedTableId === table.id)
    .map((g) => g.name);
  console.log(`   ${table.name}: ${assignedGuestNames.length}/${table.capacity} - [${assignedGuestNames.join(", ")}]`);
});

// Test 4: Auto-assign with sequential fill
console.log("\n🎯 TEST 4: Auto-Assign (Sequential Fill)");
const result2 = autoAssignGuests(mockGuests, mockTables, {
  balanceGuests: false,
  randomize: false,
});

console.log(`✅ ${result2.message}`);
result2.tables.forEach((table) => {
  const assignedGuestNames = result2.guests
    .filter((g) => g.assignedTableId === table.id)
    .map((g) => g.name);
  console.log(`   ${table.name}: ${assignedGuestNames.length}/${table.capacity} - [${assignedGuestNames.join(", ")}]`);
});

// Test 5: Insufficient capacity
console.log("\n⚠️  TEST 5: Insufficient Capacity");
const manyGuests: Guest[] = Array.from({ length: 15 }, (_, i) => ({
  id: `g${i}`,
  name: `Guest ${i + 1}`,
  dietaryRestrictions: [DietaryRestriction.NONE],
  assignedTableId: null,
  createdAt: new Date(),
}));

const result3 = autoAssignGuests(manyGuests, mockTables, {
  balanceGuests: true,
  randomize: false,
});

console.log(`✅ ${result3.message}`);
console.log(`   Success: ${result3.success}`);
console.log(`   Total guests: ${manyGuests.length}`);
console.log(`   Assigned: ${manyGuests.length - result3.unassignedCount}`);
console.log(`   Unassigned: ${result3.unassignedCount}`);

// Test 6: Edge cases
console.log("\n🔍 TEST 6: Edge Cases");

// Empty guests
const emptyGuestsResult = autoAssignGuests([], mockTables, {
  balanceGuests: true,
  randomize: false,
});
console.log(`   Empty guests: ${emptyGuestsResult.success ? "❌ Should fail" : "✅ Correctly failed"}`);
console.log(`   Message: ${emptyGuestsResult.message}`);

// Empty tables
const emptyTablesResult = autoAssignGuests(mockGuests, [], {
  balanceGuests: true,
  randomize: false,
});
console.log(`   Empty tables: ${emptyTablesResult.success ? "❌ Should fail" : "✅ Correctly failed"}`);
console.log(`   Message: ${emptyTablesResult.message}`);

// Test 7: Randomization
console.log("\n🎲 TEST 7: Randomization");
const result4 = autoAssignGuests(mockGuests, mockTables, {
  balanceGuests: true,
  randomize: true,
});
console.log(`✅ Randomized assignment completed`);
console.log(`   First guest assigned: ${result4.guests.find((g) => g.assignedTableId)?.name}`);

console.log("\n✨ All tests completed!\n");
