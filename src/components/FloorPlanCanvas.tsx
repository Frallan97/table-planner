import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import type { Table, Guest, FloorLabel, SelectedItem } from "@/lib/types";
import { TableRenderer } from "./TableRenderer";

interface Props {
  tables: Table[];
  guests: Guest[];
  labels: FloorLabel[];
  selectedItem: SelectedItem;
  selectedSeat: { tableId: string; position: number } | null;
  onItemSelect: (item: SelectedItem) => void;
  onTableMove: (id: string, pos: { x: number; y: number }) => void;
  onTablesMoveMulti: (moves: { id: string; pos: { x: number; y: number } }[]) => void;
  onLabelMove: (id: string, pos: { x: number; y: number }) => void;
  onSeatClick: (tableId: string, position: number) => void;
  onDeleteSelected?: () => void;
  onCopySelected?: () => void;
  onPasteSelected?: () => void;
}

const DEFAULT_VB = { x: -100, y: -50, w: 1400, h: 950 };

export function FloorPlanCanvas({
  tables,
  guests,
  labels,
  selectedItem,
  selectedSeat,
  onItemSelect,
  onTableMove,
  onTablesMoveMulti,
  onLabelMove,
  onSeatClick,
  onDeleteSelected,
  onCopySelected,
  onPasteSelected,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState(DEFAULT_VB);

  const dragRef = useRef<{
    kind: "table" | "label";
    id: string;
    multi: boolean;
    startClient: { x: number; y: number };
    startPos: { x: number; y: number };
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{
    id: string;
    multi: boolean;
    dx: number;
    dy: number;
  } | null>(null);

  const panRef = useRef<{
    startClient: { x: number; y: number };
    startVB: typeof DEFAULT_VB;
  } | null>(null);
  const [, forceRender] = useState(0);
  const [snapGuides, setSnapGuides] = useState<{ axis: "x" | "y"; value: number }[]>([]);

  const guestMap = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests]
  );

  const clientToSVGDelta = useCallback(
    (dx: number, dy: number) => {
      const svg = svgRef.current;
      if (!svg) return { dx: 0, dy: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        dx: (dx / rect.width) * vb.w,
        dy: (dy / rect.height) * vb.h,
      };
    },
    [vb.w, vb.h]
  );

  const selectedTableIds = selectedItem?.type === "table" ? selectedItem.ids : [];

  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const isInSelection = selectedTableIds.includes(tableId);
    const isMulti = isInSelection && selectedTableIds.length > 1 && !e.shiftKey;

    dragRef.current = {
      kind: "table",
      id: tableId,
      multi: isMulti,
      startClient: { x: e.clientX, y: e.clientY },
      startPos: { ...table.position },
    };
    setDragOffset({ id: tableId, multi: isMulti, dx: 0, dy: 0 });

    if (e.shiftKey && selectedItem?.type === "table") {
      const prev = selectedItem.ids;
      const next = prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId];
      onItemSelect(next.length > 0 ? { type: "table", ids: next } : null);
    } else if (!isInSelection) {
      onItemSelect({ type: "table", ids: [tableId] });
    }
  };

  const handleLabelMouseDown = (e: React.MouseEvent, labelId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const label = labels.find((l) => l.id === labelId);
    if (!label) return;
    dragRef.current = {
      kind: "label",
      id: labelId,
      multi: false,
      startClient: { x: e.clientX, y: e.clientY },
      startPos: { ...label.position },
    };
    setDragOffset({ id: labelId, multi: false, dx: 0, dy: 0 });
    onItemSelect({ type: "label", id: labelId });
  };

  const handleLabelSelect = selectedItem?.type === "label" ? selectedItem.id : null;

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !dragRef.current) {
      panRef.current = {
        startClient: { x: e.clientX, y: e.clientY },
        startVB: { ...vb },
      };
      onItemSelect(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (drag) {
      const d = clientToSVGDelta(
        e.clientX - drag.startClient.x,
        e.clientY - drag.startClient.y
      );
      let dx = d.dx;
      let dy = d.dy;
      const guides: { axis: "x" | "y"; value: number }[] = [];

      if (!drag.multi) {
        const SNAP = 8 * (vb.w / 1400);
        const tentX = drag.startPos.x + dx;
        const tentY = drag.startPos.y + dy;

        const otherPositions: { x: number; y: number }[] = [];
        for (const t of tables) {
          if (t.id !== drag.id) otherPositions.push(t.position);
        }
        if (drag.kind === "label") {
          for (const t of tables) otherPositions.push(t.position);
        } else {
          for (const l of labels) otherPositions.push(l.position);
        }

        let snappedX = false;
        let snappedY = false;
        for (const pos of otherPositions) {
          if (!snappedX && Math.abs(tentX - pos.x) < SNAP) {
            dx = pos.x - drag.startPos.x;
            guides.push({ axis: "x", value: pos.x });
            snappedX = true;
          }
          if (!snappedY && Math.abs(tentY - pos.y) < SNAP) {
            dy = pos.y - drag.startPos.y;
            guides.push({ axis: "y", value: pos.y });
            snappedY = true;
          }
          if (snappedX && snappedY) break;
        }
      }

      setSnapGuides(guides);
      setDragOffset({ id: drag.id, multi: drag.multi, dx, dy });
    } else if (panRef.current) {
      const p = panRef.current;
      const d = clientToSVGDelta(
        e.clientX - p.startClient.x,
        e.clientY - p.startClient.y
      );
      setVb({
        ...p.startVB,
        x: p.startVB.x - d.dx,
        y: p.startVB.y - d.dy,
      });
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    if (drag && dragOffset) {
      if (drag.kind === "table" && drag.multi) {
        const moves = selectedTableIds.map((id) => {
          const t = tables.find((tbl) => tbl.id === id);
          return {
            id,
            pos: {
              x: Math.round((t?.position.x ?? 0) + dragOffset.dx),
              y: Math.round((t?.position.y ?? 0) + dragOffset.dy),
            },
          };
        });
        onTablesMoveMulti(moves);
      } else if (drag.kind === "table") {
        onTableMove(drag.id, {
          x: Math.round(drag.startPos.x + dragOffset.dx),
          y: Math.round(drag.startPos.y + dragOffset.dy),
        });
      } else {
        onLabelMove(drag.id, {
          x: Math.round(drag.startPos.x + dragOffset.dx),
          y: Math.round(drag.startPos.y + dragOffset.dy),
        });
      }
    }
    dragRef.current = null;
    panRef.current = null;
    setDragOffset(null);
    setSnapGuides([]);
    forceRender((n) => n + 1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width);
    const my = ((e.clientY - rect.top) / rect.height);
    setVb((prev) => {
      const svgX = prev.x + mx * prev.w;
      const svgY = prev.y + my * prev.h;
      return {
        x: svgX - (svgX - prev.x) * factor,
        y: svgY - (svgY - prev.y) * factor,
        w: prev.w * factor,
        h: prev.h * factor,
      };
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        onItemSelect(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedItem && onDeleteSelected) {
        e.preventDefault();
        onDeleteSelected();
      } else if (mod && e.key === "c" && onCopySelected) {
        e.preventDefault();
        onCopySelected();
      } else if (mod && e.key === "v" && onPasteSelected) {
        e.preventDefault();
        onPasteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, onItemSelect, onDeleteSelected, onCopySelected, onPasteSelected]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() =>
            setVb((p) => ({
              x: p.x + p.w * 0.05,
              y: p.y + p.h * 0.05,
              w: p.w * 0.9,
              h: p.h * 0.9,
            }))
          }
          className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50"
        >
          +
        </button>
        <button
          onClick={() =>
            setVb((p) => ({
              x: p.x - p.w * 0.05,
              y: p.y - p.h * 0.05,
              w: p.w * 1.1,
              h: p.h * 1.1,
            }))
          }
          className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50"
        >
          −
        </button>
        <button
          onClick={() => setVb(DEFAULT_VB)}
          className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50"
        >
          Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full bg-[#fafafa] rounded-lg border"
        style={{ height: "100%", minHeight: "500px" }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.8" fill="#ddd" />
          </pattern>
        </defs>
        <rect
          x={vb.x - 200}
          y={vb.y - 200}
          width={vb.w + 400}
          height={vb.h + 400}
          fill="url(#dots)"
        />

        {/* Labels (rendered below tables) */}
        {labels.map((label) => {
          const isSel = handleLabelSelect === label.id;
          const off = dragOffset?.id === label.id ? dragOffset : null;
          const lx = label.position.x + (off?.dx ?? 0);
          const ly = label.position.y + (off?.dy ?? 0);
          return (
            <g
              key={label.id}
              transform={`translate(${lx},${ly}) rotate(${label.rotation})`}
              onMouseDown={(e) => handleLabelMouseDown(e, label.id)}
              style={{
                cursor: off ? "grabbing" : "grab",
              }}
            >
              {isSel && (
                <rect
                  x={-label.width / 2 - 6}
                  y={-label.height / 2 - 6}
                  width={label.width + 12}
                  height={label.height + 12}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                  rx="4"
                />
              )}
              <rect
                x={-label.width / 2}
                y={-label.height / 2}
                width={label.width}
                height={label.height}
                fill="white"
                stroke="#aaa"
                strokeWidth="1"
                rx="3"
              />
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={label.fontSize}
                fill="#333"
                fontWeight="500"
              >
                {label.text}
              </text>
            </g>
          );
        })}

        {/* Tables */}
        {tables.map((table) => {
          const isDirectDrag = dragOffset?.id === table.id;
          const isMultiDrag = dragOffset?.multi && selectedTableIds.includes(table.id);
          const off = isDirectDrag || isMultiDrag ? dragOffset : null;
          const tx = table.position.x + (off?.dx ?? 0);
          const ty = table.position.y + (off?.dy ?? 0);
          return (
          <g
            key={table.id}
            transform={`translate(${tx},${ty}) rotate(${table.rotation})`}
            onMouseDown={(e) => handleTableMouseDown(e, table.id)}
            style={{
              cursor: off ? "grabbing" : "grab",
            }}
          >
            <TableRenderer
              table={table}
              guestMap={guestMap}
              selectedSeat={selectedSeat}
              onSeatClick={onSeatClick}
              isSelected={selectedTableIds.includes(table.id)}
            />
          </g>
          );
        })}

        {tables.length === 0 && labels.length === 0 && (
          <text
            x={vb.x + vb.w / 2}
            y={vb.y + vb.h / 2}
            textAnchor="middle"
            fill="#bbb"
            fontSize="16"
          >
            Add tables using the panel on the left
          </text>
        )}

        {snapGuides.map((g, i) =>
          g.axis === "x" ? (
            <line
              key={i}
              x1={g.value}
              y1={vb.y - 200}
              x2={g.value}
              y2={vb.y + vb.h + 200}
              stroke="#3b82f6"
              strokeWidth="0.8"
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          ) : (
            <line
              key={i}
              x1={vb.x - 200}
              y1={g.value}
              x2={vb.x + vb.w + 200}
              y2={g.value}
              stroke="#3b82f6"
              strokeWidth="0.8"
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )
        )}
      </svg>
    </div>
  );
}
