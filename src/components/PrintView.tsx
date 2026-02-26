import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlannerGuests as useGuests, usePlannerTables as useTables, usePlannerLabels as useLabels } from "@/hooks/PlannerContext";
import { DietaryRestriction, DIETARY_RESTRICTION_LABELS } from "@/lib/types";
import type { Table, Guest, FloorLabel } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Printer, LayoutList, Users, CreditCard, MapPin, ShieldAlert, BookA } from "lucide-react";

type Format = "seating-chart" | "guest-list" | "table-cards" | "floor-plan" | "allergy-map" | "alpha-lookup";

export function PrintView() {
  const { guests } = useGuests();
  const { tables } = useTables();
  const { labels } = useLabels();
  const [format, setFormat] = useState<Format>("seating-chart");
  const printRef = useRef<HTMLDivElement>(null);

  const [lookupFontSize, setLookupFontSize] = useState(12);
  const [lookupColumns, setLookupColumns] = useState(1);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Table Planner — Print</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const sortedGuests = [...guests].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const assignedGuests = guests.filter((g) => g.assignedTableId !== null);

  const formats: { id: Format; label: string; icon: React.ReactNode }[] = [
    { id: "seating-chart", label: "Seating Chart", icon: <LayoutList className="w-4 h-4" /> },
    { id: "guest-list", label: "Guest List", icon: <Users className="w-4 h-4" /> },
    { id: "table-cards", label: "Place Cards", icon: <CreditCard className="w-4 h-4" /> },
    { id: "floor-plan", label: "Floor Plan", icon: <MapPin className="w-4 h-4" /> },
    { id: "allergy-map", label: "Allergy Map", icon: <ShieldAlert className="w-4 h-4" /> },
    { id: "alpha-lookup", label: "Name Lookup", icon: <BookA className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Printer className="w-4 h-4" />
              Print Format
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded text-sm text-left transition-colors ${
                  format === f.id
                    ? "bg-primary/10 border border-primary/30 font-medium"
                    : "bg-muted/30 border border-transparent hover:bg-muted/50"
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
            {format === "alpha-lookup" && (
              <div className="border-t pt-3 mt-2 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Font size</Label>
                    <span className="text-xs text-muted-foreground">{lookupFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="18"
                    step="1"
                    value={lookupFontSize}
                    onChange={(e) => setLookupFontSize(parseInt(e.target.value))}
                    className="w-full h-2 mt-1"
                  />
                  <div className="flex gap-1 mt-1">
                    {[9, 11, 12, 14, 16].map((s) => (
                      <button
                        key={s}
                        onClick={() => setLookupFontSize(s)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          lookupFontSize === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-muted hover:bg-muted"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Columns</Label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2].map((c) => (
                      <button
                        key={c}
                        onClick={() => setLookupColumns(c)}
                        className={`flex-1 text-xs py-1.5 rounded border font-medium transition-colors ${
                          lookupColumns === c
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-muted hover:bg-muted"
                        }`}
                      >
                        {c} column{c > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={handlePrint} className="w-full" size="sm">
                <Printer className="w-3 h-3 mr-1" /> Print
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {guests.length} guests, {tables.length} tables,{" "}
              {assignedGuests.length} assigned
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-9">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
            <div
              ref={printRef}
              className="bg-white rounded border p-6 min-h-[400px]"
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
            >
              {format === "seating-chart" && (
                <SeatingChart tables={tables} guests={guests} />
              )}
              {format === "guest-list" && (
                <GuestListPrint guests={sortedGuests} tables={tables} />
              )}
              {format === "table-cards" && (
                <PlaceCards guests={assignedGuests} tables={tables} />
              )}
              {format === "floor-plan" && (
                <FloorPlanPrint tables={tables} guests={guests} labels={labels} />
              )}
              {format === "allergy-map" && (
                <AllergyMap tables={tables} guests={guests} />
              )}
              {format === "alpha-lookup" && (
                <AlphaLookup
                  guests={sortedGuests}
                  tables={tables}
                  fontSize={lookupFontSize}
                  columns={lookupColumns}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const S = {
  h1: { fontSize: 20, marginBottom: 16, fontWeight: 700 } as const,
  summary: { fontSize: 12, color: "#666", marginBottom: 16 } as const,
  tableCard: {
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    breakInside: "avoid" as const,
  },
  h3: { fontSize: 14, marginBottom: 8, color: "#333", fontWeight: 600 } as const,
  seatRow: {
    display: "flex",
    gap: 4,
    fontSize: 12,
    padding: "3px 0",
    borderBottom: "1px solid #f0f0f0",
  } as const,
  seatNum: { width: 30, color: "#999" } as const,
  empty: { color: "#bbb", fontStyle: "italic" as const },
  guestRow: {
    display: "flex",
    justifyContent: "space-between" as const,
    fontSize: 13,
    padding: "4px 0",
    borderBottom: "1px solid #f0f0f0",
  } as const,
  placeCards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  } as const,
  placeCard: {
    border: "1.5px solid #aaa",
    borderRadius: 8,
    padding: "20px 16px",
    textAlign: "center" as const,
    breakInside: "avoid" as const,
  },
  placeName: { fontSize: 18, fontWeight: 600 } as const,
  placeInfo: { fontSize: 11, color: "#888", marginTop: 6 } as const,
};

function SeatingChart({ tables, guests }: { tables: Table[]; guests: Guest[] }) {
  const guestMap = new Map(guests.map((g) => [g.id, g]));
  return (
    <div>
      <h1 style={S.h1}>Seating Chart</h1>
      <div style={S.summary}>
        {guests.length} guests · {tables.length} tables
      </div>
      {tables.map((table) => (
        <div key={table.id} style={S.tableCard}>
          <h3 style={S.h3}>
            {table.name} — {table.assignedGuests.length}/{table.capacity} seats
          </h3>
          {table.seats.map((seat) => {
            const guest = seat.guestId ? guestMap.get(seat.guestId) : null;
            return (
              <div key={seat.position} style={S.seatRow}>
                <span style={S.seatNum}>{seat.position + 1}.</span>
                {guest ? (
                  <span>{guest.name}</span>
                ) : (
                  <span style={S.empty}>Empty</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {tables.length === 0 && <p style={{ color: "#999" }}>No tables configured.</p>}
    </div>
  );
}

function GuestListPrint({ guests, tables }: { guests: Guest[]; tables: Table[] }) {
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  return (
    <div>
      <h1 style={S.h1}>Guest List</h1>
      <div style={S.summary}>{guests.length} guests</div>
      {guests.map((g) => {
        const table = g.assignedTableId ? tableMap.get(g.assignedTableId) : null;
        return (
          <div key={g.id} style={S.guestRow}>
            <span>{g.name}</span>
            <span style={{ color: table ? "#333" : "#bbb" }}>
              {table
                ? `${table.name}${g.seatPosition !== null ? ` #${g.seatPosition + 1}` : ""}`
                : "Unassigned"}
            </span>
          </div>
        );
      })}
      {guests.length === 0 && <p style={{ color: "#999" }}>No guests added.</p>}
    </div>
  );
}

function PlaceCards({ guests, tables }: { guests: Guest[]; tables: Table[] }) {
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const sorted = [...guests].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <h1 style={S.h1}>Place Cards</h1>
      <div style={S.summary}>{sorted.length} cards</div>
      <div style={S.placeCards}>
        {sorted.map((g) => {
          const table = g.assignedTableId ? tableMap.get(g.assignedTableId) : null;
          return (
            <div key={g.id} style={S.placeCard}>
              <div style={S.placeName}>{g.name}</div>
              {table && (
                <div style={S.placeInfo}>
                  {table.name}
                  {g.seatPosition !== null && ` · Seat ${g.seatPosition + 1}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {sorted.length === 0 && <p style={{ color: "#999" }}>No assigned guests.</p>}
    </div>
  );
}

const ALLERGY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  [DietaryRestriction.VEGETARIAN]: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  [DietaryRestriction.VEGAN]: { bg: "#bbf7d0", text: "#14532d", border: "#4ade80" },
  [DietaryRestriction.PESCATARIAN]: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  [DietaryRestriction.LACTOSE_INTOLERANT]: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
};

function AllergyMap({ tables, guests }: { tables: Table[]; guests: Guest[] }) {
  const guestMap = new Map(guests.map((g) => [g.id, g]));

  const allergicGuests = guests.filter(
    (g) =>
      g.dietaryRestrictions?.length > 0 &&
      !g.dietaryRestrictions.includes(DietaryRestriction.NONE)
  );

  const activeRestrictions = new Set<DietaryRestriction>();
  for (const g of allergicGuests) {
    for (const r of g.dietaryRestrictions) {
      if (r !== DietaryRestriction.NONE) activeRestrictions.add(r);
    }
  }

  const legendItems = [...activeRestrictions].sort();

  return (
    <div>
      <h1 style={S.h1}>Allergy Map</h1>
      <div style={S.summary}>
        {allergicGuests.length} guest{allergicGuests.length !== 1 ? "s" : ""} with dietary restrictions ·{" "}
        {tables.length} tables
      </div>

      {/* Legend */}
      {legendItems.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            padding: "10px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            backgroundColor: "#fafafa",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555", marginRight: 4 }}>
            Legend:
          </span>
          {legendItems.map((r) => {
            const c = ALLERGY_COLORS[r];
            return (
              <span
                key={r}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: c?.bg ?? "#eee",
                    border: `2px solid ${c?.border ?? "#ccc"}`,
                    display: "inline-block",
                  }}
                />
                {DIETARY_RESTRICTION_LABELS[r]}
              </span>
            );
          })}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#999",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                display: "inline-block",
              }}
            />
            No restrictions
          </span>
        </div>
      )}

      {/* Tables */}
      {tables.map((table) => {
        const seatsWithAllergies = table.seats.filter((seat) => {
          if (!seat.guestId) return false;
          const g = guestMap.get(seat.guestId);
          return (
            g?.dietaryRestrictions?.length > 0 &&
            !g.dietaryRestrictions.includes(DietaryRestriction.NONE)
          );
        });
        return (
          <div key={table.id} style={S.tableCard}>
            <h3 style={S.h3}>
              {table.name}
              {seatsWithAllergies.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 400, color: "#d97706", marginLeft: 8 }}>
                  {seatsWithAllergies.length} allerg{seatsWithAllergies.length === 1 ? "y" : "ies"}
                </span>
              )}
            </h3>
            {table.seats.map((seat) => {
              const guest = seat.guestId ? guestMap.get(seat.guestId) : null;
              const restrictions =
                guest?.dietaryRestrictions?.filter(
                  (r: DietaryRestriction) => r !== DietaryRestriction.NONE
                ) ?? [];
              const hasAllergy = restrictions.length > 0;
              const primaryColor = hasAllergy
                ? ALLERGY_COLORS[restrictions[0]]
                : null;

              return (
                <div
                  key={seat.position}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    padding: "4px 6px",
                    marginBottom: 2,
                    borderRadius: 4,
                    backgroundColor: primaryColor?.bg ?? "transparent",
                    border: hasAllergy
                      ? `1.5px solid ${primaryColor?.border ?? "#ccc"}`
                      : "1px solid transparent",
                    borderBottom: hasAllergy ? undefined : "1px solid #f0f0f0",
                  }}
                >
                  <span style={{ width: 26, color: "#999", flexShrink: 0 }}>
                    {seat.position + 1}.
                  </span>
                  {guest ? (
                    <>
                      <span
                        style={{
                          flex: 1,
                          fontWeight: hasAllergy ? 600 : 400,
                          color: primaryColor?.text ?? "#333",
                        }}
                      >
                        {guest.name}
                      </span>
                      {restrictions.length > 0 && (
                        <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {restrictions.map((r: DietaryRestriction) => {
                            const c = ALLERGY_COLORS[r];
                            return (
                              <span
                                key={r}
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 10,
                                  backgroundColor: c?.border ?? "#ddd",
                                  color: c?.text ?? "#333",
                                  fontWeight: 600,
                                }}
                              >
                                {DIETARY_RESTRICTION_LABELS[r]}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={S.empty}>Empty</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {tables.length === 0 && (
        <p style={{ color: "#999" }}>No tables configured.</p>
      )}
      {tables.length > 0 && allergicGuests.length === 0 && (
        <p style={{ color: "#999", marginTop: 12, fontSize: 13 }}>
          No guests have dietary restrictions set.
        </p>
      )}
    </div>
  );
}

function AlphaLookup({
  guests,
  tables,
  fontSize,
  columns,
}: {
  guests: Guest[];
  tables: Table[];
  fontSize: number;
  columns: number;
}) {
  const tableMap = new Map(tables.map((t) => [t.id, t]));

  const grouped: Record<string, Guest[]> = {};
  for (const g of guests) {
    const letter = (g.name?.[0] ?? "?").toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(g);
  }
  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const tableFontSize = Math.max(fontSize - 2, 7);
  const headerSize = Math.max(fontSize + 1, 10);
  const pad = Math.max(Math.round(fontSize * 0.2), 1);

  return (
    <div>
      <h1 style={S.h1}>Name Lookup</h1>
      <div style={S.summary}>
        {guests.length} guest{guests.length !== 1 ? "s" : ""} · sorted by first name
      </div>
      <div
        style={{
          columnCount: columns,
          columnGap: 24,
          marginTop: 8,
        }}
      >
        {letters.map((letter) => (
          <div key={letter} style={{ marginBottom: 6, breakInside: "avoid" }}>
            <div
              style={{
                fontSize: headerSize,
                fontWeight: 700,
                color: "#333",
                borderBottom: "1.5px solid #d1d5db",
                paddingBottom: 2,
                marginBottom: 2,
              }}
            >
              {letter}
            </div>
            {grouped[letter].map((g) => {
              const table = g.assignedTableId ? tableMap.get(g.assignedTableId) : null;
              return (
                <div
                  key={g.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize,
                    padding: `${pad}px 4px`,
                    borderBottom: "1px solid #f0f0f0",
                    lineHeight: 1.3,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <span
                    style={{
                      fontSize: tableFontSize,
                      color: table ? "#555" : "#bbb",
                      fontStyle: table ? "normal" : "italic",
                      marginLeft: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {table
                      ? `${table.name}${g.seatPosition !== null ? ` #${g.seatPosition + 1}` : ""}`
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {guests.length === 0 && <p style={{ color: "#999" }}>No guests added.</p>}
    </div>
  );
}

function FloorPlanPrint({ tables, guests, labels }: { tables: Table[]; guests: Guest[]; labels: FloorLabel[] }) {
  if (tables.length === 0 && labels.length === 0)
    return <p style={{ color: "#999" }}>No floor plan elements.</p>;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    minX = Math.min(minX, t.position.x - 300);
    minY = Math.min(minY, t.position.y - 300);
    maxX = Math.max(maxX, t.position.x + 300);
    maxY = Math.max(maxY, t.position.y + 300);
  }
  for (const l of labels) {
    minX = Math.min(minX, l.position.x - l.width);
    minY = Math.min(minY, l.position.y - l.height);
    maxX = Math.max(maxX, l.position.x + l.width);
    maxY = Math.max(maxY, l.position.y + l.height);
  }

  return (
    <div>
      <h1 style={S.h1}>Floor Plan</h1>
      <div style={S.summary}>{tables.length} tables · {labels.length} labels</div>
      <svg
        viewBox={`${minX - 50} ${minY - 50} ${maxX - minX + 100} ${maxY - minY + 100}`}
        style={{ width: "100%", maxHeight: 600, border: "1px solid #eee", borderRadius: 4 }}
      >
        {labels.map((l) => (
          <g key={l.id} transform={`translate(${l.position.x},${l.position.y}) rotate(${l.rotation})`}>
            <rect x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} fill="white" stroke="#aaa" strokeWidth="1" rx="3" />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={l.fontSize} fill="#333" fontWeight="500">{l.text}</text>
          </g>
        ))}
        {tables.map((table) => (
          <g key={table.id} transform={`translate(${table.position.x},${table.position.y}) rotate(${table.rotation})`}>
            <rect x={-60} y={-20} width={120} height={40} fill="white" stroke="#bbb" strokeWidth="1" rx="3" />
            <text x={0} y={-3} textAnchor="middle" fontSize="11" fill="#333" fontWeight="500">{table.name}</text>
            <text x={0} y={10} textAnchor="middle" fontSize="9" fill="#999">{table.assignedGuests.length}/{table.capacity}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
