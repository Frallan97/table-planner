import { useRef, useState, useCallback } from "react";
import type { Table, FloorLabel, SelectedItem } from "@/lib/types";

export interface DragOffset {
  id: string;
  multi: boolean;
  dx: number;
  dy: number;
}

export interface DragState {
  kind: "table" | "label";
  id: string;
  multi: boolean;
  startClient: { x: number; y: number };
  startPos: { x: number; y: number };
}

interface DragHandlers {
  onTableMove: (id: string, pos: { x: number; y: number }) => void;
  onTablesMoveMulti: (moves: { id: string; pos: { x: number; y: number } }[]) => void;
  onLabelMove: (id: string, pos: { x: number; y: number }) => void;
  onItemSelect: (item: SelectedItem) => void;
}

export function useCanvasDrag(
  tables: Table[],
  labels: FloorLabel[],
  selectedItem: SelectedItem,
  readOnly: boolean,
  clientToSVGDelta: (dx: number, dy: number) => { dx: number; dy: number },
  vbW: number,
  handlers: DragHandlers
) {
  const dragRef = useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState<DragOffset | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ axis: "x" | "y"; value: number }[]>([]);

  const selectedTableIds = selectedItem?.type === "table" ? selectedItem.ids : [];

  const handleTableMouseDown = useCallback(
    (e: React.MouseEvent, tableId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const table = tables.find((t) => t.id === tableId);
      if (!table) return;

      if (readOnly) {
        handlers.onItemSelect({ type: "table", ids: [tableId] });
        return;
      }

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
        handlers.onItemSelect(next.length > 0 ? { type: "table", ids: next } : null);
      } else if (!isInSelection) {
        handlers.onItemSelect({ type: "table", ids: [tableId] });
      }
    },
    [tables, readOnly, selectedItem, selectedTableIds, handlers]
  );

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent, labelId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (readOnly) return;
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
      handlers.onItemSelect({ type: "label", id: labelId });
    },
    [labels, readOnly, handlers]
  );

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return false;

      const d = clientToSVGDelta(
        e.clientX - drag.startClient.x,
        e.clientY - drag.startClient.y
      );
      let dx = d.dx;
      let dy = d.dy;
      const guides: { axis: "x" | "y"; value: number }[] = [];

      if (!drag.multi) {
        const SNAP = 8 * (vbW / 1400);
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
      return true;
    },
    [tables, labels, clientToSVGDelta, vbW]
  );

  const handleDragEnd = useCallback(() => {
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
        handlers.onTablesMoveMulti(moves);
      } else if (drag.kind === "table") {
        handlers.onTableMove(drag.id, {
          x: Math.round(drag.startPos.x + dragOffset.dx),
          y: Math.round(drag.startPos.y + dragOffset.dy),
        });
      } else {
        handlers.onLabelMove(drag.id, {
          x: Math.round(drag.startPos.x + dragOffset.dx),
          y: Math.round(drag.startPos.y + dragOffset.dy),
        });
      }
    }
    dragRef.current = null;
    setDragOffset(null);
    setSnapGuides([]);
  }, [tables, selectedTableIds, dragOffset, handlers]);

  return {
    dragRef,
    dragOffset,
    snapGuides,
    handleTableMouseDown,
    handleLabelMouseDown,
    handleDragMove,
    handleDragEnd,
  };
}
