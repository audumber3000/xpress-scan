// Overlap → sub-column layout for the week grid.
//
// When multiple appointments in the same day overlap in time (commonly
// different doctors booking the same slot), we want them to render side-by-side
// within the day column, not stacked on top of each other.
//
// Algorithm: classic interval-graph greedy column assignment.
// 1. Sort appointments by start time.
// 2. For each appointment, find the lowest-indexed column whose last
//    appointment ends at or before this one's start — place it there.
//    If no such column exists, add a new column.
// 3. Group appointments into "clusters" that transitively overlap. All
//    appointments in one cluster share the same subcolumn count so their
//    widths line up visually.
//
// Returns a map: appointmentId -> { colIndex, colCount }

const toMinutes = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const computeDayLayout = (appointments) => {
  const layout = {};
  if (!appointments || appointments.length === 0) return layout;

  const sorted = [...appointments].sort((a, b) => {
    const aStart = toMinutes(a.startTime);
    const bStart = toMinutes(b.startTime);
    if (aStart !== bStart) return aStart - bStart;
    return toMinutes(a.endTime) - toMinutes(b.endTime);
  });

  // Group into clusters of transitively-overlapping appointments.
  const clusters = [];
  let current = [];
  let currentMaxEnd = -Infinity;

  for (const apt of sorted) {
    const start = toMinutes(apt.startTime);
    const end = toMinutes(apt.endTime);
    if (current.length === 0 || start < currentMaxEnd) {
      current.push(apt);
      currentMaxEnd = Math.max(currentMaxEnd, end);
    } else {
      clusters.push(current);
      current = [apt];
      currentMaxEnd = end;
    }
  }
  if (current.length > 0) clusters.push(current);

  // For each cluster, assign columns greedily.
  for (const cluster of clusters) {
    const columns = []; // columns[i] = end minute of the last appointment placed in column i
    const placements = []; // parallel array: column index assigned to cluster[i]

    for (const apt of cluster) {
      const start = toMinutes(apt.startTime);
      const end = toMinutes(apt.endTime);
      let placed = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= start) {
          columns[i] = end;
          placed = i;
          break;
        }
      }
      if (placed === -1) {
        columns.push(end);
        placed = columns.length - 1;
      }
      placements.push(placed);
    }

    const colCount = columns.length;
    cluster.forEach((apt, i) => {
      layout[apt.id] = { colIndex: placements[i], colCount };
    });
  }

  return layout;
};
