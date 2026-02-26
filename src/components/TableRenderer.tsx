import { useMemo } from "react";
import type { Table, Guest, TableType } from "@/lib/types";

const SEAT_R = 16;
const SEAT_SPACING = 36;
const TBL = 48;
const GAP = 8;
const PAD = 25;

const PASTEL = [
  "#C5D9F1", "#F2DCDB", "#D5E8D4", "#E1D5E7",
  "#FFF2CC", "#DAE8FC", "#F8CECC", "#FFE6CC",
  "#D4E6F1", "#FADBD8", "#D5F5E3", "#E8DAEF",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function gColor(id: string) {
  return PASTEL[hash(id) % PASTEL.length];
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

interface SeatXY {
  cx: number;
  cy: number;
  idx: number;
  guestId: string | null;
  labelSide: "top" | "bottom" | "left" | "right" | "radial";
  labelAngle?: number;
}

interface Props {
  table: Table;
  guestMap: Map<string, Guest>;
  selectedSeat: { tableId: string; position: number } | null;
  onSeatClick: (tableId: string, position: number) => void;
  isSelected: boolean;
}

export function TableRenderer({
  table,
  guestMap,
  selectedSeat,
  onSeatClick,
  isSelected,
}: Props) {
  switch (table.tableType) {
    case "LINE":
      return <LineTable {...{ table, guestMap, selectedSeat, onSeatClick, isSelected }} />;
    case "U_SHAPE":
      return <UShapeTable {...{ table, guestMap, selectedSeat, onSeatClick, isSelected }} />;
    case "ROUND":
      return <RoundTable {...{ table, guestMap, selectedSeat, onSeatClick, isSelected }} />;
    default:
      return null;
  }
}

// ─── LINE TABLE ──────────────────────────────────────────────────────

function LineTable({ table, guestMap, selectedSeat, onSeatClick, isSelected }: Props) {
  const endLeft = table.endSeatLeft ?? false;
  const endRight = table.endSeatRight ?? false;
  const endCount = (endLeft ? 1 : 0) + (endRight ? 1 : 0);
  const sideSeats = table.seats.length - endCount;
  const perSide = table.singleSided ? sideSeats : Math.ceil(sideSeats / 2);
  const w = Math.max(180, perSide * SEAT_SPACING + PAD * 2);

  const seats = useMemo(() => {
    const out: SeatXY[] = [];
    const sx = -w / 2 + PAD;
    const ex = w / 2 - PAD;
    const sp = perSide > 1 ? (ex - sx) / (perSide - 1) : 0;

    for (let i = 0; i < perSide; i++) {
      out.push({
        cx: perSide > 1 ? sx + i * sp : 0,
        cy: -TBL / 2 - SEAT_R - GAP,
        idx: i,
        guestId: table.seats[i]?.guestId ?? null,
        labelSide: "top",
      });
    }

    if (!table.singleSided) {
      for (let i = 0; i < perSide; i++) {
        const idx = perSide + i;
        if (idx >= sideSeats) break;
        out.push({
          cx: perSide > 1 ? sx + i * sp : 0,
          cy: TBL / 2 + SEAT_R + GAP,
          idx,
          guestId: table.seats[idx]?.guestId ?? null,
          labelSide: "bottom",
        });
      }
    }

    let endIdx = sideSeats;
    if (endLeft) {
      out.push({
        cx: -w / 2 - SEAT_R - GAP,
        cy: 0,
        idx: endIdx,
        guestId: table.seats[endIdx]?.guestId ?? null,
        labelSide: "left",
      });
      endIdx++;
    }
    if (endRight) {
      out.push({
        cx: w / 2 + SEAT_R + GAP,
        cy: 0,
        idx: endIdx,
        guestId: table.seats[endIdx]?.guestId ?? null,
        labelSide: "right",
      });
    }

    return out;
  }, [table.seats, sideSeats, perSide, w, table.singleSided, endLeft, endRight]);

  const extraW = (endLeft ? SEAT_R + GAP + SEAT_R : 0) + (endRight ? SEAT_R + GAP + SEAT_R : 0);

  return (
    <>
      {isSelected && (
        <rect
          x={-w / 2 - (endLeft ? SEAT_R + GAP + SEAT_R : 0) - 12}
          y={-TBL / 2 - SEAT_R - GAP - SEAT_R - 12}
          width={w + extraW + 24}
          height={
            TBL +
            (table.singleSided ? 1 : 2) * (SEAT_R + GAP + SEAT_R) +
            24
          }
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          rx="6"
        />
      )}
      <rect
        x={-w / 2}
        y={-TBL / 2}
        width={w}
        height={TBL}
        fill="#fdfdfd"
        stroke="#888"
        strokeWidth="2"
        rx="3"
      />
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#555"
        fontSize="13"
        fontWeight="500"
      >
        {table.name}
      </text>
      {renderSeats(seats, table, guestMap, selectedSeat, onSeatClick)}
    </>
  );
}

// ─── U-SHAPE TABLE ───────────────────────────────────────────────────

function UShapeTable({ table, guestMap, selectedSeat, onSeatClick, isSelected }: Props) {
  const { topSeats: nTop, leftSeats: nLeft, rightSeats: nRight } = table;

  const layout = useMemo(() => {
    const topMiddle = Math.max(0, nTop - 2);
    const topW = Math.max(300, topMiddle * SEAT_SPACING + 100);
    const maxSide = Math.max(nLeft, nRight);
    const sideH = Math.max(250, maxSide * SEAT_SPACING + 60);
    const totalH = TBL + sideH;

    const topRect = { x: -topW / 2, y: -totalH / 2, w: topW, h: TBL };
    const leftRect = { x: -topW / 2, y: -totalH / 2 + TBL, w: TBL, h: sideH };
    const rightRect = { x: topW / 2 - TBL, y: -totalH / 2 + TBL, w: TBL, h: sideH };

    const seats: SeatXY[] = [];
    const topOff = 0;
    const leftOff = nTop;
    const rightOff = nTop + nLeft;

    // Top table seats
    if (nTop >= 2) {
      seats.push({
        cx: topRect.x - SEAT_R - GAP,
        cy: topRect.y + TBL / 2,
        idx: topOff,
        guestId: table.seats[topOff]?.guestId ?? null,
        labelSide: "left",
      });
      seats.push({
        cx: topRect.x + topRect.w + SEAT_R + GAP,
        cy: topRect.y + TBL / 2,
        idx: topOff + nTop - 1,
        guestId: table.seats[topOff + nTop - 1]?.guestId ?? null,
        labelSide: "right",
      });
      const mc = nTop - 2;
      if (mc > 0) {
        const sx = topRect.x + 35;
        const ex = topRect.x + topRect.w - 35;
        const sp = mc > 1 ? (ex - sx) / (mc - 1) : 0;
        for (let i = 0; i < mc; i++) {
          seats.push({
            cx: mc > 1 ? sx + i * sp : (sx + ex) / 2,
            cy: topRect.y - SEAT_R - GAP,
            idx: topOff + 1 + i,
            guestId: table.seats[topOff + 1 + i]?.guestId ?? null,
            labelSide: "top",
          });
        }
      }
    } else if (nTop === 1) {
      seats.push({
        cx: 0,
        cy: topRect.y - SEAT_R - GAP,
        idx: 0,
        guestId: table.seats[0]?.guestId ?? null,
        labelSide: "top",
      });
    }

    // Left arm seats
    if (nLeft > 0) {
      const sy = leftRect.y + 20;
      const ey = leftRect.y + leftRect.h - 20;
      const sp = nLeft > 1 ? (ey - sy) / (nLeft - 1) : 0;
      for (let i = 0; i < nLeft; i++) {
        seats.push({
          cx: leftRect.x - SEAT_R - GAP,
          cy: nLeft > 1 ? sy + i * sp : (sy + ey) / 2,
          idx: leftOff + i,
          guestId: table.seats[leftOff + i]?.guestId ?? null,
          labelSide: "left",
        });
      }
    }

    // Right arm seats
    if (nRight > 0) {
      const sy = rightRect.y + 20;
      const ey = rightRect.y + rightRect.h - 20;
      const sp = nRight > 1 ? (ey - sy) / (nRight - 1) : 0;
      for (let i = 0; i < nRight; i++) {
        seats.push({
          cx: rightRect.x + rightRect.w + SEAT_R + GAP,
          cy: nRight > 1 ? sy + i * sp : (sy + ey) / 2,
          idx: rightOff + i,
          guestId: table.seats[rightOff + i]?.guestId ?? null,
          labelSide: "right",
        });
      }
    }

    return { topRect, leftRect, rightRect, seats, topW, totalH };
  }, [table.seats, nTop, nLeft, nRight]);

  const { topRect, leftRect, rightRect, seats, topW, totalH } = layout;

  return (
    <>
      {isSelected && (
        <rect
          x={-topW / 2 - SEAT_R - GAP - SEAT_R - 12}
          y={-totalH / 2 - SEAT_R - GAP - SEAT_R - 12}
          width={topW + (SEAT_R + GAP + SEAT_R) * 2 + 24}
          height={totalH + SEAT_R + GAP + SEAT_R + 24}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          rx="6"
        />
      )}
      <rect x={topRect.x} y={topRect.y} width={topRect.w} height={topRect.h} fill="#fdfdfd" stroke="#888" strokeWidth="2" rx="3" />
      <rect x={leftRect.x} y={leftRect.y} width={leftRect.w} height={leftRect.h} fill="#fdfdfd" stroke="#888" strokeWidth="2" rx="3" />
      <rect x={rightRect.x} y={rightRect.y} width={rightRect.w} height={rightRect.h} fill="#fdfdfd" stroke="#888" strokeWidth="2" rx="3" />

      <text x={0} y={topRect.y + TBL / 2} textAnchor="middle" dominantBaseline="central" fill="#555" fontSize="13" fontWeight="500">
        {table.name}
      </text>
      <g transform={`rotate(-90, ${leftRect.x + TBL / 2}, ${leftRect.y + leftRect.h / 2})`}>
        <text x={leftRect.x + TBL / 2} y={leftRect.y + leftRect.h / 2} textAnchor="middle" dominantBaseline="central" fill="#999" fontSize="11">
          left
        </text>
      </g>
      <g transform={`rotate(90, ${rightRect.x + TBL / 2}, ${rightRect.y + rightRect.h / 2})`}>
        <text x={rightRect.x + TBL / 2} y={rightRect.y + rightRect.h / 2} textAnchor="middle" dominantBaseline="central" fill="#999" fontSize="11">
          right
        </text>
      </g>

      {renderSeats(seats, table, guestMap, selectedSeat, onSeatClick)}
    </>
  );
}

// ─── ROUND TABLE ─────────────────────────────────────────────────────

function RoundTable({ table, guestMap, selectedSeat, onSeatClick, isSelected }: Props) {
  const n = table.seats.length;
  const R = Math.max(35, n * 7);

  const seats = useMemo(() => {
    const out: SeatXY[] = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      out.push({
        cx: Math.cos(a) * (R + SEAT_R + GAP),
        cy: Math.sin(a) * (R + SEAT_R + GAP),
        idx: i,
        guestId: table.seats[i]?.guestId ?? null,
        labelSide: "radial",
        labelAngle: (a * 180) / Math.PI,
      });
    }
    return out;
  }, [table.seats, n, R]);

  return (
    <>
      {isSelected && (
        <circle
          cx={0}
          cy={0}
          r={R + SEAT_R + GAP + SEAT_R + 12}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
      )}
      <circle cx={0} cy={0} r={R} fill="#fdfdfd" stroke="#888" strokeWidth="2" />
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fill="#555" fontSize="13" fontWeight="500">
        {table.name}
      </text>
      {renderSeats(seats, table, guestMap, selectedSeat, onSeatClick)}
    </>
  );
}

// ─── SHARED SEAT RENDERING ──────────────────────────────────────────

function renderSeats(
  seats: SeatXY[],
  table: Table,
  guestMap: Map<string, Guest>,
  selectedSeat: { tableId: string; position: number } | null,
  onSeatClick: (tableId: string, position: number) => void
) {
  return seats.map((s) => {
    const guest = s.guestId ? guestMap.get(s.guestId) : null;
    const isSel =
      selectedSeat?.tableId === table.id && selectedSeat.position === s.idx;
    const seatNum = s.idx + 1;

    return (
      <g
        key={s.idx}
        onClick={(e) => {
          e.stopPropagation();
          onSeatClick(table.id, s.idx);
        }}
        style={{ cursor: "pointer" }}
      >
        <circle cx={s.cx} cy={s.cy} r={SEAT_R + 4} fill="transparent" />
        <circle
          cx={s.cx}
          cy={s.cy}
          r={SEAT_R}
          fill={guest ? gColor(guest.id) : "white"}
          stroke={isSel ? "#3b82f6" : "#999"}
          strokeWidth={isSel ? 2.5 : 1.5}
        />
        <text
          x={s.cx}
          y={s.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={guest ? 8 : 10}
          fill={guest ? "#555" : "#999"}
          fontWeight={guest ? 400 : 500}
          pointerEvents="none"
        >
          {seatNum}
        </text>
        {guest && seatLabel(s, trunc(guest.name, 14))}
      </g>
    );
  });
}

function seatLabel(s: SeatXY, name: string) {
  const { cx, cy } = s;
  const base = { fontSize: 11, fill: "#333", fontWeight: 500 as const };

  switch (s.labelSide) {
    case "top":
      return (
        <text {...base} x={cx + 2} y={cy - SEAT_R - 5} textAnchor="start" transform={`rotate(-45,${cx + 2},${cy - SEAT_R - 5})`}>
          {name}
        </text>
      );
    case "bottom":
      return (
        <text {...base} x={cx + 2} y={cy + SEAT_R + 14} textAnchor="start" transform={`rotate(45,${cx + 2},${cy + SEAT_R + 14})`}>
          {name}
        </text>
      );
    case "left":
      return (
        <text {...base} x={cx - SEAT_R - 6} y={cy + 4} textAnchor="end">
          {name}
        </text>
      );
    case "right":
      return (
        <text {...base} x={cx + SEAT_R + 6} y={cy + 4} textAnchor="start">
          {name}
        </text>
      );
    case "radial": {
      const a = s.labelAngle ?? 0;
      const deg = a + 90;
      const dist = SEAT_R + 8;
      const rad = (a * Math.PI) / 180;
      const tx = cx + Math.cos(rad) * dist;
      const ty = cy + Math.sin(rad) * dist;
      const anchor = Math.abs(a) < 1 || Math.abs(a - 180) < 1
        ? "middle"
        : a > -90 && a < 90
          ? "start"
          : "end";
      return (
        <text {...base} x={tx} y={ty + 4} textAnchor={anchor}>
          {name}
        </text>
      );
    }
  }
}
