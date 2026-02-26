# Multiple Tables in Row/Column Feature

## Overview

Tables can now consist of **multiple physical tables** arranged in rows or columns. This is perfect for:
- **Banquet seating** - Long rows of rectangle tables
- **Classroom style** - Rows of tables
- **Conference setups** - Multiple tables pushed together
- **Large party tables** - Combined squares/rectangles

---

## How It Works

### Configuration

Each table can now have:
1. **Table Count** (1-10): Number of physical tables
2. **Arrangement**: How they're organized
   - **Single**: Just one table (default)
   - **Row**: Tables side-by-side horizontally (—)
   - **Column**: Tables stacked vertically (|)

### Capacity Calculation

**Formula:** `Base Capacity × Table Count`

**Examples:**
- 1 rectangle = 6 seats
- 3 rectangles in a row = 18 seats
- 2 squares in a column = 8 seats

### Seat Distribution

**Row Arrangement:**
- Seats alternate along North and South sides
- Evenly spaced along the length
- Example: 3 tables → 9 seats on north, 9 on south

**Column Arrangement:**
- Seats alternate along West and East sides
- Evenly spaced along the height
- Example: 2 tables → 4 seats on west, 4 on east

---

## User Interface

### Table Configuration Panel

**For each table, you now see:**

```
┌─────────────────────────────────┐
│ Table 1              5/18 seats │
├─────────────────────────────────┤
│ Shape:    [Rectangle ▼]         │
│ Count:    [3      ]             │
│ Arrangement: [Row (—) ▼]        │
├─────────────────────────────────┤
│ 3 rectangle tables in row       │
└─────────────────────────────────┘
```

**Fields:**
- **Shape**: Square or Rectangle
- **Count**: Number of tables (1-10)
- **Arrangement**: Only visible when count > 1
  - Row (—): Side-by-side
  - Column (|): Stacked

---

## Visual Representation

### Single Table (Count = 1)
```
      [Guest]
         |
[G] -- TABLE 1 -- [G]
         |
      [Guest]
```

### Row Arrangement (Count = 3)
```
    [G]    [G]    [G]    [G]    [G]    [G]
     |      |      |      |      |      |
   ┌────┬────┬────┬────┬────┬────┐
   │    │    TABLE 1          │    │
   │    │  (3× rectangle)     │    │
   └────┴────┴────┴────┴────┴────┘
     |      |      |      |      |      |
    [G]    [G]    [G]    [G]    [G]    [G]
```

- **Visual**: 3 connected rectangles with dashed lines between
- **Seats**: Distributed evenly along top and bottom
- **Width**: 3× single table width

### Column Arrangement (Count = 2)
```
[G] [G]
 |   |
┌─────┐
│     │
│TABLE│
│  1  │
│(2×) │
│     │
└─────┘
 |   |
[G] [G]
```

- **Visual**: 2 stacked rectangles with dashed line between
- **Seats**: Distributed evenly along left and right
- **Height**: 2× single table height

---

## Examples

### Example 1: Wedding Head Table
**Setup:**
- Shape: Rectangle
- Count: 5
- Arrangement: Row

**Result:**
- Long head table with 30 seats
- 15 seats on each long side
- Perfect for wedding party

### Example 2: Conference Workshop
**Setup:**
- Shape: Rectangle
- Count: 3
- Arrangement: Column

**Result:**
- Tall conference table with 18 seats
- 9 seats on each side
- Good for moderator at head

### Example 3: Classroom Rows
**Create 4 tables:**
- Table 1-4: All with Count=3, Arrangement=Row
- Position them in parallel rows

**Result:**
- 4 long rows of tables
- Classroom/theater style seating
- Easy to arrange with drag & drop

---

## Step-by-Step Guide

### Creating a Banquet Row

1. **Create a table**
   - Set number to 1
   - Click "Create"

2. **Configure it**
   - Shape: Rectangle
   - Count: 4 (for example)
   - Arrangement: Row

3. **Result**
   - Long table appears on canvas
   - 24 seats total (4 × 6)
   - Seats distributed along length

4. **Assign guests**
   - Add guests
   - Click "Auto-Assign"
   - Guests fill the long table

### Creating Multiple Rows

1. **Create multiple tables** (e.g., 3)

2. **Configure each**
   - All: Rectangle, Count=3, Arrangement=Row

3. **Arrange on canvas**
   - Drag tables into parallel rows
   - Use grid background for alignment

4. **Result**
   - Classroom/banquet hall layout
   - Multiple rows of long tables

---

## Technical Details

### Data Structure

```typescript
interface Table {
  // ... existing fields ...
  tableCount: number;        // 1-10
  arrangement: TableArrangement;  // SINGLE, ROW, COLUMN
}

enum TableArrangement {
  SINGLE = "SINGLE",
  ROW = "ROW",
  COLUMN = "COLUMN",
}
```

### Capacity Calculation

```typescript
capacity = BASE_CAPACITY[shape] * tableCount

// Examples:
// Square × 3 = 4 × 3 = 12 seats
// Rectangle × 2 = 6 × 2 = 12 seats
```

### Seat Label Format

**Row Arrangement:**
- North 1, North 2, North 3, ...
- South 1, South 2, South 3, ...

**Column Arrangement:**
- West 1, West 2, West 3, ...
- East 1, East 2, East 3, ...

### Visual Rendering

**Dimensions:**
- Single square: 128×128px
- Single rectangle: 160×112px
- Row of 3: 480×112px (3× width)
- Column of 2: 160×224px (2× height)

**Dividers:**
- Dashed lines separate physical tables
- Semi-transparent borders
- Maintains visual unity

---

## Benefits

### Event Planning
- **Flexibility**: Match any venue layout
- **Realism**: Represents actual table arrangements
- **Scalability**: Handle events of any size

### Visual Clarity
- **Clear separation**: See individual table units
- **Accurate spacing**: Seats positioned correctly
- **Easy understanding**: Labels make sense (North 1, North 2, etc.)

### Capacity Management
- **Automatic calculation**: No manual math
- **Clear display**: Shows total capacity
- **Accurate assignments**: Guests fill properly

---

## Migration & Compatibility

### Existing Data

**Automatic migration applied:**
- Old tables get `tableCount = 1`
- Old tables get `arrangement = SINGLE`
- Behaves exactly as before
- No data loss

### New Tables

**Default values:**
- Count: 1
- Arrangement: SINGLE
- Acts like traditional single table

**To create multi-table:**
- Increase Count to 2+
- Select arrangement (Row or Column)
- Capacity updates automatically

---

## Use Cases

### Corporate Events
- **Board meetings**: 2-3 rectangles in row
- **Training sessions**: Multiple rows of 2-3 tables
- **Conferences**: Various arrangements per room

### Weddings
- **Head table**: 4-6 rectangles in row
- **Guest tables**: Singles or pairs
- **Sweetheart table**: Single square

### Parties
- **Buffet serving**: Long row of rectangles
- **Kids table**: 2-3 squares in row
- **Adult tables**: Mix of configurations

### Banquets
- **Theater style**: Multiple rows
- **U-shape**: Arrange manually with drag & drop
- **Hollow square**: 4 rows arranged in square

---

## Tips & Best Practices

### Planning

1. **Start with count**: Determine how many physical tables you need
2. **Choose arrangement**: Row for length, Column for height
3. **Position on canvas**: Use drag & drop to match venue
4. **Verify capacity**: Check total seats vs guests

### Visual Organization

- **Use grid**: Background helps align rows
- **Zoom out**: See full layout
- **Group similar**: Keep same-type tables together
- **Label clearly**: Name tables descriptively

### Capacity Planning

- **Buffer space**: Don't fill every seat
- **Leave 10-15%**: Allow for flexibility
- **Check assignments**: Use auto-assign to verify capacity
- **Adjust counts**: Increase table count if needed

---

## Limitations

### Current Version

- **Max count**: 10 tables per group
- **Arrangements**: Row and Column only (no L-shapes or custom)
- **Seat distribution**: Automatic (not manually adjustable)

### Future Enhancements

Potential additions:
- [ ] Custom arrangements (L-shape, T-shape, etc.)
- [ ] Manual seat positioning within group
- [ ] Rotation of entire group
- [ ] Templates for common layouts
- [ ] Visual gap adjustment between tables
- [ ] Mixed shapes in one group

---

## Troubleshooting

### Tables Look Wrong

**Problem**: Tables overlapping or stacked oddly
**Solution**: Click "Redistribute" button in Table Configuration

### Capacity Seems Off

**Problem**: Total seats don't match expected
**Solution**: Check Count × Base Capacity
- Square: Count × 4
- Rectangle: Count × 6

### Seats Not Showing

**Problem**: Guest names missing from seats
**Solution**:
1. Ensure guests are assigned
2. Check if Count or Arrangement changed (clears assignments)
3. Re-run auto-assign

### Can't Change Arrangement

**Problem**: Arrangement dropdown not visible
**Solution**: Increase Count to 2 or more first

---

## Status

✅ **Implementation**: Complete
✅ **Migration**: Automatic
✅ **UI**: Enhanced configuration panel
✅ **Visual**: Multiple tables rendered
✅ **Seats**: Distributed correctly
✅ **Capacity**: Auto-calculated
✅ **Testing**: Ready for use

---

## Quick Reference

| Setting | Options | Effect |
|---------|---------|--------|
| Count | 1-10 | Number of physical tables |
| Arrangement (count=1) | - | N/A - single table |
| Arrangement (count>1) | Row | Side-by-side (—) |
| Arrangement (count>1) | Column | Stacked (\|) |

| Shape + Count | Total Capacity |
|---------------|----------------|
| Square × 1 | 4 seats |
| Square × 2 | 8 seats |
| Square × 3 | 12 seats |
| Rectangle × 1 | 6 seats |
| Rectangle × 2 | 12 seats |
| Rectangle × 3 | 18 seats |
| Rectangle × 4 | 24 seats |

---

**Updated:** 2024
**Feature:** Multiple tables in row/column
**Status:** ✅ Ready to use
**Server:** http://localhost:3000
