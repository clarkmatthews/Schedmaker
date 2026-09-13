export const DAY_LANE_HEIGHT = 28;
export const DAY_ROW_PAD = 4;

export function laneLayout(shifts: { start: string; stop: string }[]) {
  const order = shifts
    .map((shift, index) => ({
      index,
      start: new Date(shift.start).getTime(),
      stop: new Date(shift.stop).getTime(),
    }))
    .sort((a, b) => a.start - b.start || a.stop - b.stop);

  const ends: number[] = [];
  const lanes = Array.from({ length: shifts.length }, () => 0);

  for (const item of order) {
    let lane = ends.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(item.stop);
    } else {
      ends[lane] = item.stop;
    }
    lanes[item.index] = lane;
  }

  const count = Math.max(ends.length, 1);
  return {
    lanes,
    count,
    height: DAY_ROW_PAD * 2 + count * DAY_LANE_HEIGHT,
  };
}
