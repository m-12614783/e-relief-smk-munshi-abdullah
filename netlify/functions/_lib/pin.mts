import { createHmac, timingSafeEqual, randomInt } from "node:crypto"

export function janaKod(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0")
}

export function hashKod(idGuru: string, kod: string): string {
  const secret = Netlify.env.get("PIN_SECRET")
  if (!secret) throw new Error("CONFIG")
  return createHmac("sha256", secret).update(idGuru + ":" + kod).digest("hex")
}

export function sahkanKod(idGuru: string, kod: string, hashSimpan: string): boolean {
  if (!hashSimpan || !/^\d{6}$/.test(kod)) return false
  const a = Buffer.from(hashKod(idGuru, kod), "hex")
  const b = Buffer.from(hashSimpan, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
