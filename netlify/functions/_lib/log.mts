import { callSheet } from "./sheets.mts"

export async function logAction(
  email: string,
  role: string,
  action: string,
  target: string,
  before: unknown,
  after: unknown
) {
  await callSheet({
    sheet: "Rekod Aktiviti",
    action: "append",
    data: {
      ID_Log: "L" + Date.now() + Math.random().toString(36).slice(2, 6),
      Masa: new Date().toISOString(),
      Pengguna_Emel: email,
      Peranan: role,
      Jenis_Tindakan: action,
      Sasaran: target,
      Data_Sebelum: before ? JSON.stringify(before) : "",
      Data_Selepas: after ? JSON.stringify(after) : "",
    },
  })
}
