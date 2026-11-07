import { listSheet, errorResponse } from "./_lib/sheets.mts"

// Cache memori untuk data rujukan (Guru dan Kelas), dikemas kini setiap 10 minit
let cacheRujukan: { t: number; namaGuru: Map<string, string>; namaKelas: Map<string, string> } | null = null
const CACHE_MS = 10 * 60 * 1000

async function dapatRujukan() {
  if (cacheRujukan && Date.now() - cacheRujukan.t < CACHE_MS) return cacheRujukan
  const [guru, kelas] = await Promise.all([listSheet("Guru"), listSheet("Kelas")])
  cacheRujukan = {
    t: Date.now(),
    namaGuru: new Map(guru.map(g => [g.ID_Guru, g.Nama])),
    namaKelas: new Map(kelas.map(k => [k.ID_Kelas, k.Nama_Kelas])),
  }
  return cacheRujukan
}

// Tukar apa-apa bentuk tarikh kepada yyyy-MM-dd (waktu Malaysia)
function tarikhMY(v: unknown): string {
  const s = String(v ?? "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// Tukar masa kepada HH:mm
function masaHHmm(v: unknown): string {
  const s = String(v ?? "").trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return m[1].padStart(2, "0") + ":" + m[2]
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(11, 16)
  }
  return s
}

export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)

  try {
    const [jadual, rujukan] = await Promise.all([
      listSheet("Jadual Relief"),
      dapatRujukan(),
    ])

    const items = jadual
      .filter(r =>
        tarikhMY(r.Tarikh) === today &&
        String(r.Dipadam) !== "Ya" &&
        r.Status_Tugasan !== "Dibatalkan"
      )
      .map(r => ({
        Masa_Mula: masaHHmm(r.Masa_Mula),
        Masa_Tamat: masaHHmm(r.Masa_Tamat),
        Nama_Kelas: rujukan.namaKelas.get(r.ID_Kelas) || "",
        Nama_Guru_Asal: rujukan.namaGuru.get(r.ID_Guru_Asal) || "",
        Nama_Guru_Relief: rujukan.namaGuru.get(r.ID_Guru_Relief) || "",
        Status_Tugasan: r.Status_Tugasan || "",
      }))
      .sort((a, b) => a.Masa_Mula.localeCompare(b.Masa_Mula))

    return Response.json(
      { tarikh: today, items },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (e) {
    return errorResponse(e)
  }
}
