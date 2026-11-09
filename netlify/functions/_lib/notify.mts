import { callSheet, listSheet } from "./sheets.mts"

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c] as string))

export async function notifyPemohon(idGuru: string, subject: string, lines: string[]) {
  try {
    const guru = await listSheet("Guru")
    const g = guru.find(x => x.ID_Guru === idGuru)
    const email = String(g?.Emel || "").trim()
    if (!email.includes("@")) {
      console.warn("notifyPemohon: emel tiada untuk", idGuru)
      return false
    }

    const base = (Netlify.env.get("APP_BASE_URL") || "").replace(/\/$/, "")
    const logo = base ? `${base}/assets/img/logo.png` : ""

    const header = `
      <div style="background:#102b50;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
        ${logo ? `<img src="${logo}" alt="Logo SMK Munshi Abdullah" width="90" style="display:block;margin:0 auto 10px;">` : ""}
        <div style="color:#60c7ff;font-size:20px;font-weight:bold;font-family:Arial,sans-serif;">e-RELIEF</div>
        <div style="color:#c4d8f2;font-size:13px;font-family:Arial,sans-serif;">SMK Munshi Abdullah</div>
      </div>`

    const body = lines
      .map(l => `<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">${esc(l)}</p>`)
      .join("")

    const html = `
      <div style="max-width:560px;margin:0 auto;border:1px solid #d0d7e2;border-radius:10px;font-family:Arial,sans-serif;">
        ${header}
        <div style="padding:20px;">${body}</div>
        <div style="padding:12px 20px;background:#f3f6fa;border-radius:0 0 10px 10px;font-size:12px;color:#5a6b80;">
          Emel ini dihantar secara automatik oleh sistem e-RELIEF. Sila jangan balas emel ini.
        </div>
      </div>`

    await callSheet({ action: "notify", to: email, subject, html })
    return true
  } catch (e) {
    console.error("notifyPemohon:", e instanceof Error ? e.message : String(e))
    return false
  }
}
