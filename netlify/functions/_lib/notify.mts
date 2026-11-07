import { callSheet, listSheet } from "./sheets.mts"

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c] as string))

export async function notifyPemohon(idGuru: string, subject: string, lines: string[]) {
  try {
    const guru = await listSheet("Guru")
    const g = guru.find(x => x.ID_Guru === idGuru)
    const email = String(g?.Emel || "").trim()
    if (!email.includes("@")) return false

    const html = lines.map(l => `<p>${esc(l)}</p>`).join("")
    await callSheet({ action: "notify", to: email, subject, html })
    return true
  } catch {
    return false
  }
}
