import { requireUser } from "./_lib/auth.mts"
import { listSheet, errorResponse } from "./_lib/sheets.mts"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Tukar apa-apa bentuk tarikh kepada yyyy-MM-dd (waktu Malaysia)
function tarikhMY(v: unknown): string {
  const s = String(v ?? "").trim()
  if (DATE_RE.test(s)) return s
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

function hariIni(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export default async (req: Request) => {
  const auth = await requireUser(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (req.method !== "GET") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  const q = new URL(req.url).searchParams
  const dari = q.get("dari") || hariIni()
  const hingga = q.get("hingga") || dari

  if (!DATE_RE.test(dari) || !DATE_RE.test(hingga) || dari > hingga) {
    return Response.json({ error: "Julat tarikh tidak sah" }, { status: 400 })
  }

  const dalamJulat = (t: string) => t >= dari && t <= hingga

  try {
    const [jadual, permohonan, guru, kelas] = await Promise.all([
      listSheet("Jadual Relief"),
      listSheet("Permohonan Relief"),
      listSheet("Guru"),
      listSheet("Kelas"),
    ])

    const namaGuru = new Map(guru.map(g => [g.ID_Guru, g.Nama]))
    const namaKelas = new Map(kelas.map(k => [k.ID_Kelas, k.Nama_Kelas]))

    // Jadual aktif dalam julat tarikh
    const senarai = jadual
      .filter(r =>
        String(r.Dipadam) !== "Ya" &&
        r.Status_Tugasan !== "Dibatalkan" &&
        dalamJulat(tarikhMY(r.Tarikh))
      )
      .map(r => ({
        Tarikh: tarikhMY(r.Tarikh),
        Masa_Mula: masaHHmm(r.Masa_Mula),
        Masa_Tamat: masaHHmm(r.Masa_Tamat),
        Nama_Kelas: namaKelas.get(r.ID_Kelas) || "",
        Nama_Guru_Asal: namaGuru.get(r.ID_Guru_Asal) || "",
        Nama_Guru_Relief: namaGuru.get(r.ID_Guru_Relief) || "",
        ID_Guru_Relief: r.ID_Guru_Relief || "",
        Status_Tugasan: r.Status_Tugasan || "",
      }))
      .sort((a, b) =>
        `${a.Tarikh} ${a.Masa_Mula}`.localeCompare(`${b.Tarikh} ${b.Masa_Mula}`)
      )

    // Jumlah tugasan setiap guru relief
    const guruMap = new Map<string, { nama: string; tugasan: number }>()
    for (const r of senarai) {
      if (!r.ID_Guru_Relief) continue
      const cur = guruMap.get(r.ID_Guru_Relief) || { nama: r.Nama_Guru_Relief, tugasan: 0 }
      cur.tugasan++
      guruMap.set(r.ID_Guru_Relief, cur)
    }
    const perGuru = [...guruMap.values()].sort((a, b) => b.tugasan - a.tugasan)

    // Jumlah relief setiap kelas
    const kelasMap = new Map<string, number>()
    for (const r of senarai) {
      if (!r.Nama_Kelas) continue
      kelasMap.set(r.Nama_Kelas, (kelasMap.get(r.Nama_Kelas) || 0) + 1)
    }
    const perKelas = [...kelasMap.entries()]
      .map(([nama, tugasan]) => ({ nama, tugasan }))
      .sort((a, b) => b.tugasan - a.tugasan)

    // Status permohonan dalam julat tarikh
    const permohonanStatus: Record<string, number> = {
      Baharu: 0, Diluluskan: 0, Ditolak: 0, Lain: 0,
    }
    let jumlahPermohonan = 0
    for (const p of permohonan) {
      if (!p.ID_Permohonan || !dalamJulat(tarikhMY(p.Tarikh))) continue
      jumlahPermohonan++
      const st = String(p.Status || "")
      if (st in permohonanStatus) permohonanStatus[st]++
      else permohonanStatus.Lain++
    }

    return Response.json({
      dari,
      hingga,
      ringkasan: {
        jumlahTugasan: senarai.length,
        kelasDiterimaRelief: perKelas.length,
        guruReliefBertugas: perGuru.length,
        jumlahPermohonan,
      },
      permohonanStatus,
      perGuru,
      perKelas,
      senarai,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
