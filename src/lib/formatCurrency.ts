export function formatINR(value: number): string {
  const abs = Math.abs(Math.round(value));
  const s = abs.toString();
  if (s.length <= 3) return `₹${value < 0 ? '-' : ''}${s}`;
  
  let result = s.slice(-3);
  let remaining = s.slice(0, -3);
  while (remaining.length > 2) {
    result = remaining.slice(-2) + ',' + result;
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    result = remaining + ',' + result;
  }
  return `${value < 0 ? '-' : ''}₹${result}`;
}

export function formatINRCompact(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return formatINR(value);
}
