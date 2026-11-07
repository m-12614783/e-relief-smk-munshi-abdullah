import { listSheet, errorResponse } from "./_lib/sheets.mts"

export default async (req: Request) => {
  if (req.method !== "GET") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  // Tarikh hari ini mengikut waktu Malaysia (UTC+8)
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
        String(r.Tarikh).trim() === today &&
        String(r.Dipadam) !== "Ya" &&
        r.Status_Tugasan !== "Dibatalkan"
      )
      .map(r => ({
        Masa_Mula: String(r.Masa_Mula),
        Masa_Tamat: String(r.Masa_Tamat),
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
  } catch {
    // Mesej generik sahaja, tiada butiran dalaman didedahkan kepada paparan awam
    return Response.json({ error: "Data tidak dapat dimuatkan" }, { status: 500 })
  }
}
