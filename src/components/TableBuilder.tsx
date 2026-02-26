import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlannerGuests as useGuests, usePlannerTables as useTables, usePlannerLabels as useLabels } from "@/hooks/PlannerContext";
import { TableType } from "@/lib/types";
import type { SelectedItem } from "@/lib/types";
import {
  Minus,
  Trash2,
  ArrowRight,
  Circle,
  LayoutGrid,
  Type,
  Copy,
  CheckSquare,
  Square,
  Plus,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
} from "lucide-react";

interface Props {
  selectedItem: SelectedItem;
  onSelect: (item: SelectedItem) => void;
}

export function TableBuilder({ selectedItem, onSelect }: Props) {
  const {
    tables,
    addLineTable,
    addRoundTable,
    updateTable,
    reconfigureSeats,
    duplicateTables,
    deleteTable,
    clearAllTables,
    clearTableAssignments,
  } = useTables();
  const { labels, addLabel, updateLabel, deleteLabel, clearAllLabels } =
    useLabels();
  const { clearAssignments: clearGuestAssignments } = useGuests();

  const selectedTableIds =
    selectedItem?.type === "table" ? selectedItem.ids : [];
  const selectedTable =
    selectedTableIds.length === 1
      ? tables.find((t) => t.id === selectedTableIds[0]) ?? null
      : null;
  const selectedLabel =
    selectedItem?.type === "label"
      ? labels.find((l) => l.id === selectedItem.id) ?? null
      : null;

  const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);

  const toggleTableSelection = (id: string) => {
    const prev = selectedTableIds;
    const next = prev.includes(id)
      ? prev.filter((i) => i !== id)
      : [...prev, id];
    onSelect(next.length > 0 ? { type: "table", ids: next } : null);
  };

  const toggleAll = () => {
    if (selectedTableIds.length === tables.length) {
      onSelect(null);
    } else {
      onSelect({ type: "table", ids: tables.map((t) => t.id) });
    }
  };

  const handleDuplicateChecked = () => {
    const ids = selectedTableIds.filter((id) =>
      tables.some((t) => t.id === id)
    );
    if (ids.length === 0) return;
    duplicateTables(ids);
  };

  const handleDuplicateSingle = (id: string) => {
    duplicateTables([id]);
  };

  const handleDeleteChecked = () => {
    if (!window.confirm(`Delete ${selectedTableIds.length} selected table${selectedTableIds.length !== 1 ? "s" : ""}?`)) return;
    for (const id of selectedTableIds) {
      deleteTable(id);
    }
    onSelect(null);
  };

  const handleDeleteTable = (id: string) => {
    deleteTable(id);
    if (selectedItem?.type === "table" && selectedItem.ids.includes(id)) {
      const remaining = selectedItem.ids.filter((i) => i !== id);
      onSelect(remaining.length > 0 ? { type: "table", ids: remaining } : null);
    }
  };

  const handleDeleteLabel = (id: string) => {
    deleteLabel(id);
    if (selectedItem?.type === "label" && selectedItem.id === id) onSelect(null);
  };

  const handleClearAll = () => {
    if (!window.confirm("Delete all tables, labels, and seat assignments? This cannot be undone.")) return;
    clearAllTables();
    clearAllLabels();
    clearGuestAssignments();
    onSelect(null);
  };

  const handleClearAssignments = () => {
    clearTableAssignments();
    clearGuestAssignments();
  };

  const getSeatsPerSide = () => {
    if (!selectedTable || selectedTable.tableType !== TableType.LINE) return 6;
    const endCount =
      (selectedTable.endSeatLeft ? 1 : 0) +
      (selectedTable.endSeatRight ? 1 : 0);
    const sideSeats = selectedTable.seats.length - endCount;
    return selectedTable.singleSided ? sideSeats : sideSeats / 2;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="w-4 h-4" />
          Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Elements */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            Add element
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addLineTable()}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <Minus className="w-4 h-4" />
              <span className="text-[10px]">Table</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addRoundTable()}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <Circle className="w-4 h-4" />
              <span className="text-[10px]">Round</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const id = addLabel();
                onSelect({ type: "label", id });
              }}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <Type className="w-4 h-4" />
              <span className="text-[10px]">Label</span>
            </Button>
          </div>
        </div>

        {/* Table List */}
        {tables.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">
                Tables ({tables.length}) — {totalCapacity} seats
              </Label>
              <button
                onClick={toggleAll}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                title={
                  selectedTableIds.length === tables.length
                    ? "Deselect all"
                    : "Select all"
                }
              >
                {selectedTableIds.length === tables.length ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Batch actions */}
            {selectedTableIds.length > 1 && (
              <div className="flex gap-1.5 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicateChecked}
                  className="flex-1 h-7 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Duplicate ({selectedTableIds.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteChecked}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  ({selectedTableIds.length})
                </Button>
              </div>
            )}

            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {tables.map((t) => (
                <div
                  key={t.id}
                  onClick={(e) => {
                    if (e.shiftKey && selectedItem?.type === "table") {
                      const prev = selectedItem.ids;
                      const next = prev.includes(t.id)
                        ? prev.filter((id) => id !== t.id)
                        : [...prev, t.id];
                      onSelect(next.length > 0 ? { type: "table", ids: next } : null);
                    } else {
                      onSelect({ type: "table", ids: [t.id] });
                    }
                  }}
                  className={`flex items-center justify-between p-1.5 rounded text-sm cursor-pointer transition-colors ${
                    selectedTableIds.includes(t.id)
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/30 border border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTableSelection(t.id);
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        selectedTableIds.includes(t.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30 hover:border-muted-foreground/60"
                      }`}
                    >
                      {selectedTableIds.includes(t.id) && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M2 5.5L4 7.5L8 3" />
                        </svg>
                      )}
                    </button>
                    <TypeBadge type={t.tableType} />
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.assignedGuests.length}/{t.capacity}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Duplicate table"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateSingle(t.id);
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(t.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Label List */}
        {labels.length > 0 && (
          <div className="border-t pt-3">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Labels ({labels.length})
            </Label>
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {labels.map((l) => (
                <div
                  key={l.id}
                  onClick={() => onSelect({ type: "label", id: l.id })}
                  className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer transition-colors ${
                    selectedItem?.type === "label" && selectedItem.id === l.id ? "bg-primary/10 border border-primary/30" : "bg-muted/30 border border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold shrink-0 bg-amber-100 text-amber-700">
                      <Type className="w-2.5 h-2.5" />
                    </span>
                    <span className="truncate font-medium">{l.text}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLabel(l.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-table properties (2+ tables selected) */}
        {selectedTableIds.length > 1 && (() => {
          const selected = tables.filter((t) => selectedTableIds.includes(t.id));
          const lineSelected = selected.filter((t) => t.tableType === TableType.LINE);
          const roundSelected = selected.filter((t) => t.tableType === TableType.ROUND);

          const getMultiSeatsPerSide = () => {
            if (lineSelected.length === 0) return 6;
            const t = lineSelected[0];
            const endCount = (t.endSeatLeft ? 1 : 0) + (t.endSeatRight ? 1 : 0);
            const sideSeats = t.seats.length - endCount;
            return t.singleSided ? sideSeats : sideSeats / 2;
          };

          const allSameRotation = selected.every((t) => t.rotation === selected[0]?.rotation);

          return (
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  {selectedTableIds.length} tables selected
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => {
                    const newIds = duplicateTables(selectedTableIds);
                    if (newIds.length > 0)
                      onSelect({ type: "table", ids: newIds });
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Duplicate ({selectedTableIds.length})
                </Button>
              </div>
              <AlignButtons
                tables={selected}
                onUpdate={(id, pos) => updateTable(id, { position: pos })}
              />
              <RotationControl
                rotation={allSameRotation ? (selected[0]?.rotation ?? 0) : 0}
                onChange={(r) => {
                  for (const id of selectedTableIds) {
                    updateTable(id, { rotation: r });
                  }
                }}
              />
              {lineSelected.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">
                      Seats per side{lineSelected.length < selected.length ? ` (${lineSelected.length} line tables)` : ""}
                    </Label>
                    <StepperInput
                      value={getMultiSeatsPerSide()}
                      min={1}
                      max={30}
                      onChange={(v) => {
                        for (const t of lineSelected) {
                          reconfigureSeats(t.id, {
                            seatsPerSide: v,
                            singleSided: t.singleSided,
                          });
                        }
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lineSelected.every((t) => t.singleSided)}
                      onChange={(e) => {
                        for (const t of lineSelected) {
                          const endCount = (t.endSeatLeft ? 1 : 0) + (t.endSeatRight ? 1 : 0);
                          const sideSeats = t.seats.length - endCount;
                          const ps = t.singleSided ? sideSeats : sideSeats / 2;
                          reconfigureSeats(t.id, {
                            seatsPerSide: ps,
                            singleSided: e.target.checked,
                          });
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    Single-sided
                  </label>
                </div>
              )}
              {roundSelected.length > 0 && (
                <div>
                  <Label className="text-xs">
                    Seats{roundSelected.length < selected.length ? ` (${roundSelected.length} round tables)` : ""}
                  </Label>
                  <StepperInput
                    value={roundSelected[0]?.seats.length ?? 8}
                    min={3}
                    max={20}
                    onChange={(v) => {
                      for (const t of roundSelected) {
                        reconfigureSeats(t.id, { seatCount: v });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* Selected Table Properties */}
        {selectedTable && (
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Table: {selectedTable.name}
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  const newIds = duplicateTables([selectedTable.id]);
                  if (newIds.length > 0)
                    onSelect({ type: "table", ids: [newIds[0]] });
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Duplicate
              </Button>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={selectedTable.name}
                onChange={(e) =>
                  updateTable(selectedTable.id, { name: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>
            <RotationControl
              rotation={selectedTable.rotation}
              onChange={(r) => updateTable(selectedTable.id, { rotation: r })}
            />
            {selectedTable.tableType === TableType.LINE && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Seats per side</Label>
                  <StepperInput
                    value={getSeatsPerSide()}
                    min={1}
                    max={30}
                    onChange={(v) => {
                      reconfigureSeats(selectedTable.id, {
                        seatsPerSide: v,
                        singleSided: selectedTable.singleSided,
                      });
                    }}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTable.singleSided}
                    onChange={(e) =>
                      reconfigureSeats(selectedTable.id, {
                        seatsPerSide: getSeatsPerSide(),
                        singleSided: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  Single-sided
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTable.endSeatLeft ?? false}
                      onChange={(e) =>
                        reconfigureSeats(selectedTable.id, {
                          seatsPerSide: getSeatsPerSide(),
                          endSeatLeft: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded"
                    />
                    Left end
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTable.endSeatRight ?? false}
                      onChange={(e) =>
                        reconfigureSeats(selectedTable.id, {
                          seatsPerSide: getSeatsPerSide(),
                          endSeatRight: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded"
                    />
                    Right end
                  </label>
                </div>
              </div>
            )}
            {selectedTable.tableType === TableType.U_SHAPE && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Top</Label>
                  <Input
                    type="number"
                    min="2"
                    max="30"
                    value={selectedTable.topSeats}
                    onChange={(e) =>
                      reconfigureSeats(selectedTable.id, {
                        topSeats: Math.max(2, parseInt(e.target.value) || 2),
                        leftSeats: selectedTable.leftSeats,
                        rightSeats: selectedTable.rightSeats,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Left</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={selectedTable.leftSeats}
                    onChange={(e) =>
                      reconfigureSeats(selectedTable.id, {
                        topSeats: selectedTable.topSeats,
                        leftSeats: Math.max(1, parseInt(e.target.value) || 1),
                        rightSeats: selectedTable.rightSeats,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Right</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={selectedTable.rightSeats}
                    onChange={(e) =>
                      reconfigureSeats(selectedTable.id, {
                        topSeats: selectedTable.topSeats,
                        leftSeats: selectedTable.leftSeats,
                        rightSeats: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
            {selectedTable.tableType === TableType.ROUND && (
              <div>
                <Label className="text-xs">Seats</Label>
                <Input
                  type="number"
                  min="3"
                  max="20"
                  value={selectedTable.seats.length}
                  onChange={(e) =>
                    reconfigureSeats(selectedTable.id, {
                      seatCount: Math.max(3, parseInt(e.target.value) || 3),
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Selected Label Properties */}
        {selectedLabel && (
          <div className="border-t pt-3 space-y-3">
            <Label className="text-xs text-muted-foreground block">
              Label
            </Label>
            <div>
              <Label className="text-xs">Text</Label>
              <Input
                value={selectedLabel.text}
                onChange={(e) =>
                  updateLabel(selectedLabel.id, { text: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>
            <RotationControl
              rotation={selectedLabel.rotation}
              onChange={(r) => updateLabel(selectedLabel.id, { rotation: r })}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Width</Label>
                <StepperInput
                  value={selectedLabel.width}
                  min={40}
                  max={600}
                  step={10}
                  onChange={(v) =>
                    updateLabel(selectedLabel.id, { width: v })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Height</Label>
                <StepperInput
                  value={selectedLabel.height}
                  min={20}
                  max={400}
                  step={10}
                  onChange={(v) =>
                    updateLabel(selectedLabel.id, { height: v })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Font size</Label>
              <StepperInput
                value={selectedLabel.fontSize}
                min={8}
                max={48}
                onChange={(v) =>
                  updateLabel(selectedLabel.id, { fontSize: v })
                }
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {(tables.length > 0 || labels.length > 0) && (
          <div className="border-t pt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAssignments}
              className="flex-1 text-xs"
            >
              Clear Seats
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="flex-1 text-xs text-destructive hover:text-destructive"
            >
              Delete All
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RotationControl({
  rotation,
  onChange,
}: {
  rotation: number;
  onChange: (r: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Rotation</Label>
        <span className="text-xs text-muted-foreground">{rotation}°</span>
      </div>
      <input
        type="range"
        min="-180"
        max="180"
        step="5"
        value={rotation}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 mt-1"
      />
      <div className="flex gap-1 mt-1">
        {[-90, -45, 0, 45, 90, 180].map((deg) => (
          <button
            key={deg}
            onClick={() => onChange(deg)}
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              rotation === deg
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 border-muted hover:bg-muted"
            }`}
          >
            {deg}°
          </button>
        ))}
      </div>
    </div>
  );
}

function StepperInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center gap-0">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="h-8 w-8 flex items-center justify-center rounded-l-md border border-r-0 bg-muted/50 hover:bg-muted disabled:opacity-40 transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value) || min))}
        className="h-8 text-sm rounded-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="h-8 w-8 flex items-center justify-center rounded-r-md border border-l-0 bg-muted/50 hover:bg-muted disabled:opacity-40 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function AlignButtons({
  tables: selected,
  onUpdate,
}: {
  tables: { id: string; position: { x: number; y: number } }[];
  onUpdate: (id: string, pos: { x: number; y: number }) => void;
}) {
  if (selected.length < 2) return null;
  const xs = selected.map((t) => t.position.x);
  const ys = selected.map((t) => t.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const avgX = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const avgY = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length);

  const alignActions: { icon: React.ReactNode; title: string; fn: () => void }[] = [
    {
      icon: <AlignHorizontalJustifyStart className="w-3.5 h-3.5" />,
      title: "Align left",
      fn: () => selected.forEach((t) => onUpdate(t.id, { x: minX, y: t.position.y })),
    },
    {
      icon: <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />,
      title: "Align center horizontally",
      fn: () => selected.forEach((t) => onUpdate(t.id, { x: avgX, y: t.position.y })),
    },
    {
      icon: <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" />,
      title: "Align right",
      fn: () => selected.forEach((t) => onUpdate(t.id, { x: maxX, y: t.position.y })),
    },
    {
      icon: <AlignVerticalJustifyStart className="w-3.5 h-3.5" />,
      title: "Align top",
      fn: () => selected.forEach((t) => onUpdate(t.id, { x: t.position.x, y: minY })),
    },
    {
      icon: <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />,
      title: "Align center vertically",
      fn: () => selected.forEach((t) => onUpdate(t.id, { x: t.position.x, y: avgY })),
    },
    {
      icon: <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />,
      title: "Align bottom",
      fn: () => selected.forEach((t) => onUpdate(t.id, { x: t.position.x, y: maxY })),
    },
  ];

  const distributeActions: { icon: React.ReactNode; title: string; fn: () => void }[] = [
    {
      icon: <AlignHorizontalSpaceAround className="w-3.5 h-3.5" />,
      title: "Equal distance horizontally",
      fn: () => {
        const sorted = [...selected].sort((a, b) => a.position.x - b.position.x);
        const step = sorted.length > 1 ? (maxX - minX) / (sorted.length - 1) : 0;
        sorted.forEach((t, i) => onUpdate(t.id, { x: Math.round(minX + i * step), y: t.position.y }));
      },
    },
    {
      icon: <AlignVerticalSpaceAround className="w-3.5 h-3.5" />,
      title: "Equal distance vertically",
      fn: () => {
        const sorted = [...selected].sort((a, b) => a.position.y - b.position.y);
        const step = sorted.length > 1 ? (maxY - minY) / (sorted.length - 1) : 0;
        sorted.forEach((t, i) => onUpdate(t.id, { x: t.position.x, y: Math.round(minY + i * step) }));
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Align</Label>
        <div className="grid grid-cols-3 gap-1">
          {alignActions.map((a, i) => (
            <button
              key={i}
              title={a.title}
              onClick={a.fn}
              className="h-7 flex items-center justify-center rounded border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Equal distance</Label>
        <div className="grid grid-cols-2 gap-1">
          {distributeActions.map((a, i) => (
            <button
              key={i}
              title={a.title}
              onClick={a.fn}
              className="h-7 flex items-center justify-center gap-1.5 rounded border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-[10px]"
            >
              {a.icon}
              <span>{i === 0 ? "Horizontal" : "Vertical"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: TableType }) {
  const cls =
    "w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold shrink-0";
  switch (type) {
    case TableType.LINE:
      return (
        <span className={`${cls} bg-blue-100 text-blue-700`}>
          <ArrowRight className="w-2.5 h-2.5" />
        </span>
      );
    case TableType.U_SHAPE:
      return (
        <span className={`${cls} bg-purple-100 text-purple-700`}>U</span>
      );
    case TableType.ROUND:
      return (
        <span className={`${cls} bg-green-100 text-green-700`}>
          <Circle className="w-2.5 h-2.5" />
        </span>
      );
  }
}
