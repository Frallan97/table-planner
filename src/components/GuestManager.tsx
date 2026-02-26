import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlannerGuests as useGuests, usePlannerTables as useTables, usePlannerLabels as useLabels } from "@/hooks/PlannerContext";
import { autoAssignGuests } from "@/lib/algorithms";
import type { CompanionPlacement } from "@/lib/algorithms";
import {
  DietaryRestriction,
  DIETARY_RESTRICTION_LABELS,
} from "@/lib/types";
import type { Guest, SelectedItem } from "@/lib/types";
import {
  Users,
  UserPlus,
  UserMinus,
  Shuffle,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Leaf,
  Fish,
  Milk,
  Pencil,
  Check,
  Zap,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Link,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloorPlanCanvas } from "./FloorPlanCanvas";

type SubTab = "seating" | "list";
type SortField = "name" | "table" | "status" | "dietary" | "guestOf";
type SortDir = "asc" | "desc";

export function GuestManager() {
  const {
    guests,
    setGuests,
    addGuest,
    addGuestsBulk,
    updateGuest,
    deleteGuest,
    clearAssignments: clearGuestAssignments,
    clearAllGuests,
  } = useGuests();
  const { tables, setTables, clearTableAssignments, assignGuestToSeat, removeGuestFromSeat } = useTables();
  const { labels } = useLabels();

  const [subTab, setSubTab] = useState<SubTab>("seating");
  const [bulkInput, setBulkInput] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleGuestOf, setSingleGuestOf] = useState("");
  const [selectedRestrictions, setSelectedRestrictions] = useState<DietaryRestriction[]>([]);
  const [balanceGuests, setBalanceGuests] = useState(true);
  const [randomize, setRandomize] = useState(false);
  const [companionPlacement, setCompanionPlacement] = useState<CompanionPlacement>("next-to");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRestrictions, setEditRestrictions] = useState<DietaryRestriction[]>([]);
  const [editGuestOf, setEditGuestOf] = useState("");

  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; position: number } | null>(null);
  const [guestToAssign, setGuestToAssign] = useState("");

  const [listSearch, setListSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const unassignedGuests = guests.filter((g) => g.assignedTableId === null);
  const assignedCount = guests.filter((g) => g.assignedTableId !== null).length;
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  // ── Seating tab handlers ──────────────────────────────────────────
  const handleSeatClick = (tableId: string, position: number) => {
    if (selectedSeat?.tableId === tableId && selectedSeat.position === position) {
      setSelectedSeat(null);
      setGuestToAssign("");
      return;
    }
    setSelectedSeat({ tableId, position });
    setSelectedItem({ type: "table", ids: [tableId] });
    setGuestToAssign("");
  };

  const getSeatInfo = () => {
    if (!selectedSeat) return null;
    const table = tables.find((t) => t.id === selectedSeat.tableId);
    if (!table) return null;
    const seat = table.seats.find((s) => s.position === selectedSeat.position);
    if (!seat) return null;
    const guest = seat.guestId ? guests.find((g) => g.id === seat.guestId) : null;
    return { table, seat, guest };
  };

  const handleAssignToSeat = () => {
    if (!selectedSeat || !guestToAssign) return;
    assignGuestToSeat(selectedSeat.tableId, selectedSeat.position, guestToAssign);
    updateGuest(guestToAssign, { assignedTableId: selectedSeat.tableId, seatPosition: selectedSeat.position });
    setGuestToAssign("");
    setSelectedSeat(null);
  };

  const handleRemoveFromSeat = () => {
    const info = getSeatInfo();
    if (!selectedSeat || !info?.guest) return;
    removeGuestFromSeat(selectedSeat.tableId, selectedSeat.position);
    updateGuest(info.guest.id, { assignedTableId: null, seatPosition: null });
    setSelectedSeat(null);
  };

  const seatInfo = getSeatInfo();

  // ── Guest editing ─────────────────────────────────────────────────
  const startEditing = (guest: Guest) => {
    setEditingId(guest.id);
    setEditName(guest.name);
    setEditRestrictions(
      guest.dietaryRestrictions.includes(DietaryRestriction.NONE)
        ? []
        : [...guest.dietaryRestrictions]
    );
    setEditGuestOf(guest.guestOf ?? "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditRestrictions([]);
    setEditGuestOf("");
  };

  const saveEditing = () => {
    if (!editingId || !editName.trim()) return;
    const restrictions = editRestrictions.length > 0 ? editRestrictions : [DietaryRestriction.NONE];
    updateGuest(editingId, {
      name: editName.trim(),
      dietaryRestrictions: restrictions,
      guestOf: editGuestOf || null,
    });
    setEditingId(null);
  };

  const toggleEditRestriction = (restriction: DietaryRestriction) => {
    if (restriction === DietaryRestriction.NONE) { setEditRestrictions([]); return; }
    setEditRestrictions((prev) => {
      const filtered = prev.filter((r) => r !== DietaryRestriction.NONE);
      return filtered.includes(restriction) ? filtered.filter((r) => r !== restriction) : [...filtered, restriction];
    });
  };

  // ── Add guest handlers ────────────────────────────────────────────
  const handleBulkAdd = () => {
    if (!bulkInput.trim()) return;
    addGuestsBulk(bulkInput.split("\n").filter((n) => n.trim().length > 0));
    setBulkInput("");
  };

  const handleSingleAdd = () => {
    if (!singleName.trim()) return;
    const restrictions = selectedRestrictions.length > 0 ? selectedRestrictions : [DietaryRestriction.NONE];
    addGuest(singleName, restrictions, singleGuestOf || null);
    setSingleName("");
    setSelectedRestrictions([]);
    setSingleGuestOf("");
  };

  const toggleRestriction = (restriction: DietaryRestriction) => {
    if (restriction === DietaryRestriction.NONE) { setSelectedRestrictions([]); return; }
    setSelectedRestrictions((prev) => {
      const filtered = prev.filter((r) => r !== DietaryRestriction.NONE);
      return filtered.includes(restriction) ? filtered.filter((r) => r !== restriction) : [...filtered, restriction];
    });
  };

  const handleAutoAssign = () => {
    const result = autoAssignGuests(guests, tables, { balanceGuests, randomize, companionPlacement });
    setGuests(result.guests);
    setTables(result.tables);
    setMessage(result.message);
    setMessageType(result.success ? "success" : "error");
    setTimeout(() => { setMessage(""); setMessageType(null); }, 4000);
  };

  const handleClearAssignments = () => {
    clearGuestAssignments();
    clearTableAssignments();
    setMessage("Assignments cleared");
    setMessageType("success");
    setTimeout(() => { setMessage(""); setMessageType(null); }, 3000);
  };

  // ── Sort / filter for list tab ────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedFilteredGuests = useMemo(() => {
    let list = [...guests];
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      list = list.filter((g) => {
        const tbl = g.assignedTableId ? tableMap.get(g.assignedTableId) : null;
        const hostName = g.guestOf ? guestMap.get(g.guestOf)?.name ?? "" : "";
        return (
          g.name.toLowerCase().includes(q) ||
          (tbl?.name ?? "").toLowerCase().includes(q) ||
          hostName.toLowerCase().includes(q)
        );
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "table": {
          const tA = a.assignedTableId ? tableMap.get(a.assignedTableId)?.name ?? "" : "";
          const tB = b.assignedTableId ? tableMap.get(b.assignedTableId)?.name ?? "" : "";
          return tA.localeCompare(tB) * dir;
        }
        case "status": {
          const sA = a.assignedTableId ? 1 : 0;
          const sB = b.assignedTableId ? 1 : 0;
          return (sA - sB) * dir;
        }
        case "dietary": {
          const dA = a.dietaryRestrictions.filter((r) => r !== DietaryRestriction.NONE).length;
          const dB = b.dietaryRestrictions.filter((r) => r !== DietaryRestriction.NONE).length;
          return (dA - dB) * dir;
        }
        case "guestOf": {
          const gA = a.guestOf ? guestMap.get(a.guestOf)?.name ?? "" : "";
          const gB = b.guestOf ? guestMap.get(b.guestOf)?.name ?? "" : "";
          return gA.localeCompare(gB) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [guests, listSearch, sortField, sortDir, tableMap, guestMap]);

  const noopMove = () => {};
  const noopMoveMulti = () => {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      {/* Left sidebar */}
      <div className="lg:col-span-3 space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
        {/* Bulk Add */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="w-3.5 h-3.5" /> Bulk Add
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              className="w-full min-h-[70px] px-2 py-1.5 border rounded-md resize-none text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={"John Smith\nJane Doe\nBob Johnson"}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
            />
            <Button onClick={handleBulkAdd} className="w-full" size="sm" disabled={!bulkInput.trim()}>
              Add {bulkInput.split("\n").filter((n) => n.trim()).length} Guests
            </Button>
            <Button
              variant="outline" size="sm"
              className="w-full border-dashed text-muted-foreground text-xs"
              onClick={() => {
                const SEED: [string, DietaryRestriction[]][] = [
                  ["Anna Karlsson", [DietaryRestriction.NONE]], ["Björn Eriksson", [DietaryRestriction.NONE]],
                  ["Clara Nilsson", [DietaryRestriction.VEGETARIAN]], ["David Lindgren", [DietaryRestriction.NONE]],
                  ["Emma Johansson", [DietaryRestriction.VEGAN]], ["Fredrik Olsson", [DietaryRestriction.NONE]],
                  ["Gunilla Persson", [DietaryRestriction.LACTOSE_INTOLERANT]], ["Henrik Svensson", [DietaryRestriction.NONE]],
                  ["Ida Bergström", [DietaryRestriction.PESCATARIAN]], ["Johan Larsson", [DietaryRestriction.NONE]],
                  ["Karin Holmberg", [DietaryRestriction.VEGETARIAN]], ["Lars Engström", [DietaryRestriction.NONE]],
                  ["Maria Sandberg", [DietaryRestriction.NONE]], ["Nils Forsberg", [DietaryRestriction.LACTOSE_INTOLERANT]],
                  ["Olivia Sjöberg", [DietaryRestriction.NONE]], ["Peter Wallin", [DietaryRestriction.NONE]],
                  ["Rosa Lindqvist", [DietaryRestriction.VEGAN]], ["Stefan Nyström", [DietaryRestriction.NONE]],
                  ["Therese Åberg", [DietaryRestriction.VEGETARIAN]], ["Ulf Dahlberg", [DietaryRestriction.NONE]],
                  ["Viktor Holm", [DietaryRestriction.PESCATARIAN]], ["Wilma Ekström", [DietaryRestriction.NONE]],
                  ["Xavier Blom", [DietaryRestriction.NONE]], ["Ylva Fransson", [DietaryRestriction.LACTOSE_INTOLERANT]],
                  ["Zara Nordström", [DietaryRestriction.NONE]], ["Axel Björk", [DietaryRestriction.VEGETARIAN]],
                  ["Beatrice Lund", [DietaryRestriction.NONE]], ["Carl Magnusson", [DietaryRestriction.NONE]],
                  ["Diana Hedberg", [DietaryRestriction.PESCATARIAN]], ["Erik Sundström", [DietaryRestriction.NONE]],
                ];
                for (const [name, restrictions] of SEED) addGuest(name, restrictions);
              }}
            >
              <Zap className="w-3 h-3 mr-1" /> Seed 30 guests (dev)
            </Button>
          </CardContent>
        </Card>

        {/* Individual Add */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="w-3.5 h-3.5" /> Add Individual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">Name</Label>
              <Input placeholder="Guest name" value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSingleAdd()}
                className="h-7 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Guest of</Label>
              <Select value={singleGuestOf || "_none"} onValueChange={(v) => setSingleGuestOf(v === "_none" ? "" : v)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {guests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Dietary</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(DIETARY_RESTRICTION_LABELS).map(([key, label]) => {
                  const r = key as DietaryRestriction;
                  const isSel = r === DietaryRestriction.NONE ? selectedRestrictions.length === 0 : selectedRestrictions.includes(r);
                  return (
                    <button key={r} type="button" onClick={() => toggleRestriction(r)}
                      className={`px-1.5 py-0 rounded-full text-[10px] font-medium transition-colors ${isSel ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={handleSingleAdd} className="w-full" size="sm" disabled={!singleName.trim()}>
              Add Guest
            </Button>
          </CardContent>
        </Card>

        {/* Auto-Assign */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shuffle className="w-3.5 h-3.5" /> Auto-Assign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="checkbox" checked={balanceGuests} onChange={(e) => setBalanceGuests(e.target.checked)} className="w-3 h-3 rounded" />
                Balance evenly
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} className="w-3 h-3 rounded" />
                Randomize order
              </label>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Companion seating</Label>
              <div className="flex gap-1 mt-0.5">
                {([["next-to", "Next to"], ["across", "Across"], ["none", "Ignore"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setCompanionPlacement(val)}
                    className={`flex-1 text-[10px] py-1 rounded border font-medium transition-colors ${companionPlacement === val ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-muted hover:bg-muted"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAutoAssign} disabled={guests.length === 0 || tables.length === 0} size="sm" className="flex-1 text-xs">
                <Shuffle className="w-3 h-3 mr-1" /> Assign
              </Button>
              <Button onClick={handleClearAssignments} disabled={assignedCount === 0} variant="outline" size="sm" className="flex-1 text-xs">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
            {message && (
              <div className={`flex items-center gap-1.5 p-2 rounded text-xs ${messageType === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {messageType === "success" ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                {message}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
              <span><span className="font-semibold text-green-600">{assignedCount}</span> seated</span>
              <span><span className="font-semibold text-amber-600">{guests.length - assignedCount}</span> unassigned</span>
              <span>{guests.length} total</span>
              {guests.length > 0 && (
                <Button variant="ghost" size="sm" className="h-4 text-[10px] px-1 text-destructive hover:text-destructive ml-auto"
                  onClick={() => { if (window.confirm(`Delete all ${guests.length} guests?`)) clearAllGuests(); }}>
                  <Trash2 className="w-2.5 h-2.5 mr-0.5" /> Clear all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Sub-tabbed content area */}
      <div className="lg:col-span-9 min-h-0">
        <Card className="h-full flex flex-col overflow-hidden">
          <CardHeader className="pb-0 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex border rounded-md overflow-hidden bg-muted/30">
                <button onClick={() => setSubTab("seating")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${subTab === "seating" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
                  <LayoutGrid className="w-3.5 h-3.5" /> Seating
                </button>
                <button onClick={() => setSubTab("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${subTab === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
                  <List className="w-3.5 h-3.5" /> Guest List
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span><span className="font-semibold text-green-600">{assignedCount}</span> seated</span>
                <span><span className="font-semibold text-amber-600">{guests.length - assignedCount}</span> unassigned</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 gap-2 pb-3 pt-3">
            {subTab === "seating" && (
              <>
                <div className="flex-1 min-h-0">
                  <FloorPlanCanvas
                    tables={tables} guests={guests} labels={labels}
                    selectedItem={selectedItem} selectedSeat={selectedSeat}
                    onItemSelect={setSelectedItem}
                    onTableMove={noopMove} onTablesMoveMulti={noopMoveMulti} onLabelMove={noopMove}
                    onSeatClick={handleSeatClick} readOnly
                  />
                </div>
                {selectedSeat && seatInfo && (
                  <div className="border rounded-lg p-3 bg-card shadow-sm shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{seatInfo.table.name} — Seat {selectedSeat.position + 1}</h3>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                        onClick={() => { setSelectedSeat(null); setGuestToAssign(""); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {seatInfo.guest ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {seatInfo.guest.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{seatInfo.guest.name}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRemoveFromSeat}
                          className="text-destructive hover:text-destructive h-7 text-xs">
                          <UserMinus className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Select value={guestToAssign} onValueChange={setGuestToAssign}>
                          <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="Select guest..." /></SelectTrigger>
                          <SelectContent>
                            {unassignedGuests.length === 0
                              ? <SelectItem value="_none" disabled>No unassigned guests</SelectItem>
                              : unassignedGuests.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                            }
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAssignToSeat} disabled={!guestToAssign} size="sm" className="h-8 text-xs">
                          <UserPlus className="w-3 h-3 mr-1" /> Assign
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {subTab === "list" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-2">
                  <Input placeholder="Search by name, table, or guest of..."
                    value={listSearch} onChange={(e) => setListSearch(e.target.value)}
                    className="h-8 text-sm" />
                </div>
                <div className="flex-1 overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                      <tr className="border-b">
                        <SortHeader field="name" label="Name" current={sortField} dir={sortDir} onSort={toggleSort} />
                        <SortHeader field="table" label="Table" current={sortField} dir={sortDir} onSort={toggleSort} />
                        <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onSort={toggleSort} />
                        <SortHeader field="dietary" label="Dietary" current={sortField} dir={sortDir} onSort={toggleSort} />
                        <SortHeader field="guestOf" label="Guest of" current={sortField} dir={sortDir} onSort={toggleSort} />
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredGuests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
                            {guests.length === 0 ? "No guests yet." : "No matching guests."}
                          </td>
                        </tr>
                      ) : sortedFilteredGuests.map((guest) => {
                        const table = guest.assignedTableId ? tableMap.get(guest.assignedTableId) : null;
                        const host = guest.guestOf ? guestMap.get(guest.guestOf) : null;
                        const hasRestrictions = guest.dietaryRestrictions.length > 0 && !guest.dietaryRestrictions.includes(DietaryRestriction.NONE);
                        const isEditing = editingId === guest.id;

                        if (isEditing) {
                          return (
                            <tr key={guest.id} className="bg-primary/5">
                              <td colSpan={6} className="p-3">
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">Name</Label>
                                      <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") saveEditing(); if (e.key === "Escape") cancelEditing(); }}
                                        className="h-7 text-xs" autoFocus />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Guest of</Label>
                                      <Select value={editGuestOf || "_none"} onValueChange={(v) => setEditGuestOf(v === "_none" ? "" : v)}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="_none">None</SelectItem>
                                          {guests.filter((g) => g.id !== editingId).map((g) => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Dietary</Label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Object.entries(DIETARY_RESTRICTION_LABELS).map(([key, label]) => {
                                        const r = key as DietaryRestriction;
                                        const isSel = r === DietaryRestriction.NONE ? editRestrictions.length === 0 : editRestrictions.includes(r);
                                        return (
                                          <button key={r} type="button" onClick={() => toggleEditRestriction(r)}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${isSel ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={saveEditing} disabled={!editName.trim()} className="h-7 text-xs">
                                      <Check className="w-3 h-3 mr-1" /> Save
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={cancelEditing} className="h-7 text-xs">Cancel</Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={guest.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 font-medium">{guest.name}</td>
                            <td className="px-3 py-2 text-xs">
                              {table
                                ? <span>{table.name}{guest.seatPosition !== null && ` #${guest.seatPosition + 1}`}</span>
                                : <span className="text-muted-foreground">—</span>
                              }
                            </td>
                            <td className="px-3 py-2">
                              {guest.assignedTableId ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">Seated</span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Unassigned</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {hasRestrictions ? (
                                <div className="flex flex-wrap gap-0.5">
                                  {guest.dietaryRestrictions.filter((r) => r !== DietaryRestriction.NONE).map((r) => (
                                    <span key={r} className={cn("inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium", dietaryBadge(r))}>
                                      {dietaryIcon(r)}{DIETARY_RESTRICTION_LABELS[r]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">None</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {host ? (
                                <span className="inline-flex items-center gap-1 text-primary">
                                  <Link className="w-3 h-3" />{host.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="sm" onClick={() => startEditing(guest)}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title="Edit">
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteGuest(guest.id)}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" title="Delete">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  Showing {sortedFilteredGuests.length} of {guests.length} guests
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SortHeader({
  field, label, current, dir, onSort,
}: {
  field: SortField; label: string; current: SortField; dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-30" />
        }
      </span>
    </th>
  );
}

function dietaryIcon(r: DietaryRestriction) {
  switch (r) {
    case DietaryRestriction.VEGETARIAN:
    case DietaryRestriction.VEGAN:
      return <Leaf className="w-2.5 h-2.5" />;
    case DietaryRestriction.PESCATARIAN:
      return <Fish className="w-2.5 h-2.5" />;
    case DietaryRestriction.LACTOSE_INTOLERANT:
      return <Milk className="w-2.5 h-2.5" />;
    default:
      return null;
  }
}

function dietaryBadge(r: DietaryRestriction) {
  switch (r) {
    case DietaryRestriction.VEGETARIAN:
      return "bg-green-100 text-green-800";
    case DietaryRestriction.VEGAN:
      return "bg-green-200 text-green-900";
    case DietaryRestriction.PESCATARIAN:
      return "bg-blue-100 text-blue-800";
    case DietaryRestriction.LACTOSE_INTOLERANT:
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
