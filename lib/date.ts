export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function monthDay(date = new Date()): string {
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
    .toUpperCase();
}

export function shortTime(date = new Date()): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}
