import { useState, useRef, useCallback } from "react";
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
import { LayoutGrid, UserPlus, UserMinus, X } from "lucide-react";

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
