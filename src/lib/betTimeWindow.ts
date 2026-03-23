/** Sort helpers — no filtering; use full `events` from the API. */

export function eventEndMs(event: { endDate: string }): number | null {
  if (!event.endDate) return null;
  const t = new Date(event.endDate).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Bet calendar day ascending (Mar 22 → 23 → 24), then city priority, then market end time.
 */
export function compareEventsByBetDateAscending(
  a: { endDate: string; priorityRank: number; betDate: string },
  b: { endDate: string; priorityRank: number; betDate: string },
): number {
  const dateCmp = a.betDate.localeCompare(b.betDate);
  if (dateCmp !== 0) return dateCmp;
  if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
  const endA = eventEndMs(a);
  const endB = eventEndMs(b);
  if (endA === null && endB === null) return 0;
  if (endA === null) return 1;
  if (endB === null) return -1;
  return endA - endB;
}

/**
 * Ready tab: same calendar order, but within each day list markets that close soonest first.
 */
export function compareReadyEventsByDateThenCloseTime(
  a: { endDate: string; priorityRank: number; betDate: string },
  b: { endDate: string; priorityRank: number; betDate: string },
): number {
  const dateCmp = a.betDate.localeCompare(b.betDate);
  if (dateCmp !== 0) return dateCmp;
  const endA = eventEndMs(a);
  const endB = eventEndMs(b);
  if (endA !== null && endB !== null && endA !== endB) return endA - endB;
  if (endA === null && endB !== null) return 1;
  if (endB === null && endA !== null) return -1;
  if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
  return 0;
}
