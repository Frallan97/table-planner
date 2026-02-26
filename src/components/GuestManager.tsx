import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlannerGuests as useGuests, usePlannerTables as useTables } from "@/hooks/PlannerContext";
import { autoAssignGuests } from "@/lib/algorithms";
import {
  DietaryRestriction,
  DIETARY_RESTRICTION_LABELS,
} from "@/lib/types";
import type { Guest } from "@/lib/types";
import {
  Users,
  UserPlus,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { tables, setTables, clearTableAssignments } = useTables();

  const [bulkInput, setBulkInput] = useState("");
  const [singleName, setSingleName] = useState("");
  const [selectedRestrictions, setSelectedRestrictions] = useState<
    DietaryRestriction[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceGuests, setBalanceGuests] = useState(true);
  const [randomize, setRandomize] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRestrictions, setEditRestrictions] = useState<DietaryRestriction[]>([]);

  const startEditing = (guest: Guest) => {
    setEditingId(guest.id);
    setEditName(guest.name);
    setEditRestrictions(
      guest.dietaryRestrictions.includes(DietaryRestriction.NONE)
        ? []
        : [...guest.dietaryRestrictions]
    );
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditRestrictions([]);
  };

  const saveEditing = () => {
    if (!editingId || !editName.trim()) return;
    const restrictions =
      editRestrictions.length > 0
        ? editRestrictions
        : [DietaryRestriction.NONE];
    updateGuest(editingId, {
      name: editName.trim(),
      dietaryRestrictions: restrictions,
    });
    setEditingId(null);
  };

  const toggleEditRestriction = (restriction: DietaryRestriction) => {
    if (restriction === DietaryRestriction.NONE) {
      setEditRestrictions([]);
      return;
    }
    setEditRestrictions((prev) => {
      const filtered = prev.filter((r) => r !== DietaryRestriction.NONE);
      return filtered.includes(restriction)
        ? filtered.filter((r) => r !== restriction)
        : [...filtered, restriction];
    });
  };

  const handleBulkAdd = () => {
    if (!bulkInput.trim()) return;
    const names = bulkInput
      .split("\n")
      .filter((name) => name.trim().length > 0);
    addGuestsBulk(names);
    setBulkInput("");
  };

  const handleSingleAdd = () => {
    if (!singleName.trim()) return;
    const restrictions =
      selectedRestrictions.length > 0
        ? selectedRestrictions
        : [DietaryRestriction.NONE];
    addGuest(singleName, restrictions);
    setSingleName("");
    setSelectedRestrictions([]);
  };

  const toggleRestriction = (restriction: DietaryRestriction) => {
    if (restriction === DietaryRestriction.NONE) {
      setSelectedRestrictions([]);
      return;
    }
    setSelectedRestrictions((prev) => {
      const filtered = prev.filter((r) => r !== DietaryRestriction.NONE);
      return filtered.includes(restriction)
        ? filtered.filter((r) => r !== restriction)
        : [...filtered, restriction];
    });
  };

  const handleAutoAssign = () => {
    const result = autoAssignGuests(guests, tables, {
      balanceGuests,
      randomize,
    });
    setGuests(result.guests);
    setTables(result.tables);
    setMessage(result.message);
    setMessageType(result.success ? "success" : "error");
    setTimeout(() => {
      setMessage("");
      setMessageType(null);
    }, 4000);
  };

  const handleClearAssignments = () => {
    clearGuestAssignments();
    clearTableAssignments();
    setMessage("Assignments cleared");
    setMessageType("success");
    setTimeout(() => {
      setMessage("");
      setMessageType(null);
    }, 3000);
  };

  const assignedCount = guests.filter(
    (g) => g.assignedTableId !== null
  ).length;
  const filteredGuests = guests.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      {/* Left: Add guests + auto-assign */}
      <div className="lg:col-span-4 space-y-4 overflow-y-auto">
        {/* Bulk Add */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              Bulk Add
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Names (one per line)</Label>
              <textarea
                className="w-full min-h-[90px] px-3 py-2 mt-1 border rounded-md resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={"John Smith\nJane Doe\nBob Johnson"}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
            </div>
            <Button
              onClick={handleBulkAdd}
              className="w-full"
              size="sm"
              disabled={!bulkInput.trim()}
            >
              Add{" "}
              {bulkInput.split("\n").filter((n) => n.trim()).length} Guests
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed text-muted-foreground"
              onClick={() => {
                const SEED: [string, DietaryRestriction[]][] = [
                  ["Anna Karlsson", [DietaryRestriction.NONE]],
                  ["Björn Eriksson", [DietaryRestriction.NONE]],
                  ["Clara Nilsson", [DietaryRestriction.VEGETARIAN]],
                  ["David Lindgren", [DietaryRestriction.NONE]],
                  ["Emma Johansson", [DietaryRestriction.VEGAN]],
                  ["Fredrik Olsson", [DietaryRestriction.NONE]],
                  ["Gunilla Persson", [DietaryRestriction.LACTOSE_INTOLERANT]],
                  ["Henrik Svensson", [DietaryRestriction.NONE]],
                  ["Ida Bergström", [DietaryRestriction.PESCATARIAN]],
                  ["Johan Larsson", [DietaryRestriction.NONE]],
                  ["Karin Holmberg", [DietaryRestriction.VEGETARIAN]],
                  ["Lars Engström", [DietaryRestriction.NONE]],
                  ["Maria Sandberg", [DietaryRestriction.NONE]],
                  ["Nils Forsberg", [DietaryRestriction.LACTOSE_INTOLERANT]],
                  ["Olivia Sjöberg", [DietaryRestriction.NONE]],
                  ["Peter Wallin", [DietaryRestriction.NONE]],
                  ["Rosa Lindqvist", [DietaryRestriction.VEGAN]],
                  ["Stefan Nyström", [DietaryRestriction.NONE]],
                  ["Therese Åberg", [DietaryRestriction.VEGETARIAN]],
                  ["Ulf Dahlberg", [DietaryRestriction.NONE]],
                  ["Viktor Holm", [DietaryRestriction.PESCATARIAN]],
                  ["Wilma Ekström", [DietaryRestriction.NONE]],
                  ["Xavier Blom", [DietaryRestriction.NONE]],
                  ["Ylva Fransson", [DietaryRestriction.LACTOSE_INTOLERANT]],
                  ["Zara Nordström", [DietaryRestriction.NONE]],
                  ["Axel Björk", [DietaryRestriction.VEGETARIAN]],
                  ["Beatrice Lund", [DietaryRestriction.NONE]],
                  ["Carl Magnusson", [DietaryRestriction.NONE]],
                  ["Diana Hedberg", [DietaryRestriction.PESCATARIAN]],
                  ["Erik Sundström", [DietaryRestriction.NONE]],
                ];
                for (const [name, restrictions] of SEED) {
                  addGuest(name, restrictions);
                }
              }}
            >
              <Zap className="w-3 h-3 mr-1" /> Seed 30 guests (dev)
            </Button>
          </CardContent>
        </Card>

        {/* Individual Add */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4" />
              Add Individual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="Guest name"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSingleAdd()}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Dietary</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Object.entries(DIETARY_RESTRICTION_LABELS).map(
                  ([key, label]) => {
                    const r = key as DietaryRestriction;
                    const isSel =
                      r === DietaryRestriction.NONE
                        ? selectedRestrictions.length === 0
                        : selectedRestrictions.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRestriction(r)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          isSel
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
            <Button
              onClick={handleSingleAdd}
              className="w-full"
              size="sm"
              disabled={!singleName.trim()}
            >
              Add Guest
            </Button>
          </CardContent>
        </Card>

        {/* Auto-Assign */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shuffle className="w-4 h-4" />
              Auto-Assign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={balanceGuests}
                  onChange={(e) => setBalanceGuests(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                Balance evenly
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={randomize}
                  onChange={(e) => setRandomize(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                Randomize order
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAutoAssign}
                disabled={guests.length === 0 || tables.length === 0}
                size="sm"
                className="flex-1"
              >
                <Shuffle className="w-3 h-3 mr-1" /> Assign
              </Button>
              <Button
                onClick={handleClearAssignments}
                disabled={assignedCount === 0}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
            {message && (
              <div
                className={`flex items-center gap-1.5 p-2 rounded text-xs ${
                  messageType === "success"
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {messageType === "success" ? (
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                ) : (
                  <AlertCircle className="w-3 h-3 shrink-0" />
                )}
                {message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Guest List */}
      <div className="lg:col-span-8">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Guests ({guests.length})
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
                {guests.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Delete all ${guests.length} guests? This cannot be undone.`)) clearAllGuests();
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear all
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 space-y-2 pb-3">
            {guests.length > 5 && (
              <Input
                placeholder="Search guests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
            )}
            {filteredGuests.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">
                {guests.length === 0
                  ? "No guests yet. Add guests using the panel on the left."
                  : "No matching guests."}
              </p>
            ) : (
              <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                {filteredGuests.map((guest) => {
                  const table = guest.assignedTableId
                    ? tables.find((t) => t.id === guest.assignedTableId)
                    : null;
                  const hasRestrictions =
                    guest.dietaryRestrictions.length > 0 &&
                    !guest.dietaryRestrictions.includes(
                      DietaryRestriction.NONE
                    );
                  const isEditing = editingId === guest.id;

                  if (isEditing) {
                    return (
                      <div
                        key={guest.id}
                        className="p-3 border-2 border-primary/40 rounded-lg bg-primary/5 space-y-2"
                      >
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditing();
                              if (e.key === "Escape") cancelEditing();
                            }}
                            className="h-8 text-sm"
                            autoFocus
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Dietary restrictions</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {Object.entries(DIETARY_RESTRICTION_LABELS).map(
                              ([key, label]) => {
                                const r = key as DietaryRestriction;
                                const isSel =
                                  r === DietaryRestriction.NONE
                                    ? editRestrictions.length === 0
                                    : editRestrictions.includes(r);
                                return (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => toggleEditRestriction(r)}
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                      isSel
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={saveEditing}
                            disabled={!editName.trim()}
                            className="h-7 text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditing}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between p-2 border rounded hover:border-primary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {guest.name}
                          </span>
                          {table && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 shrink-0">
                              {table.name}
                              {guest.seatPosition !== null &&
                                ` #${guest.seatPosition + 1}`}
                            </span>
                          )}
                          {!table && guest.assignedTableId === null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                              Unassigned
                            </span>
                          )}
                        </div>
                        {hasRestrictions && (
                          <div className="flex gap-1 mt-0.5">
                            {guest.dietaryRestrictions
                              .filter(
                                (r) => r !== DietaryRestriction.NONE
                              )
                              .map((r) => (
                                <span
                                  key={r}
                                  className={cn(
                                    "inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium",
                                    dietaryBadge(r)
                                  )}
                                >
                                  {dietaryIcon(r)}
                                  {DIETARY_RESTRICTION_LABELS[r]}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 ml-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(guest)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit guest"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGuest(guest.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
