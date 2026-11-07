type Item = {
  ID_Jadual?: string
  Tarikh: string
  Masa_Mula: string
  Masa_Tamat: string
  ID_Kelas: string
  ID_Guru_Asal: string
  ID_Guru_Relief: string
}

function overlap(aS: string, aE: string, bS: string, bE: string) {
  return aS < bE && bS < aE
}

export function checkConflicts(item: Item, rows: Record<string, string>[]) {
  const errors: string[] = []
  const warnings: string[] = []

  const sameDay = rows.filter(r =>
    String(r.Dipadam) !== "Ya" &&
    r.Status_Tugasan !== "Dibatalkan" &&
    String(r.Tarikh) === item.Tarikh &&
    (!item.ID_Jadual || r.ID_Jadual !== item.ID_Jadual)
  )

  for (const r of sameDay) {
    const masa = `${r.Masa_Mula}-${r.Masa_Tamat}`
    const bertindih = overlap(item.Masa_Mula, item.Masa_Tamat,
                              String(r.Masa_Mula), String(r.Masa_Tamat))

    if (!bertindih) {
      if (r.ID_Guru_Relief === item.ID_Guru_Relief) {
        warnings.push(`Guru relief sudah mempunyai tugasan lain pada hari ini (${masa})`)
      }
      continue
    }

    if (r.ID_Guru_Relief === item.ID_Guru_Relief) {
      errors.push(`Guru relief bertindih dengan tugasan lain (${masa})`)
    }
    if (r.ID_Kelas === item.ID_Kelas) {
      errors.push(`Kelas ini sudah menerima relief pada ${masa}`)
    }
    if (r.ID_Guru_Asal === item.ID_Guru_Asal) {
      warnings.push(`Guru asal ini sudah ada jadual relief lain pada masa yang sama (${masa})`)
    }
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  }
}
