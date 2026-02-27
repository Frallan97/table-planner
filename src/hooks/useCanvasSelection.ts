import { useRef, useState, useEffect, useCallback } from "react";
import type { Table, SelectedItem } from "@/lib/types";

export function useCanvasSelection(
  tables: Table[],
  selectedItem: SelectedItem,
  readOnly: boolean,
  clientToSVG: (cx: number, cy: number) => { x: number; y: number },
  onItemSelect: (item: SelectedItem) => void,
  onDeleteSelected?: () => void,
  onCopySelected?: () => void,
  onPasteSelected?: () => void
) {
  const [boxSelect, setBoxSelect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const boxSelectRef = useRef<{ x1: number; y1: number } | null>(null);

  const startBoxSelect = useCallback(
    (e: React.MouseEvent) => {
      const pt = clientToSVG(e.clientX, e.clientY);
      boxSelectRef.current = { x1: pt.x, y1: pt.y };
      setBoxSelect({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    },
    [clientToSVG]
  );

  const moveBoxSelect = useCallback(
    (e: React.MouseEvent) => {
      if (!boxSelectRef.current) return false;
      const pt = clientToSVG(e.clientX, e.clientY);
      setBoxSelect({
        x1: boxSelectRef.current.x1,
        y1: boxSelectRef.current.y1,
        x2: pt.x,
        y2: pt.y,
      });
      return true;
    },
    [clientToSVG]
  );

  const endBoxSelect = useCallback(() => {
    if (!boxSelectRef.current || !boxSelect) return;
    const minX = Math.min(boxSelect.x1, boxSelect.x2);
    const maxX = Math.max(boxSelect.x1, boxSelect.x2);
    const minY = Math.min(boxSelect.y1, boxSelect.y2);
    const maxY = Math.max(boxSelect.y1, boxSelect.y2);
    const ids = tables
      .filter(
        (t) =>
          t.position.x >= minX &&
          t.position.x <= maxX &&
          t.position.y >= minY &&
          t.position.y <= maxY
      )
      .map((t) => t.id);
    if (ids.length > 0) {
      onItemSelect({ type: "table", ids });
    } else {
      onItemSelect(null);
    }
    boxSelectRef.current = null;
    setBoxSelect(null);
  }, [tables, boxSelect, onItemSelect]);

  const isBoxSelecting = boxSelectRef.current !== null;

  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        onItemSelect(null);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedItem &&
        onDeleteSelected
      ) {
        e.preventDefault();
        onDeleteSelected();
      } else if (mod && e.key === "c" && onCopySelected) {
        e.preventDefault();
        onCopySelected();
      } else if (mod && e.key === "v" && onPasteSelected) {
        e.preventDefault();
        onPasteSelected();
      } else if (mod && e.key === "a" && tables.length > 0) {
        e.preventDefault();
        onItemSelect({ type: "table", ids: tables.map((t) => t.id) });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, selectedItem, onItemSelect, onDeleteSelected, onCopySelected, onPasteSelected, tables]);

  return {
    boxSelect,
    isBoxSelecting,
    startBoxSelect,
    moveBoxSelect,
    endBoxSelect,
  };
}
