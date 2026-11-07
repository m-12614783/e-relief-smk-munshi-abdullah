import { requireUser } from "./_lib/auth.mts"
import { listSheet, errorResponse } from "./_lib/sheets.mts"

export default async (req: Request) => {
  const auth = await requireUser(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    const [guru, kelas] = await Promise.all([listSheet("Guru"), listSheet("Kelas")])
    return Response.json({
      guru: guru
        .filter(g => String(g.Status_Aktif) === "Ya")
        .map(g => ({ id: g.ID_Guru, nama: g.Nama })),
      kelas: kelas
        .filter(k => String(k.Status_Aktif) === "Ya")
        .map(k => ({ id: k.ID_Kelas, nama: k.Nama_Kelas })),
    })
  } catch (e) {
    return errorResponse(e)
  }
}
