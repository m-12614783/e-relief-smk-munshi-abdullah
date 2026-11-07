import { requireUser } from "./_lib/auth.mts"
import { callSheet, listSheet, errorResponse } from "./_lib/sheets.mts"
import { checkConflicts } from "./_lib/conflict.mts"
import { logAction } from "./_lib/log.mts"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const FIELDS = [
  "Tarikh", "Masa_Mula", "Masa_Tamat", "ID_Kelas",
  "ID_Guru_Asal", "ID_Guru_Relief", "Sebab", "Catatan", "Status_Tugasan",
]

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

  const mode = body.mode === "update" ? "update" : body.mode === "create" ? "create" : null
  if (!mode) return Response.json({ error: "Mod tidak sah" }, { status: 400 })

  const input: Record<string, string> = {}
  for (const f of FIELDS) input[f] = String(body.data?.[f] ?? "").trim()
  if (!input.Status_Tugasan) input.Status_Tugasan = "Dirancang"

  const errors: string[] = []
  if (mode === "update" && !body.data?.ID_Jadual) errors.push("ID jadual diperlukan")
  if (!DATE_RE.test(input.Tarikh)) errors.push("Tarikh tidak sah")
  if (!TIME_RE.test(input.Masa_Mula) || !TIME_RE.test(input.Masa_Tamat)) {
    errors.push("Masa tidak sah")
  } else if (input.Masa_Mula >= input.Masa_Tamat) {
    errors.push("Masa tamat mesti selepas masa mula")
  }
  if (!input.ID_Kelas || !input.ID_Guru_Asal || !input.ID_Guru_Relief) {
    errors.push("Kelas dan guru wajib dipilih")
  }
  if (input.ID_Guru_Asal && input.ID_Guru_Asal === input.ID_Guru_Relief) {
    errors.push("Guru asal dan guru relief tidak boleh sama")
  }
  if (!input.Sebab) errors.push("Sebab relief wajib diisi")
  if (errors.length) return Response.json({ error: errors.join(". ") }, { status: 400 })

  try {
    const [jadual, guru, kelas] = await Promise.all([
      listSheet("Jadual Relief"),
      listSheet("Guru"),
      listSheet("Kelas"),
    ])

    const guruAktif = new Set(guru.filter(g => String(g.Status_Aktif) === "Ya").map(g => g.ID_Guru))
    const kelasAktif = new Set(kelas.filter(k => String(k.Status_Aktif) === "Ya").map(k => k.ID_Kelas))

    if (!kelasAktif.has(input.ID_Kelas)) {
      return Response.json({ error: "Kelas tidak aktif atau tidak wujud" }, { status: 400 })
    }
    if (!guruAktif.has(input.ID_Guru_Asal) || !guruAktif.has(input.ID_Guru_Relief)) {
      return Response.json({ error: "Guru tidak aktif atau tidak wujud" }, { status: 400 })
    }

    const before = mode === "update"
      ? jadual.find(r => r.ID_Jadual === body.data.ID_Jadual)
      : undefined
    if (mode === "update" && !before) {
      return Response.json({ error: "Jadual tidak dijumpai" }, { status: 404 })
    }

    const { errors: konflik, warnings } = checkConflicts(
      { ...input, ID_Jadual: body.data?.ID_Jadual } as any,
      jadual
    )
    if (konflik.length) {
      return Response.json({ error: konflik.join(". ") }, { status: 409 })
    }
    if (warnings.length && body.confirm !== true) {
      return Response.json({ needConfirm: true, warnings }, { status: 409 })
    }

    const now = new Date().toISOString()
    const id = mode === "create" ? "J" + Date.now() : String(body.data.ID_Jadual)

    const record = {
      ID_Jadual: id,
      ...input,
      ID_Permohonan: String(body.data?.ID_Permohonan || ""),
      Dicipta_Oleh: mode === "create" ? auth.user.email : String(before?.Dicipta_Oleh || ""),
      Dicipta_Pada: mode === "create" ? now : String(before?.Dicipta_Pada || ""),
      Dikemas_Kini_Pada: now,
      Dipadam: "Tidak",
    }

    if (mode === "create") {
      await callSheet({ sheet: "Jadual Relief", action: "append", data: record })
    } else {
      await callSheet({
        sheet: "Jadual Relief",
        action: "update",
        keyColumn: "ID_Jadual",
        keyValue: id,
        data: record,
      })
    }

    await logAction(
      auth.user.email,
      auth.role,
      mode === "create" ? "TAMBAH_JADUAL" : "KEMAS_KINI_JADUAL",
      id,
      before,
      record
    )

    return Response.json({ ok: true, ID_Jadual: id, warnings })
  } catch (e) {
    return errorResponse(e)
  }
}
