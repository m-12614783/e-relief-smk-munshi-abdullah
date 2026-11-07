export async function callSheet(payload: Record<string, unknown>): Promise<any> {
  const url = Netlify.env.get("APPS_SCRIPT_URL")
  const secret = Netlify.env.get("APPS_SCRIPT_SECRET")
  if (!url || !secret) throw new Error("CONFIG")

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ ...payload, secret }),
      redirect: "follow",
    })
  } catch {
    throw new Error("NETWORK")
  }

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("BADRESP:" + res.status + ":" + text.slice(0, 120).replace(/\s+/g, " "))
  }
  if (!data.ok) throw new Error(data.error || "SHEET")
  return data
}

export async function listSheet(sheet: string): Promise<Record<string, string>[]> {
  const data = await callSheet({ sheet, action: "list" })
  return data.rows
}

export function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "SHEET"
  if (msg.startsWith("BADRESP:")) {
    return Response.json(
      { error: "Respons tidak sah dari Apps Script: " + msg.slice(8) },
      { status: 500 }
    )
  }
  const map: Record<string, string> = {
    CONFIG: "Konfigurasi tidak lengkap",
    NETWORK: "Tidak dapat menghubungi Google Sheets",
  }
  return Response.json({ error: map[msg] || msg }, { status: 500 })
}
