type Role = "admin" | "admin_utama"

type AuthOk = { ok: true; user: { id: string; email: string }; role: Role }
type AuthFail = { ok: false; status: number; error: string }

export async function requireUser(
  req: Request,
  minRole: Role = "admin"
): Promise<AuthOk | AuthFail> {
  const header = req.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token) {
    return { ok: false, status: 401, error: "Log masuk diperlukan" }
  }

  const base = Netlify.env.get("APP_BASE_URL")
  if (!base) {
    return { ok: false, status: 500, error: "Konfigurasi tidak lengkap" }
  }

  let res: Response
  try {
    res = await fetch(`${base}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { ok: false, status: 503, error: "Perkhidmatan log masuk tidak tersedia" }
  }
  if (!res.ok) {
    return { ok: false, status: 401, error: "Sesi tidak sah. Sila log masuk semula" }
  }

  const user = await res.json()
  const roles: string[] = user?.app_metadata?.roles || []
  const role: Role | null = roles.includes("admin_utama")
    ? "admin_utama"
    : roles.includes("admin")
      ? "admin"
      : null

  if (!role) {
    return { ok: false, status: 403, error: "Akaun ini tidak mempunyai akses admin" }
  }
  if (minRole === "admin_utama" && role !== "admin_utama") {
    return { ok: false, status: 403, error: "Hanya Admin Utama boleh melakukan tindakan ini" }
  }

  return { ok: true, user: { id: user.id, email: user.email }, role }
}
