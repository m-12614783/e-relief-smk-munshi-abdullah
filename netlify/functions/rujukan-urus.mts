import { requireUser } from "./_lib/auth.mts"
import { callSheet, listSheet, errorResponse } from "./_lib/sheets.mts"
import { logAction } from "./_lib/log.mts"

const MAX_IMPORT = 200

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()
const nowText = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ")

function idGenerator(rows: Record<string, string>[], key: string, prefix: string) {
  const nums = rows
    .map(r => parseInt(String(r[key] ?? "").replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n))
  let n = nums.length ? Math.max(...nums) : 0
  return () => prefix + String(++n).padStart(3, "0")
}

function validGuru(r: any) {
  const nama = String(r.Nama ?? "").trim().toUpperCase()
  const emel = String(r.Emel ?? "").trim()
  const status = String(r.Status_Aktif ?? "").trim()
  if (!nama) return { ok: false as const, mesej: "Nama kosong" }
  if (emel && !emel.includes("@")) return { ok: false as const, mesej: "Emel tidak sah" }
  if (status && status !== "Ya" && status !== "Tidak") {
    return { ok: false as const, mesej: "Status_Aktif mesti Ya atau Tidak" }
  }
  return { ok: true as const, data: { Nama: nama, Emel: emel, Status_Aktif: status || "Ya" } }
}

function validKelas(r: any) {
  const nama = String(r.Nama_Kelas ?? "").trim().toUpperCase()
  const tingkatan = String(r.Tingkatan ?? "").trim()
  const status = String(r.Status_Aktif ?? "").trim()
  if (!nama) return { ok: false as const, mesej: "Nama kelas kosong" }
  if (status && status !== "Ya" && status !== "Tidak") {
    return { ok: false as const, mesej: "Status_Aktif mesti Ya atau Tidak" }
  }
  return { ok: true as const, data: { Nama_Kelas: nama, Tingkatan: tingkatan, Status_Aktif: status || "Ya" } }
}

const CFG: Record<string, any> = {
  guru: { sheet: "Guru", idKey: "ID_Guru", namaKey: "Nama", prefix: "G", label: "GURU", valid: validGuru },
  kelas: { sheet: "Kelas", idKey: "ID_Kelas", namaKey: "Nama_Kelas", prefix: "K", label: "KELAS", valid: validKelas },
}

async function simpan(auth: any, cfg: any, body: any) {
  const v = cfg.valid(body.data || {})
  if (!v.ok) return Response.json({ error: v.mesej }, { status: 400 })

  const rows = await listSheet(cfg.sheet)
  const kunci = norm(v.data[cfg.namaKey])
  const dup = rows.find(r => norm(r[cfg.namaKey]) === kunci && r[cfg.idKey] !== body.id)
  if (dup) return Response.json({ error: `Nama ini sudah wujud (${dup[cfg.idKey]})` }, { status: 409 })

  const now = nowText()

  if (body.id) {
    const before = rows.find(r => r[cfg.idKey] === body.id)
    if (!before) return Response.json({ error: "Rekod tidak dijumpai" }, { status: 404 })
    const data = { ...v.data, Dikemas_Kini_Pada: now }
    await callSheet({ sheet: cfg.sheet, action: "update", keyColumn: cfg.idKey, keyValue: body.id, data })
    await logAction(auth.user.email, auth.role, `KEMAS_KINI_${cfg.label}`, body.id, before, { ...before, ...data })
    return Response.json({ ok: true, id: body.id })
  }

  const id = idGenerator(rows, cfg.idKey, cfg.prefix)()
  const record = { [cfg.idKey]: id, ...v.data, Catatan: "", Dicipta_Pada: now, Dikemas_Kini_Pada: now }
  await callSheet({ sheet: cfg.sheet, action: "append", data: record })
  await logAction(auth.user.email, auth.role, `TAMBAH_${cfg.label}`, id, null, record)
  return Response.json({ ok: true, id })
}

async function tukarStatus(auth: any, cfg: any, body: any) {
  const rows = await listSheet(cfg.sheet)
  const before = rows.find(r => r[cfg.idKey] === body.id)
  if (!before) return Response.json({ error: "Rekod tidak dijumpai" }, { status: 404 })

  const status = body.aktif ? "Ya" : "Tidak"
  const data = { Status_Aktif: status, Dikemas_Kini_Pada: nowText() }
  await callSheet({ sheet: cfg.sheet, action: "update", keyColumn: cfg.idKey, keyValue: body.id, data })
  await logAction(auth.user.email, auth.role, `STATUS_${cfg.label}`, body.id, before, { ...before, ...data })
  return Response.json({ ok: true })
}

async function importCsv(auth: any, cfg: any, body: any) {
  const mode = body.mode === "commit" ? "commit" : "preview"
  const rawRows: any[] = Array.isArray(body.rows) ? body.rows.slice(0, MAX_IMPORT) : []
  if (!rawRows.length) return Response.json({ error: "Tiada baris untuk diimport" }, { status: 400 })

  const rows = await listSheet(cfg.sheet)
  const namaWujud = new Set(rows.map(r => norm(r[cfg.namaKey])))
  const seen = new Set<string>()

  const hasil = rawRows.map((r, i) => {
    const baris = i + 2
    const v = cfg.valid(r)
    if (!v.ok) return { baris, status: "Ralat", mesej: v.mesej, nama: String(r[cfg.namaKey] ?? "") }

    const nama = v.data[cfg.namaKey]
    const k = norm(nama)
    if (namaWujud.has(k)) return { baris, status: "Wujud", mesej: "Nama sudah ada", nama }
    if (seen.has(k)) return { baris, status: "Pendua", mesej: "Nama berulang dalam fail", nama }
    seen.add(k)
    return { baris, status: "OK", mesej: "Akan ditambah", nama, data: v.data }
  })

  const stripData = (h: any) => ({ baris: h.baris, status: h.status, mesej: h.mesej, nama: h.nama })
  const ringkasan = {
    ok: hasil.filter(h => h.status === "OK").length,
    ralat: hasil.filter(h => h.status === "Ralat").length,
    wujud: hasil.filter(h => h.status === "Wujud").length,
    pendua: hasil.filter(h => h.status === "Pendua").length,
  }

  if (mode === "preview") {
    return Response.json({ hasil: hasil.map(stripData), ringkasan })
  }

  const now = nowText()
  const idGen = idGenerator(rows, cfg.idKey, cfg.prefix)
  const records = hasil
    .filter(h => h.status === "OK")
    .map(h => ({ [cfg.idKey]: idGen(), ...h.data, Catatan: "", Dicipta_Pada: now, Dikemas_Kini_Pada: now }))

  if (records.length) {
    await callSheet({ sheet: cfg.sheet, action: "append_batch", rows: records })
  }
  await logAction(auth.user.email, auth.role, `IMPORT_${cfg.label}`, `${records.length} rekod`, null, { ringkasan })

  return Response.json({ ok: true, ditambah: records.length, ringkasan, hasil: hasil.map(stripData) })
}

export default async (req: Request) => {
  const auth = await requireUser(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  try {
    if (req.method === "GET") {
      const [guru, kelas] = await Promise.all([listSheet("Guru"), listSheet("Kelas")])
      return Response.json({
        guru: guru.filter(g => g.ID_Guru),
        kelas: kelas.filter(k => k.ID_Kelas),
      })
    }

    if (req.method !== "POST") return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })

    const body: any = await req.json().catch(() => null)
    if (!body) return Response.json({ error: "Data tidak sah" }, { status: 400 })

    const cfg = CFG[body.jenis]
    if (!cfg) return Response.json({ error: "Jenis tidak sah" }, { status: 400 })

    if (body.action === "simpan") return await simpan(auth, cfg, body)
    if (body.action === "tukar_status") return await tukarStatus(auth, cfg, body)
    if (body.action === "import") return await importCsv(auth, cfg, body)

    return Response.json({ error: "Tindakan tidak sah" }, { status: 400 })
  } catch (e) {
    return errorResponse(e)
  }
}
