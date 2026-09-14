let grabOffsetPx = 0;

export function beginShiftDrag(offsetPx: number) {
  grabOffsetPx = Number.isFinite(offsetPx) ? Math.max(0, offsetPx) : 0;
}

export function shiftDragGrabOffsetPx() {
  return grabOffsetPx;
}

export function endShiftDrag() {
  grabOffsetPx = 0;
}
