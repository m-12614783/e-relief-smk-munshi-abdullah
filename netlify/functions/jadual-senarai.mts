import { requireUser } from "./_lib/auth.mts"
import { listSheet, errorResponse } from "./_lib/sheets.mts"

export default async (req: Request) => {
  const auth = await requireUser(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (req.method !== "GET") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  const q = new URL(req.url).searchParams
  const tarikh = q.get("tarikh") || ""
  const kelas = q.get("kelas") || ""
  const guru = q.get("guru") || ""
  const carian = (q.get("carian") || "").trim().toLowerCase()

  try {
    const [jadual, guruList, kelasList] = await Promise.all([
      listSheet("Jadual Relief"),
      listSheet("Guru"),
      listSheet("Kelas"),
    ])

    const namaGuru = new Map(guruList.map(g => [g.ID_Guru, g.Nama]))
    const namaKelas = new Map(kelasList.map(k => [k.ID_Kelas, k.Nama_Kelas]))

    let items = jadual
      .filter(r => String(r.Dipadam) !== "Ya")
      .map(r => ({
        ...r,
        Nama_Guru_Asal: namaGuru.get(r.ID_Guru_Asal) || "",
        Nama_Guru_Relief: namaGuru.get(r.ID_Guru_Relief) || "",
        Nama_Kelas: namaKelas.get(r.ID_Kelas) || "",
      }))

    if (tarikh) items = items.filter(r => String(r.Tarikh) === tarikh)
    if (kelas) items = items.filter(r => r.ID_Kelas === kelas)
    if (guru) items = items.filter(r => r.ID_Guru_Asal === guru || r.ID_Guru_Relief === guru)
    if (carian) {
      items = items.filter(r =>
        `${r.Nama_Guru_Asal} ${r.Nama_Guru_Relief} ${r.Nama_Kelas}`.toLowerCase().includes(carian)
      )
    }

    items.sort((a, b) =>
      `${a.Tarikh} ${a.Masa_Mula}`.localeCompare(`${b.Tarikh} ${b.Masa_Mula}`)
    )

    return Response.json({ items })
  } catch (e) {
    return errorResponse(e)
  }
}
