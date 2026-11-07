import { requireUser } from "./_lib/auth.mts"
import { callSheet, listSheet, errorResponse } from "./_lib/sheets.mts"
import { logAction } from "./_lib/log.mts"

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
  const id = String(body.ID_Jadual || "")
  if (!id) return Response.json({ error: "ID jadual diperlukan" }, { status: 400 })

  try {
    const jadual = await listSheet("Jadual Relief")
    const before = jadual.find(r => r.ID_Jadual === id)
    if (!before) return Response.json({ error: "Jadual tidak dijumpai" }, { status: 404 })

    const after = { ...before, Dipadam: "Ya", Dikemas_Kini_Pada: new Date().toISOString() }

    await callSheet({
      sheet: "Jadual Relief",
      action: "update",
      keyColumn: "ID_Jadual",
      keyValue: id,
      data: { Dipadam: "Ya", Dikemas_Kini_Pada: after.Dikemas_Kini_Pada },
    })

    await logAction(auth.user.email, auth.role, "PADAM_JADUAL", id, before, after)

    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
