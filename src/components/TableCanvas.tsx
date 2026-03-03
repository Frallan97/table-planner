import { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlannerGuests as useGuests, usePlannerTables as useTables, usePlannerLabels as useLabels } from "@/hooks/PlannerContext";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import type { SelectedItem } from "@/lib/types";
import { LayoutGrid, UserPlus, UserMinus, X, Eye, EyeOff, Search } from "lucide-react";

interface Props {
  selectedItem: SelectedItem;
  onSelectItem: (item: SelectedItem) => void;
}

export function TableCanvas({ selectedItem, onSelectItem }: Props) {
  const { guests, updateGuest } = useGuests();
  const { tables, updateTable, deleteTable, duplicateTables, assignGuestToSeat, removeGuestFromSeat } =
    useTables();
  const { labels, updateLabel, deleteLabel } = useLabels();

  const clipboardRef = useRef<string[]>([]);

  const [selectedSeat, setSelectedSeat] = useState<{
    tableId: string;
    position: number;
  } | null>(null);
  const [guestToAssign, setGuestToAssign] = useState("");
  const [showGuestNames, setShowGuestNames] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightGuestId, setHighlightGuestId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const focusOnPointRef = useRef<((x: number, y: number, zoom?: number) => void) | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return guests.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, guests]);

  const handleSelectSearchResult = useCallback((guestId: string) => {
    const guest = guests.find((g) => g.id === guestId);
    if (!guest?.assignedTableId) return;
    const table = tables.find((t) => t.id === guest.assignedTableId);
    if (!table) return;

    if (focusOnPointRef.current) {
      focusOnPointRef.current(table.position.x, table.position.y);
    }
    setHighlightGuestId(guestId);
    setSearchQuery("");
    setShowSearchDropdown(false);

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightGuestId(null), 3000);
  }, [guests, tables]);

  const handleFocusOnPoint = useCallback((fn: (x: number, y: number, zoom?: number) => void) => {
    focusOnPointRef.current = fn;
  }, []);

  const assignedCount = guests.filter(
    (g) => g.assignedTableId !== null
  ).length;
  const unassignedGuests = guests.filter((g) => g.assignedTableId === null);

  const handleSeatClick = (tableId: string, position: number) => {
    if (
      selectedSeat?.tableId === tableId &&
      selectedSeat.position === position
    ) {
      setSelectedSeat(null);
      setGuestToAssign("");
      return;
    }
    setSelectedSeat({ tableId, position });
    onSelectItem({ type: "table", ids: [tableId] });
    setGuestToAssign("");
  };

  const handleItemSelect = (item: SelectedItem) => {
    onSelectItem(item);
    if (!item || item.type !== "table") {
      setSelectedSeat(null);
      setGuestToAssign("");
    }
  };

  const handleTableMove = (id: string, pos: { x: number; y: number }) => {
    updateTable(id, { position: pos });
  };

  const handleTablesMoveMulti = (moves: { id: string; pos: { x: number; y: number } }[]) => {
    for (const m of moves) {
      updateTable(m.id, { position: m.pos });
    }
  };

  const handleLabelMove = (id: string, pos: { x: number; y: number }) => {
    updateLabel(id, { position: pos });
  };

  const handleDeleteSelected = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "table") {
      for (const id of selectedItem.ids) {
        deleteTable(id);
      }
    } else {
      deleteLabel(selectedItem.id);
    }
    onSelectItem(null);
  };

  const getSeatInfo = () => {
    if (!selectedSeat) return null;
    const table = tables.find((t) => t.id === selectedSeat.tableId);
    if (!table) return null;
    const seat = table.seats.find((s) => s.position === selectedSeat.position);
    if (!seat) return null;
    const guest = seat.guestId
      ? guests.find((g) => g.id === seat.guestId)
      : null;
    return { table, seat, guest };
  };

  const handleAssign = () => {
    if (!selectedSeat || !guestToAssign) return;
    assignGuestToSeat(
      selectedSeat.tableId,
      selectedSeat.position,
      guestToAssign
    );
    updateGuest(guestToAssign, {
      assignedTableId: selectedSeat.tableId,
      seatPosition: selectedSeat.position,
    });
    setGuestToAssign("");
    setSelectedSeat(null);
  };

  const handleRemove = () => {
    const info = getSeatInfo();
    if (!selectedSeat || !info?.guest) return;
    removeGuestFromSeat(selectedSeat.tableId, selectedSeat.position);
    updateGuest(info.guest.id, {
      assignedTableId: null,
      seatPosition: null,
    });
    setSelectedSeat(null);
  };

  const handleCopySelected = useCallback(() => {
    if (selectedItem?.type === "table" && selectedItem.ids.length > 0) {
      clipboardRef.current = [...selectedItem.ids];
    }
  }, [selectedItem]);

  const handlePasteSelected = useCallback(() => {
    const ids = clipboardRef.current.filter((id) => tables.some((t) => t.id === id));
    if (ids.length === 0) return;
    const newIds = duplicateTables(ids);
    if (newIds.length > 0) {
      onSelectItem({ type: "table", ids: newIds });
    }
  }, [tables, duplicateTables, onSelectItem]);

  const seatInfo = getSeatInfo();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="w-4 h-4" />
            Floor Plan
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex items-center gap-1 h-7 border rounded px-2 bg-muted/30">
                <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Find guest..."
                  className="bg-transparent text-xs outline-none w-24 placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setShowSearchDropdown(false); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {showSearchDropdown && searchResults.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
                  <div className="absolute top-full left-0 mt-1 w-56 bg-background border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
                    {searchResults.map((g) => {
                      const table = g.assignedTableId ? tables.find((t) => t.id === g.assignedTableId) : null;
                      return (
                        <button
                          key={g.id}
                          onClick={() => handleSelectSearchResult(g.id)}
                          disabled={!g.assignedTableId}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50 text-left"
                        >
                          <span className="font-medium truncate">{g.name}</span>
                          <span className="text-muted-foreground ml-2 flex-shrink-0">
                            {table ? table.name : "unassigned"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGuestNames(!showGuestNames)}
              className="h-7 text-xs gap-1.5"
              title={showGuestNames ? "Hide guest names" : "Show guest names"}
            >
              {showGuestNames ? (
                <><Eye className="w-3.5 h-3.5" /> Names</>
              ) : (
                <><EyeOff className="w-3.5 h-3.5" /> Names</>
              )}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-green-600">
                  {assignedCount}
                </span>{" "}
                seated
              </span>
              <span>
                <span className="font-semibold text-amber-600">
                  {guests.length - assignedCount}
                </span>{" "}
                unassigned
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 gap-2 pb-3">
        <div className="flex-1 min-h-0">
          <FloorPlanCanvas
            tables={tables}
            guests={guests}
            labels={labels}
            selectedItem={selectedItem}
            selectedSeat={selectedSeat}
            onItemSelect={handleItemSelect}
            onTableMove={handleTableMove}
            onTablesMoveMulti={handleTablesMoveMulti}
            onLabelMove={handleLabelMove}
            onSeatClick={handleSeatClick}
            onDeleteSelected={handleDeleteSelected}
            onCopySelected={handleCopySelected}
            onPasteSelected={handlePasteSelected}
            showGuestNames={showGuestNames}
            highlightGuestId={highlightGuestId}
            onFocusOnPoint={handleFocusOnPoint}
          />
        </div>

        {selectedSeat && seatInfo && (
          <div className="border rounded-lg p-3 bg-card shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">
                {seatInfo.table.name} — Seat {selectedSeat.position + 1}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  setSelectedSeat(null);
                  setGuestToAssign("");
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {seatInfo.guest ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                    {seatInfo.guest.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">
                    {seatInfo.guest.name}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  className="text-destructive hover:text-destructive h-7 text-xs"
                >
                  <UserMinus className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={guestToAssign}
                  onValueChange={setGuestToAssign}
                >
                  <SelectTrigger className="flex-1 h-8 text-sm">
                    <SelectValue placeholder="Select guest..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedGuests.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No unassigned guests
                      </SelectItem>
                    ) : (
                      unassignedGuests.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssign}
                  disabled={!guestToAssign}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Assign
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
