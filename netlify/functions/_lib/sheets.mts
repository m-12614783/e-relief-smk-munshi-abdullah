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
    })
  } catch {
    throw new Error("NETWORK")
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error("BADRESP")
  }
  if (!data.ok) throw new Error(data.error || "SHEET")
  return data
}

export async function listSheet(sheet: string): Promise<Record<string, string>[]> {
  const data = await callSheet({ sheet, action: "list" })
  return data.rows
}

export function errorResponse(e: unknown) {
  const code = e instanceof Error ? e.message : "SHEET"
  const map: Record<string, string> = {
    CONFIG: "Konfigurasi tidak lengkap",
    NETWORK: "Tidak dapat menghubungi Google Sheets",
    BADRESP: "Respons Google Sheets tidak sah",
  }
  return Response.json({ error: map[code] || code }, { status: 500 })
}
