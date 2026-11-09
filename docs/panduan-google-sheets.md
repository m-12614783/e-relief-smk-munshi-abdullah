# Panduan Google Sheets e-RELIEF

Fail: **Sistem Pengurusan Guru Relief**

## Helaian
| Helaian | Kegunaan |
|---|---|
| Guru | Senarai guru, emel, status aktif, kod pengesahan (lajur H hingga J) |
| Kelas | Senarai kelas dan status aktif |
| Jadual Relief | Jadual yang sudah diluluskan |
| Permohonan Relief | Semua permohonan (dari borang laman dan Form) |
| Rekod Aktiviti | Log semua tindakan penting (hanya baca) |
| Tetapan Sistem | Tetapan umum |

## Peraturan penting
1. **Jangan tukar nama lajur** pengepala (baris 1). Aplikasi merujuk nama ini.
2. **Jangan padam baris** dalam Jadual Relief. Gunakan butang **Padam** dalam aplikasi, supaya sejarah kekal.
3. **Status_Aktif** mesti `Ya` atau `Tidak`.
4. Format **Tarikh** ialah `YYYY-MM-DD`, dan masa ialah `HH:mm` (contoh `08:00`).
5. Lajur **Kod_Hash**, **Gagal_Cubaan** dan **Kunci_Hingga** di helaian Guru diurus oleh sistem. Jangan ubah.
6. **Status_Tugasan** hanya `Dirancang`, `Selesai` atau `Dibatalkan`.

## Menambah guru secara manual
Disyorkan melalui laman **Guru & Kelas**. Jika mesti di Sheets, isi `ID_Guru` yang unik (G014, G015, dan seterusnya), `Nama` dalam huruf besar, dan `Status_Aktif` = `Ya`.

## Kebenaran
Fail ini dikongsi dengan akaun perkhidmatan Apps Script. Jangan kongsi dengan pihak luar tanpa kebenaran pentadbir sekolah.
