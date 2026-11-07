import { requireUser } from "./_lib/auth.mts"
import { callSheet, listSheet, errorResponse } from "./_lib/sheets.mts"
import { checkConflicts } from "./_lib/conflict.mts"
import { logAction } from "./_lib/log.mts"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Tukar "8:00" kepada "08:00"
const pad = (t: string) => {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  return m ? m[1].padStart(2, "0") + ":" + m[2] : String(t).trim()
}

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

  const id = String(body.ID_Permohonan || "")
  const action = body.action
  if (!id) return Response.json({ error: "ID permohonan diperlukan" }, { status: 400 })
  if (action !== "lulus" && action !== "tolak") {
    return Response.json({ error: "Tindakan tidak sah" }, { status: 400 })
  }

  try {
    const permohonan = await listSheet("Permohonan Relief")
    const p = permohonan.find(r => r.ID_Permohonan === id)
    if (!p) return Response.json({ error: "Permohonan tidak dijumpai" }, { status: 404 })
    if (p.Status !== "Baharu") {
      return Response.json({ error: "Permohonan ini sudah diproses" }, { status: 409 })
    }

    const now = new Date().toISOString()

    // ---------- TOLAK ----------
    if (action === "tolak") {
      const sebab = String(body.sebab_tolak || "").trim()
      if (!sebab) return Response.json({ error: "Sebab penolakan wajib diisi" }, { status: 400 })

      await callSheet({
        sheet: "Permohonan Relief",
        action: "update",
        keyColumn: "ID_Permohonan",
        keyValue: id,
        data: {
          Status: "Ditolak",
          Diproses_Oleh: auth.user.email,
          Diproses_Pada: now,
          Sebab_Tolak: sebab,
        },
      })

      await logAction(auth.user.email, auth.role, "TOLAK_PERMOHONAN", id, p,
        { ...p, Status: "Ditolak", Sebab_Tolak: sebab })

      return Response.json({ ok: true })
    }

    // ---------- LULUS ----------
    const idGuruRelief = String(body.ID_Guru_Relief || "")
    if (!idGuruRelief) return Response.json({ error: "Pilih guru relief" }, { status: 400 })
    if (idGuruRelief === p.ID_Guru) {
      return Response.json({ error: "Guru relief tidak boleh sama dengan guru asal" }, { status: 400 })
    }

    const tarikh = String(p.Tarikh).trim()
    const masaMula = pad(p.Masa_Mula)
    const masaTamat = pad(p.Masa_Tamat)
    if (!DATE_RE.test(tarikh)) {
      return Response.json({ error: "Tarikh permohonan tidak sah" }, { status: 400 })
    }
    if (!TIME_RE.test(masaMula) || !TIME_RE.test(masaTamat) || masaMula >= masaTamat) {
      return Response.json({ error: "Masa permohonan tidak sah" }, { status: 400 })
    }

    const [jadual, guru, kelas] = await Promise.all([
      listSheet("Jadual Relief"),
      listSheet("Guru"),
      listSheet("Kelas"),
    ])

    const guruAktif = new Set(guru.filter(g => String(g.Status_Aktif) === "Ya").map(g => g.ID_Guru))
    const kelasAktif = new Set(kelas.filter(k => String(k.Status_Aktif) === "Ya").map(k => k.ID_Kelas))

    if (!kelasAktif.has(p.ID_Kelas)) {
      return Response.json({ error: "Kelas tidak aktif atau tidak wujud" }, { status: 400 })
    }
    if (!guruAktif.has(p.ID_Guru) || !guruAktif.has(idGuruRelief)) {
      return Response.json({ error: "Guru tidak aktif atau tidak wujud" }, { status: 400 })
    }

    const input = {
      Tarikh: tarikh,
      Masa_Mula: masaMula,
      Masa_Tamat: masaTamat,
      ID_Kelas: p.ID_Kelas,
      ID_Guru_Asal: p.ID_Guru,
      ID_Guru_Relief: idGuruRelief,
    }

    const { errors, warnings } = checkConflicts(input as any, jadual)
    if (errors.length) {
      return Response.json({ error: errors.join(". ") }, { status: 409 })
    }
    if (warnings.length && body.confirm !== true) {
      return Response.json({ needConfirm: true, warnings }, { status: 409 })
    }

    const idJadual = "J" + Date.now()
    const record = {
      ID_Jadual: idJadual,
      ...input,
      Sebab: String(p.Sebab || ""),
      Catatan: String(p.Catatan || ""),
      Status_Tugasan: "Dirancang",
      ID_Permohonan: id,
      Dicipta_Oleh: auth.user.email,
      Dicipta_Pada: now,
      Dikemas_Kini_Pada: now,
      Dipadam: "Tidak",
    }

    await callSheet({ sheet: "Jadual Relief", action: "append", data: record })

    await callSheet({
      sheet: "Permohonan Relief",
      action: "update",
      keyColumn: "ID_Permohonan",
      keyValue: id,
      data: {
        Status: "Diluluskan",
        Diproses_Oleh: auth.user.email,
        Diproses_Pada: now,
      },
    })

    await logAction(auth.user.email, auth.role, "LULUS_PERMOHONAN", id, p,
      { ...p, Status: "Diluluskan", ID_Jadual: idJadual, ID_Guru_Relief: idGuruRelief })

    await logAction(auth.user.email, auth.role, "TAMBAH_JADUAL", idJadual, null, record)

    return Response.json({ ok: true, ID_Jadual: idJadual, warnings })
  } catch (e) {
    return errorResponse(e)
  }
}
