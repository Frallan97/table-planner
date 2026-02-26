import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlannerGuests as useGuests, usePlannerTables as useTables, usePlannerLabels as useLabels } from "@/hooks/PlannerContext";
import { DietaryRestriction, DIETARY_RESTRICTION_LABELS } from "@/lib/types";
import type { Table, Guest, FloorLabel } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Printer, MapPin, ShieldAlert, BookA } from "lucide-react";
import { TableRenderer } from "./TableRenderer";

type Format = "floor-plan" | "allergy-map" | "alpha-lookup";

export function PrintView() {
  const { guests } = useGuests();
  const { tables } = useTables();
  const { labels } = useLabels();
  const [format, setFormat] = useState<Format>("floor-plan");
  const printRef = useRef<HTMLDivElement>(null);

  const [lookupFontSize, setLookupFontSize] = useState(12);
  const [lookupColumns, setLookupColumns] = useState(1);
  const [floorPlanPages, setFloorPlanPages] = useState<1 | 2 | 4>(1);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Table Planner — Print</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0; color: #111; }
        @page { margin: 0; }
        @media print { body { padding: 0; } }
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
            {format === "floor-plan" && (
              <div className="border-t pt-3 mt-2 space-y-3">
                <div>
                  <Label className="text-xs">Pages</Label>
                  <div className="flex gap-1 mt-1">
                    {([1, 2, 4] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setFloorPlanPages(p)}
                        className={`flex-1 text-xs py-1.5 rounded border font-medium transition-colors ${
                          floorPlanPages === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-muted hover:bg-muted"
                        }`}
                      >
                        {p === 1 ? "1 page" : p === 2 ? "2 pages" : "4 pages"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {floorPlanPages === 1 && "Entire floor plan on one page"}
                    {floorPlanPages === 2 && "Split left/right across 2 pages"}
                    {floorPlanPages === 4 && "Split into 4 quadrants"}
                  </p>
                </div>
              </div>
            )}
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
              {format === "floor-plan" && (
                <FloorPlanPrint tables={tables} guests={guests} labels={labels} pages={floorPlanPages} />
              )}
              {format === "allergy-map" && (
                <AllergyMap tables={tables} guests={guests} labels={labels} />
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
};

const ALLERGY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  [DietaryRestriction.VEGETARIAN]: { bg: "#dcfce7", text: "#166534", border: "#22c55e" },
  [DietaryRestriction.VEGAN]: { bg: "#bbf7d0", text: "#14532d", border: "#16a34a" },
  [DietaryRestriction.PESCATARIAN]: { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  [DietaryRestriction.LACTOSE_INTOLERANT]: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
};

function AllergyMap({ tables, guests, labels }: { tables: Table[]; guests: Guest[]; labels: FloorLabel[] }) {
  const allergicGuests = useMemo(
    () => guests.filter((g) => g.dietaryRestrictions?.length > 0 && !g.dietaryRestrictions.includes(DietaryRestriction.NONE)),
    [guests]
  );

  const allergyGuestMap = useMemo(
    () => new Map(allergicGuests.map((g) => [g.id, g])),
    [allergicGuests]
  );

  const seatColorOverride = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of allergicGuests) {
      const restrictions = g.dietaryRestrictions.filter((r) => r !== DietaryRestriction.NONE);
      if (restrictions.length > 0) {
        map.set(g.id, ALLERGY_COLORS[restrictions[0]]?.border ?? "#999");
      }
    }
    return map;
  }, [allergicGuests]);

  const activeRestrictions = useMemo(() => {
    const set = new Set<DietaryRestriction>();
    for (const g of allergicGuests) {
      for (const r of g.dietaryRestrictions) {
        if (r !== DietaryRestriction.NONE) set.add(r);
      }
    }
    return [...set].sort();
  }, [allergicGuests]);

  const noopSeatClick = () => {};

  if (tables.length === 0)
    return <p style={{ color: "#999" }}>No tables configured.</p>;

  if (allergicGuests.length === 0)
    return (
      <div>
        <h1 style={S.h1}>Allergy Map</h1>
        <p style={{ color: "#999", fontSize: 13 }}>No guests have dietary restrictions set.</p>
      </div>
    );

  const PAD = 350;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    minX = Math.min(minX, t.position.x - PAD);
    minY = Math.min(minY, t.position.y - PAD);
    maxX = Math.max(maxX, t.position.x + PAD);
    maxY = Math.max(maxY, t.position.y + PAD);
  }
  for (const l of labels) {
    minX = Math.min(minX, l.position.x - l.width - 50);
    minY = Math.min(minY, l.position.y - l.height - 50);
    maxX = Math.max(maxX, l.position.x + l.width + 50);
    maxY = Math.max(maxY, l.position.y + l.height + 50);
  }
  const totalW = maxX - minX;
  const totalH = maxY - minY;

  return (
    <div>
      <h1 style={S.h1}>Allergy Map</h1>
      <div style={S.summary}>
        {allergicGuests.length} guest{allergicGuests.length !== 1 ? "s" : ""} with dietary restrictions · {tables.length} tables
      </div>

      {activeRestrictions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            padding: "10px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            backgroundColor: "#fafafa",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555", marginRight: 4 }}>Legend:</span>
          {activeRestrictions.map((r) => {
            const c = ALLERGY_COLORS[r];
            return (
              <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  backgroundColor: c?.bg ?? "#eee",
                  border: `3px solid ${c?.border ?? "#ccc"}`,
                  display: "inline-block",
                }} />
                {DIETARY_RESTRICTION_LABELS[r]}
              </span>
            );
          })}
        </div>
      )}

      <svg
        viewBox={`${minX} ${minY} ${totalW} ${totalH}`}
        overflow="visible"
        style={{ width: "100%", height: "auto", aspectRatio: `${totalW} / ${totalH}` }}
      >
        {labels.map((l) => (
          <g key={l.id} transform={`translate(${l.position.x},${l.position.y}) rotate(${l.rotation})`}>
            <rect x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} fill="white" stroke="#aaa" strokeWidth="1" rx="3" />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={l.fontSize} fill="#333" fontWeight="500">{l.text}</text>
          </g>
        ))}
        {tables.map((table) => (
          <g key={table.id} transform={`translate(${table.position.x},${table.position.y}) rotate(${table.rotation})`}>
            <TableRenderer
              table={table}
              guestMap={allergyGuestMap}
              selectedSeat={null}
              onSeatClick={noopSeatClick}
              isSelected={false}
              seatColorOverride={seatColorOverride}
            />
          </g>
        ))}
      </svg>
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

function FloorPlanPrint({
  tables,
  guests,
  labels,
  pages,
}: {
  tables: Table[];
  guests: Guest[];
  labels: FloorLabel[];
  pages: 1 | 2 | 4;
}) {
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const noopSeatClick = () => {};

  if (tables.length === 0 && labels.length === 0)
    return <p style={{ color: "#999" }}>No floor plan elements.</p>;

  const PAD = 350;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    minX = Math.min(minX, t.position.x - PAD);
    minY = Math.min(minY, t.position.y - PAD);
    maxX = Math.max(maxX, t.position.x + PAD);
    maxY = Math.max(maxY, t.position.y + PAD);
  }
  for (const l of labels) {
    minX = Math.min(minX, l.position.x - l.width - 50);
    minY = Math.min(minY, l.position.y - l.height - 50);
    maxX = Math.max(maxX, l.position.x + l.width + 50);
    maxY = Math.max(maxY, l.position.y + l.height + 50);
  }

  const totalW = maxX - minX;
  const totalH = maxY - minY;

  const slices: { vbX: number; vbY: number; vbW: number; vbH: number; label: string }[] = [];
  if (pages === 1) {
    slices.push({ vbX: minX, vbY: minY, vbW: totalW, vbH: totalH, label: "" });
  } else if (pages === 2) {
    const halfW = totalW / 2;
    slices.push({ vbX: minX, vbY: minY, vbW: halfW, vbH: totalH, label: "Left half" });
    slices.push({ vbX: minX + halfW, vbY: minY, vbW: halfW, vbH: totalH, label: "Right half" });
  } else {
    const halfW = totalW / 2;
    const halfH = totalH / 2;
    slices.push({ vbX: minX, vbY: minY, vbW: halfW, vbH: halfH, label: "Top-left" });
    slices.push({ vbX: minX + halfW, vbY: minY, vbW: halfW, vbH: halfH, label: "Top-right" });
    slices.push({ vbX: minX, vbY: minY + halfH, vbW: halfW, vbH: halfH, label: "Bottom-left" });
    slices.push({ vbX: minX + halfW, vbY: minY + halfH, vbW: halfW, vbH: halfH, label: "Bottom-right" });
  }

  const renderSVGContent = () => (
    <>
      {labels.map((l) => (
        <g key={l.id} transform={`translate(${l.position.x},${l.position.y}) rotate(${l.rotation})`}>
          <rect x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} fill="white" stroke="#aaa" strokeWidth="1" rx="3" />
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={l.fontSize} fill="#333" fontWeight="500">{l.text}</text>
        </g>
      ))}
      {tables.map((table) => (
        <g key={table.id} transform={`translate(${table.position.x},${table.position.y}) rotate(${table.rotation})`}>
          <TableRenderer
            table={table}
            guestMap={guestMap}
            selectedSeat={null}
            onSeatClick={noopSeatClick}
            isSelected={false}
          />
        </g>
      ))}
    </>
  );

  return (
    <div>
      {slices.map((slice, i) => (
        <div
          key={i}
          style={{
            pageBreakAfter: i < slices.length - 1 ? "always" : undefined,
            marginBottom: i < slices.length - 1 ? 24 : 0,
          }}
        >
          <svg
            viewBox={`${slice.vbX} ${slice.vbY} ${slice.vbW} ${slice.vbH}`}
            overflow="visible"
            style={{
              width: "100%",
              height: "auto",
              aspectRatio: `${slice.vbW} / ${slice.vbH}`,
            }}
          >
            {renderSVGContent()}
          </svg>
        </div>
      ))}
    </div>
  );
}
