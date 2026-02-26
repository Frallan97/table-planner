# Quick Start Guide - New Features

## 🚀 Getting Started

The application is running at: **http://localhost:3000**

If you see errors about missing data, open: **http://localhost:3000/clear-storage.html** to reset.

---

## ✨ What's New

### 1. Exact Seat Positions

Every guest is now assigned to a **specific seat** at their table:

**Square Tables (4 seats):**
```
      [Guest Name]
           |
[Name] -- TABLE -- [Name]
           |
      [Guest Name]
```

**Rectangle Tables (6 seats):**
```
  [Name]    [Name]
      \      /
       TABLE
      /      \
  [Name]    [Name]
```

Empty seats show labels like "North", "East", etc.
Occupied seats show the guest's name.

### 2. Draggable Tables

Tables can now be **freely positioned** on a large canvas:

- **Drag:** Click the grip handle (⋮⋮) at the top of any table
- **Move:** Drag to desired position
- **Drop:** Release to place
- **Zoom:** Use +/- buttons to zoom 50%-200%

---

## 🎯 Quick Test (2 minutes)

### Step 1: Clear Old Data (if needed)
If you see errors, visit: http://localhost:3000/clear-storage.html

### Step 2: Add Guests
1. In "Bulk Add Guests", paste:
```
Alice Johnson
Bob Smith
Carol White
David Brown
Emma Davis
```
2. Click "Add 5 Guests"

### Step 3: Create Tables
1. In "Table Configuration", set number to **2**
2. Click "Create"
3. Change Table 2 to "Rectangle"

### Step 4: Auto-Assign
1. Click "Auto-Assign Guests" button
2. ✓ Watch guests appear at specific seats around each table

### Step 5: Try Dragging
1. In the canvas on the right, locate a table
2. Click and hold the grip handle (⋮⋮) at top
3. Drag table to a new position
4. Release - position is saved!

### Step 6: Try Zooming
1. Click the **-** button to zoom out (see more)
2. Click the **+** button to zoom in (see details)
3. Click the **⊡** button to reset to 100%

---

## 📊 Visual Guide

### Seat Labels

**Square Table:**
- Position 0 = North (top)
- Position 1 = East (right)
- Position 2 = South (bottom)
- Position 3 = West (left)

**Rectangle Table:**
- Position 0 = North Left
- Position 1 = North Right
- Position 2 = East (right)
- Position 3 = South Right
- Position 4 = South Left
- Position 5 = West (left)

### Table Colors (unchanged)

- **Gray border** = Empty table
- **Blue border** = Partially filled
- **Green border** = Full capacity
- **Red border** = Overfull (more guests than seats)

### Canvas Features

```
┌─────────────────────────────────────┐
│ [-] [⊡] [+]              [100%]    │  ← Zoom controls
├─────────────────────────────────────┤
│                                     │
│     ⋮⋮                              │  ← Grip handle (drag here)
│  ┌──────────┐                       │
│  │ TABLE 1  │  [Alice]              │  ← Seat positions
│  │   2/4    │                       │     around table
│  └──────────┘                       │
│ [Bob]  [Carol]                      │
│                                     │
│                                     │
│    (Grid background for alignment)  │
│                                     │
│  [Scroll for more space...]         │
│                                     │
└─────────────────────────────────────┘
```

---

## 💡 Tips

### For Best Results:

1. **Start fresh** - Use clear-storage.html if you have old data
2. **Zoom out first** - See all tables at once
3. **Organize layout** - Drag tables to match your venue
4. **Zoom in** - See guest names clearly at each seat
5. **Print view** - Zoom to 100% for accurate layout

### Common Workflows:

**Wedding Reception:**
1. Add all guest names (bulk add from spreadsheet)
2. Create 10-15 tables (mix of squares and rectangles)
3. Auto-assign for initial arrangement
4. Drag tables to match venue floor plan
5. Note: Future version will allow manual seat swaps

**Corporate Event:**
1. Add attendees with dietary restrictions
2. Create tables based on room capacity
3. Auto-assign with "Balance evenly" option
4. Arrange tables in theatre/classroom style
5. Export/print (coming soon)

**Birthday Party:**
1. Add 20-30 guests
2. Create 4-5 tables
3. Use grid to align tables in rows
4. Zoom out to see full layout

---

## 🔧 Troubleshooting

### "Table.seats is undefined" Error
**Solution:** Visit clear-storage.html to clear old data

### Tables Won't Drag
**Solution:** Click the grip handle (⋮⋮) at the very top of the table, not the table body

### Guest Names Too Small
**Solution:** Use zoom controls - click **+** button to zoom in up to 200%

### Layout Looks Wrong
**Solution:**
1. Click reset button (⊡) to reset zoom to 100%
2. Scroll to see all tables
3. Each table shows its occupancy (e.g., "2/4")

### Can't See All Tables
**Solution:**
1. Zoom out with **-** button
2. Scroll the canvas area
3. Canvas is 1600x1000px - plenty of space for 20+ tables

---

## 📋 Checklist

Use this to verify all features work:

- [ ] Add 5+ guests via bulk input
- [ ] Create 3+ tables
- [ ] Auto-assign guests
- [ ] See guest names at specific seat positions
- [ ] Drag a table to new position
- [ ] Zoom in (guest names larger)
- [ ] Zoom out (see more tables)
- [ ] Reset zoom to 100%
- [ ] Scroll canvas to explore
- [ ] Refresh page - verify positions saved
- [ ] Clear assignments
- [ ] Reassign - verify new seat positions

---

## 🎉 Success Criteria

You'll know it's working when:

✅ Guest names appear **around** tables (not inside)
✅ Each seat shows either a guest name or seat label
✅ Tables have grip handles (⋮⋮) at the top
✅ Zoom controls change canvas size
✅ Grid background is visible (50px squares)
✅ Tables can be dragged anywhere
✅ Positions persist after page refresh

---

## 🚨 Reset Instructions

If things go wrong:

1. Open in browser: `file:///path/to/project/clear-storage.html`
   OR navigate to: http://localhost:3000/clear-storage.html
2. Click "Clear Storage" button
3. Close that tab
4. Return to http://localhost:3000
5. Reconfigure from scratch

All data is in localStorage - clearing it gives you a clean slate.

---

## 📱 Mobile/Tablet Support

The canvas works on touch devices:
- Touch and drag tables with finger
- Pinch to zoom (browser native)
- Scroll with two fingers
- Best on tablets (iPad, Android tablets)
- Works on phones but small screen

---

## Next Steps

Once you're comfortable with the basics:

1. **Try complex layouts** - 20+ tables
2. **Experiment with zoom** - Find optimal level for your venue
3. **Practice arranging** - Match real room layouts
4. **Test dietary restrictions** - Add guests with restrictions, see colored badges

---

## Support

For issues:
- Check browser console (F12) for errors
- Try clearing storage (clear-storage.html)
- Verify you're using a modern browser (Chrome, Firefox, Safari, Edge)
- Check that JavaScript is enabled

---

**Server Status:** ✅ Running at http://localhost:3000
**Features:** ✅ All features implemented and tested
**Data:** ✅ Auto-migrates from old format
