import { useRef, useState, useMemo } from "react";
import type { Table, Guest, FloorLabel, SelectedItem } from "@/lib/types";
import { TableRenderer } from "./TableRenderer";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { useCanvasDrag } from "@/hooks/useCanvasDrag";
import { useCanvasSelection } from "@/hooks/useCanvasSelection";

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
  readOnly?: boolean;
}

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
  readOnly = false,
}: Props) {
  const {
    svgRef,
    vb,
    setVb,
    clientToSVG,
    clientToSVGDelta,
    handleWheel,
    fitToContent,
    zoomIn,
    zoomOut,
    resetView,
  } = useCanvasViewport(tables, labels);

  const dragHandlers = useMemo(
    () => ({ onTableMove, onTablesMoveMulti, onLabelMove, onItemSelect }),
    [onTableMove, onTablesMoveMulti, onLabelMove, onItemSelect]
  );

  const {
    dragRef,
    dragOffset,
    snapGuides,
    handleTableMouseDown,
    handleLabelMouseDown,
    handleDragMove,
    handleDragEnd,
  } = useCanvasDrag(tables, labels, selectedItem, readOnly, clientToSVGDelta, vb.w, dragHandlers);

  const {
    boxSelect,
    isBoxSelecting,
    startBoxSelect,
    moveBoxSelect,
    endBoxSelect,
  } = useCanvasSelection(
    tables,
    selectedItem,
    readOnly,
    clientToSVG,
    onItemSelect,
    onDeleteSelected,
    onCopySelected,
    onPasteSelected
  );

  const panRef = useRef<{
    startClient: { x: number; y: number };
    startVB: typeof vb;
  } | null>(null);
  const [, forceRender] = useState(0);

  const guestMap = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests]
  );

  const selectedTableIds = selectedItem?.type === "table" ? selectedItem.ids : [];
  const selectedLabelId = selectedItem?.type === "label" ? selectedItem.id : null;

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !dragRef.current) {
      if (e.shiftKey && !readOnly) {
        startBoxSelect(e);
      } else {
        panRef.current = {
          startClient: { x: e.clientX, y: e.clientY },
          startVB: { ...vb },
        };
        onItemSelect(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (handleDragMove(e)) return;
    if (moveBoxSelect(e)) return;
    if (panRef.current) {
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
    handleDragEnd();
    if (isBoxSelecting) endBoxSelect();
    panRef.current = null;
    forceRender((n) => n + 1);
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button onClick={zoomIn} className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50">+</button>
        <button onClick={zoomOut} className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50">−</button>
        <button onClick={fitToContent} className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50">Fit</button>
        <button onClick={resetView} className="px-2 py-1 bg-white border rounded text-xs shadow-sm hover:bg-gray-50">Reset</button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full bg-[#fafafa] rounded-lg border"
        style={{ height: "100%" }}
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
          const isSel = selectedLabelId === label.id;
          const off = dragOffset?.id === label.id ? dragOffset : null;
          const lx = label.position.x + (off?.dx ?? 0);
          const ly = label.position.y + (off?.dy ?? 0);
          return (
            <g
              key={label.id}
              transform={`translate(${lx},${ly}) rotate(${label.rotation})`}
              onMouseDown={(e) => handleLabelMouseDown(e, label.id)}
              style={{ cursor: off ? "grabbing" : "grab" }}
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
              style={{ cursor: off ? "grabbing" : "grab" }}
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

        {boxSelect && (
          <rect
            x={Math.min(boxSelect.x1, boxSelect.x2)}
            y={Math.min(boxSelect.y1, boxSelect.y2)}
            width={Math.abs(boxSelect.x2 - boxSelect.x1)}
            height={Math.abs(boxSelect.y2 - boxSelect.y1)}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="6 3"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}
