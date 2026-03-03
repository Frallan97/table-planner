import { useState, useEffect, useRef, useCallback } from "react";
import { api, type PublicFloorPlan } from "@/lib/api";
import { loadRuntimeConfig } from "@/lib/api";
import { TableRenderer } from "./TableRenderer";
import type { Table, Guest, FloorLabel } from "@/lib/types";
import { Loader2, MapPin, Users, LayoutGrid, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { computeFloorPlanBounds } from "@/lib/utils";

interface Props {
  token: string;
}

export function PublicFloorPlanView({ token }: Props) {
  const [data, setData] = useState<PublicFloorPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await loadRuntimeConfig();
      try {
        const fp = await api.getPublicFloorPlan(token);
        if (!cancelled) setData(fp);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load floor plan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Loading floor plan...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <MapPin className="w-12 h-12 text-muted-foreground" />
          <h1 className="text-xl sm:text-2xl font-bold">Floor Plan Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This share link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  const tables = data.tables as Table[];
  const guests = data.guests as Guest[];
  const labels = (data.labels ?? []) as FloorLabel[];

  const guestMap = new Map(guests.map((g) => [g.id, g]));
  const assignedCount = guests.filter((g) => g.assignedTableId !== null).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-3 py-3 sm:px-6 sm:py-4 max-w-[1400px] mx-auto">
        <div className="mb-3 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold truncate">{data.name}</h1>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <LayoutGrid className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {tables.length} table{tables.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {guests.length} guest{guests.length !== 1 ? "s" : ""} ({assignedCount} seated)
            </span>
          </div>
        </div>

        <PanZoomFloorPlan tables={tables} guests={guests} labels={labels} guestMap={guestMap} />
      </div>
    </div>
  );
}

// ─── Pan & Zoom floor plan (touch-friendly) ─────────────────────────

function PanZoomFloorPlan({
  tables,
  guests,
  labels,
  guestMap,
}: {
  tables: Table[];
  guests: Guest[];
  labels: FloorLabel[];
  guestMap: Map<string, Guest>;
}) {
  const noopSeatClick = () => {};
  const containerRef = useRef<HTMLDivElement>(null);

  if (tables.length === 0 && labels.length === 0) {
    return <p className="text-muted-foreground text-sm p-4">No floor plan elements.</p>;
  }

  const { minX, minY, width: fullW, height: fullH } = computeFloorPlanBounds(tables, labels);

  // View state: what portion of the SVG coordinate space is visible
  const [viewBox, setViewBox] = useState({ x: minX, y: minY, w: fullW, h: fullH });

  // Track pinch/pan gestures
  const gestureRef = useRef<{
    startViewBox: typeof viewBox;
    startTouches: { x: number; y: number }[];
    startDist: number;
    startCenter: { x: number; y: number };
  } | null>(null);

  // Mouse drag state
  const dragRef = useRef<{
    startViewBox: typeof viewBox;
    startMouse: { x: number; y: number };
  } | null>(null);

  const clampViewBox = useCallback((vb: typeof viewBox) => {
    // Minimum zoom: don't zoom out past full extent
    const w = Math.min(vb.w, fullW * 2);
    const h = Math.min(vb.h, fullH * 2);
    // Maximum zoom: don't zoom in past 10% of full extent
    const minDim = Math.max(fullW * 0.1, 100);
    const cw = Math.max(w, minDim);
    const ch = Math.max(h, minDim * (fullH / fullW));
    return { x: vb.x, y: vb.y, w: cw, h: ch };
  }, [fullW, fullH]);

  const resetView = useCallback(() => {
    setViewBox({ x: minX, y: minY, w: fullW, h: fullH });
  }, [minX, minY, fullW, fullH]);

  const zoom = useCallback((factor: number) => {
    setViewBox(prev => {
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      const nw = prev.w * factor;
      const nh = prev.h * factor;
      return clampViewBox({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
    });
  }, [clampViewBox]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      gestureRef.current = {
        startViewBox: { ...viewBox },
        startTouches: [
          { x: t0.clientX, y: t0.clientY },
          { x: t1.clientX, y: t1.clientY },
        ],
        startDist: Math.sqrt(dx * dx + dy * dy),
        startCenter: { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 },
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      gestureRef.current = {
        startViewBox: { ...viewBox },
        startTouches: [{ x: t.clientX, y: t.clientY }],
        startDist: 0,
        startCenter: { x: t.clientX, y: t.clientY },
      };
    }
  }, [viewBox]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    if (e.touches.length === 2 && g.startTouches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = g.startDist / dist;

      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      const panX = cx - g.startCenter.x;
      const panY = cy - g.startCenter.y;

      const svb = g.startViewBox;
      const nw = svb.w * scale;
      const nh = svb.h * scale;

      // Convert pixel pan to SVG units
      const pxToSvgX = svb.w / rect.width;
      const pxToSvgY = svb.h / rect.height;

      setViewBox(clampViewBox({
        x: svb.x + (svb.w - nw) / 2 - panX * pxToSvgX,
        y: svb.y + (svb.h - nh) / 2 - panY * pxToSvgY,
        w: nw,
        h: nh,
      }));
    } else if (e.touches.length === 1 && g.startTouches.length >= 1) {
      const t = e.touches[0];
      const panX = t.clientX - g.startTouches[0].x;
      const panY = t.clientY - g.startTouches[0].y;

      const svb = g.startViewBox;
      const pxToSvgX = svb.w / rect.width;
      const pxToSvgY = svb.h / rect.height;

      setViewBox({
        x: svb.x - panX * pxToSvgX,
        y: svb.y - panY * pxToSvgY,
        w: svb.w,
        h: svb.h,
      });
    }
  }, [clampViewBox]);

  const handleTouchEnd = useCallback(() => {
    gestureRef.current = null;
  }, []);

  // Mouse drag handlers (for desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startViewBox: { ...viewBox },
      startMouse: { x: e.clientX, y: e.clientY },
    };
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pxToSvgX = d.startViewBox.w / rect.width;
    const pxToSvgY = d.startViewBox.h / rect.height;
    const dx = e.clientX - d.startMouse.x;
    const dy = e.clientY - d.startMouse.y;

    setViewBox({
      x: d.startViewBox.x - dx * pxToSvgX,
      y: d.startViewBox.y - dy * pxToSvgY,
      w: d.startViewBox.w,
      h: d.startViewBox.h,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    zoom(factor);
  }, [zoom]);

  return (
    <div className="flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => zoom(0.7)}
          className="p-1.5 sm:p-2 rounded-lg border bg-background hover:bg-muted transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoom(1.4)}
          className="p-1.5 sm:p-2 rounded-lg border bg-background hover:bg-muted transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 sm:p-2 rounded-lg border bg-background hover:bg-muted transition-colors"
          title="Fit to screen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Floor plan canvas */}
      <div
        ref={containerRef}
        className="bg-white rounded-lg border overflow-hidden touch-none select-none"
        style={{ height: "calc(100vh - 140px)", minHeight: 300, cursor: dragRef.current ? "grabbing" : "grab" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          overflow="visible"
          style={{ width: "100%", height: "100%" }}
          preserveAspectRatio="xMidYMid meet"
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
                guestMap={guestMap}
                selectedSeat={null}
                onSeatClick={noopSeatClick}
                isSelected={false}
              />
            </g>
          ))}
        </svg>
      </div>

      <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
        Pinch or scroll to zoom. Drag to pan.
      </p>
    </div>
  );
}
