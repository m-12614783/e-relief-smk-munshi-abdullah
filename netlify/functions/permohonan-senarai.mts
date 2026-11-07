import { requireUser } from "./_lib/auth.mts"
import { listSheet, errorResponse } from "./_lib/sheets.mts"

export default async (req: Request) => {
  const auth = await requireUser(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (req.method !== "GET") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  const status = new URL(req.url).searchParams.get("status") || ""

  try {
    const [rows, guru, kelas] = await Promise.all([
      listSheet("Permohonan Relief"),
      listSheet("Guru"),
      listSheet("Kelas"),
    ])

    const namaGuru = new Map(guru.map(g => [g.ID_Guru, g.Nama]))
    const namaKelas = new Map(kelas.map(k => [k.ID_Kelas, k.Nama_Kelas]))

    let items = rows
      .filter(r => r.ID_Permohonan)
      .map(r => ({
        ...r,
        Nama_Guru: namaGuru.get(r.ID_Guru) || "",
        Nama_Kelas: namaKelas.get(r.ID_Kelas) || "",
      }))

    if (status) items = items.filter(r => r.Status === status)

    items.sort((a, b) => String(b.Cap_Masa).localeCompare(String(a.Cap_Masa)))

    return Response.json({ items })
  } catch (e) {
    return errorResponse(e)
  }
}
