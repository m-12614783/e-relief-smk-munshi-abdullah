import { requireUser } from "./_lib/auth.mts"
import { callSheet, listSheet, errorResponse } from "./_lib/sheets.mts"
import { logAction } from "./_lib/log.mts"
import { janaKod, hashKod } from "./_lib/pin.mts"

const capMasa = () =>
  new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ")

export default async (req: Request) => {
  const auth = await requireUser(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  if (req.method !== "POST") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Data tidak sah" }, { status: 400 })
  }

  const id = String(body.ID_Guru || "").trim()
  if (!id) return Response.json({ error: "ID guru diperlukan" }, { status: 400 })

  try {
    const guru = await listSheet("Guru")
    const g = guru.find(x => x.ID_Guru === id)
    if (!g) return Response.json({ error: "Guru tidak dijumpai" }, { status: 404 })

    const kod = janaKod()
    const data = {
      Kod_Hash: hashKod(id, kod),
      Gagal_Cubaan: "0",
      Kunci_Hingga: "",
      Dikemas_Kini_Pada: capMasa(),
    }

    await callSheet({
      sheet: "Guru",
      action: "update",
      keyColumn: "ID_Guru",
      keyValue: id,
      data,
    })

    // Jangan rekod kod atau hash dalam log
    await logAction(auth.user.email, auth.role, "JANA_KOD_GURU", id, null,
      { ID_Guru: id, Nama: g.Nama })

    return Response.json({ ok: true, ID_Guru: id, Nama: g.Nama, kod })
  } catch (e) {
    return errorResponse(e)
  }
}
