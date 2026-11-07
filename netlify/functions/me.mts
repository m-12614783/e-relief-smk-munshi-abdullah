import { requireUser } from "./_lib/auth.mts"

export default async (req: Request) => {
  const result = await requireUser(req)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }
  return Response.json({ email: result.user.email, role: result.role })
}
