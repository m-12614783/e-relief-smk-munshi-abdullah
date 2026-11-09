import { listSheet, callSheet, errorResponse } from "./_lib/sheets.mts"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_SEBAB = 200
const MAX_CATATAN = 300

// Had kadar ringkas: 5 permohonan setiap 10 minit bagi setiap IP
const hits = new Map<string, number[]>()
function kadarOk(ip: string) {
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000)
  if (arr.length >= 5) {
    hits.set(ip, arr)
    return false
  }
  arr.push(now)
  hits.set(ip, arr)
  return true
}

// Masa waktu Malaysia sekarang
const sekarangMY = () => new Date(Date.now() + 8 * 3600 * 1000)
const hariIni = () => sekarangMY().toISOString().slice(0, 10)
const masaSekarang = () => sekarangMY().toISOString().slice(11, 16)
const capMasa = () => sekarangMY().toISOString().slice(0, 16).replace("T", " ")

// Tukar apa-apa bentuk tarikh kepada yyyy-MM-dd
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

export default async (req: Request) => {
  try {
    // ----- Senarai guru dan kelas untuk borang -----
    if (req.method === "GET") {
      const [guru, kelas] = await Promise.all([listSheet("Guru"), listSheet("Kelas")])
      return Response.json(
        {
          guru: guru
            .filter(g => g.ID_Guru && String(g.Status_Aktif) === "Ya")
            .map(g => ({ id: g.ID_Guru, nama: g.Nama })),
          kelas: kelas
            .filter(k => k.ID_Kelas && String(k.Status_Aktif) === "Ya")
            .map(k => ({ id: k.ID_Kelas, nama: k.Nama_Kelas })),
        },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Kaedah tidak sah" }, { status: 405 })
    }

    // ----- Terima permohonan -----
    const ip = req.headers.get("x-nf-client-connection-ip") || "unknown"
    if (!kadarOk(ip)) {
      return Response.json(
        { error: "Terlalu banyak permohonan. Sila cuba semula dalam beberapa minit." },
        { status: 429 }
      )
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Data tidak sah" }, { status: 400 })
    }

    // Medan perangkap: pengguna biasa tidak nampak medan ini, bot akan mengisinya
    if (body.website) {
      return Response.json({ ok: true })
    }

    const input = {
      ID_Guru: String(body.ID_Guru || "").trim(),
      Tarikh: String(body.Tarikh || "").trim(),
      Masa_Mula: String(body.Masa_Mula || "").trim(),
      Masa_Tamat: String(body.Masa_Tamat || "").trim(),
      ID_Kelas: String(body.ID_Kelas || "").trim(),
      Sebab: String(body.Sebab || "").trim(),
      Catatan: String(body.Catatan || "").trim(),
    }

    // Semakan asas
    const ralat: string[] = []
    if (!input.ID_Guru) ralat.push("Pilih nama guru")
    if (!DATE_RE.test(input.Tarikh)) ralat.push("Tarikh tidak sah")
    if (!TIME_RE.test(input.Masa_Mula) || !TIME_RE.test(input.Masa_Tamat)) {
      ralat.push("Masa tidak sah")
    } else if (input.Masa_Mula >= input.Masa_Tamat) {
      ralat.push("Masa tamat mesti selepas masa mula")
    }
    if (!input.ID_Kelas) ralat.push("Pilih kelas")
    if (!input.Sebab) ralat.push("Sebab permohonan wajib diisi")
    if (input.Sebab.length > MAX_SEBAB) ralat.push(`Sebab tidak boleh melebihi ${MAX_SEBAB} aksara`)
    if (input.Catatan.length > MAX_CATATAN) ralat.push(`Catatan tidak boleh melebihi ${MAX_CATATAN} aksara`)
    if (ralat.length) return Response.json({ error: ralat.join(". ") }, { status: 400 })

    // Tarikh dan masa tidak boleh sudah berlalu
    const today = hariIni()
    if (input.Tarikh < today) {
      return Response.json({ error: "Tarikh permohonan telah berlalu" }, { status: 400 })
    }
    if (input.Tarikh === today && input.Masa_Mula < masaSekarang()) {
      return Response.json({ error: "Masa mula telah berlalu untuk hari ini" }, { status: 400 })
    }

    // Semak guru dan kelas wujud dan aktif
    const [guru, kelas, permohonan] = await Promise.all([
      listSheet("Guru"),
      listSheet("Kelas"),
      listSheet("Permohonan Relief"),
    ])

    const guruAktif = guru.find(g => g.ID_Guru === input.ID_Guru && String(g.Status_Aktif) === "Ya")
    if (!guruAktif) return Response.json({ error: "Guru tidak dijumpai atau tidak aktif" }, { status: 400 })

    const kelasAktif = kelas.find(k => k.ID_Kelas === input.ID_Kelas && String(k.Status_Aktif) === "Ya")
    if (!kelasAktif) return Response.json({ error: "Kelas tidak dijumpai atau tidak aktif" }, { status: 400 })

    // Halang permohonan bertindih daripada guru yang sama
    const bertindih = permohonan.find(p =>
      p.ID_Guru === input.ID_Guru &&
      tarikhMY(p.Tarikh) === input.Tarikh &&
      (p.Status === "Baharu" || p.Status === "Diluluskan") &&
      masaHHmm(p.Masa_Mula) < input.Masa_Tamat &&
      input.Masa_Mula < masaHHmm(p.Masa_Tamat)
    )
    if (bertindih) {
      return Response.json(
        { error: "Anda sudah ada permohonan pada masa yang bertindih untuk tarikh ini" },
        { status: 409 }
      )
    }

    // Simpan
    const id = "P" + Date.now()
    const record = {
      ID_Permohonan: id,
      Cap_Masa: capMasa(),
      ID_Guru: input.ID_Guru,
      Tarikh: input.Tarikh,
      Masa_Mula: input.Masa_Mula,
      Masa_Tamat: input.Masa_Tamat,
      ID_Kelas: input.ID_Kelas,
      Sebab: input.Sebab,
      Catatan: input.Catatan,
      Status: "Baharu",
    }

    await callSheet({ sheet: "Permohonan Relief", action: "append", data: record })

    return Response.json({ ok: true, ID_Permohonan: id })
  } catch (e) {
    return errorResponse(e)
  }
}
