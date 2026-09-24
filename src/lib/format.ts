/* Util format angka & tanggal (Bahasa Indonesia) */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** 6_401_000 -> "Rp6.401.000" */
export function rp(n: number): string {
  return `Rp${Math.abs(n).toLocaleString("id-ID")}`;
}

/** selisih -> "-Rp10.000" / "+Rp400.000" / "Rp0" */
export function rpSign(n: number): string {
  if (n === 0) return "Rp0";
  return `${n < 0 ? "-" : "+"}${rp(n)}`;
}

/** "2026-09-16" -> "16 Sep" */
export function dateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "2026-09-16" -> "16 Sep 2026" */
export function dateFull(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO datetime -> "19:22" */
export function timeShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ISO datetime -> "21 Sep • 19:22" */
export function dateTimeShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} • ${timeShort(iso)}`;
}
