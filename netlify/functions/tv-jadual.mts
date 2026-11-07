import { listSheet, errorResponse } from "./_lib/sheets.mts"

// Tukar apa-apa bentuk tarikh/masa kepada tarikh Malaysia (yyyy-MM-dd)
function tarikhMY(v: unknown): string {
  const s = String(v ?? "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
  const my = new Date(d.getTime() + 8 * 3600 * 1000)
  return my.toISOString().slice(0, 10)
}

// Tukar masa kepada HH:mm (menyokong "8:00", "08:00" dan ISO)
function masaHHmm(v: unknown): string {
  const s = String(v ?? "").trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return m[1].padStart(2, "0") + ":" + m[2]
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const my = new Date(d.getTime() + 8 * 3600 * 1000)
    return my.toISOString().slice(11, 16)
  }
  return s
}

export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)

  try {
    const [jadual, guru, kelas] = await Promise.all([
      listSheet("Jadual Relief"),
      listSheet("Guru"),
      listSheet("Kelas"),
    ])

    const namaGuru = new Map(guru.map(g => [g.ID_Guru, g.Nama]))
    const namaKelas = new Map(kelas.map(k => [k.ID_Kelas, k.Nama_Kelas]))

    const items = jadual
      .filter(r =>
        tarikhMY(r.Tarikh) === today &&
        String(r.Dipadam) !== "Ya" &&
        r.Status_Tugasan !== "Dibatalkan"
      )
      .map(r => ({
        Masa_Mula: masaHHmm(r.Masa_Mula),
        Masa_Tamat: masaHHmm(r.Masa_Tamat),
        Nama_Kelas: namaKelas.get(r.ID_Kelas) || "",
        Nama_Guru_Asal: namaGuru.get(r.ID_Guru_Asal) || "",
        Nama_Guru_Relief: namaGuru.get(r.ID_Guru_Relief) || "",
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
