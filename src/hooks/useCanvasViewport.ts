import { useRef, useState, useCallback } from "react";
import type { Table, FloorLabel } from "@/lib/types";

export const DEFAULT_VB = { x: -100, y: -50, w: 1400, h: 950 };

export type ViewBox = typeof DEFAULT_VB;

export function useCanvasViewport(tables: Table[], labels: FloorLabel[]) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState(DEFAULT_VB);

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

  const clientToSVG = useCallback(
    (cx: number, cy: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: vb.x + ((cx - rect.left) / rect.width) * vb.w,
        y: vb.y + ((cy - rect.top) / rect.height) * vb.h,
      };
    },
    [vb.x, vb.y, vb.w, vb.h]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
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
    },
    []
  );

  const fitToContent = useCallback(() => {
    const allPositions: { x: number; y: number }[] = [
      ...tables.map((t) => t.position),
      ...labels.map((l) => l.position),
    ];
    if (allPositions.length === 0) {
      setVb(DEFAULT_VB);
      return;
    }
    const ELEMENT_PAD = 200;
    const minX = Math.min(...allPositions.map((p) => p.x)) - ELEMENT_PAD;
    const maxX = Math.max(...allPositions.map((p) => p.x)) + ELEMENT_PAD;
    const minY = Math.min(...allPositions.map((p) => p.y)) - ELEMENT_PAD;
    const maxY = Math.max(...allPositions.map((p) => p.y)) + ELEMENT_PAD;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      let w = contentW;
      let h = contentH;
      if (w / h > aspect) {
        h = w / aspect;
      } else {
        w = h * aspect;
      }
      setVb({ x: minX - (w - contentW) / 2, y: minY - (h - contentH) / 2, w, h });
    } else {
      setVb({ x: minX, y: minY, w: contentW, h: contentH });
    }
  }, [tables, labels]);

  const zoomIn = useCallback(() => {
    setVb((p) => ({
      x: p.x + p.w * 0.05,
      y: p.y + p.h * 0.05,
      w: p.w * 0.9,
      h: p.h * 0.9,
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setVb((p) => ({
      x: p.x - p.w * 0.05,
      y: p.y - p.h * 0.05,
      w: p.w * 1.1,
      h: p.h * 1.1,
    }));
  }, []);

  const resetView = useCallback(() => setVb(DEFAULT_VB), []);

  return {
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
  };
}
