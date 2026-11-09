# Panduan Penyelenggaraan e-RELIEF

## Komponen sistem
| Bahagian | Lokasi |
|---|---|
| Laman dan fungsi server | Netlify (repository GitHub `m-12614783/e-relief-smk-munshi-abdullah`, branch `main`) |
| Pangkalan data | Google Sheets (lihat panduan Sheets) |
| Skrip penghubung | Apps Script (projek `e-relief-smk-munshi-abdullah-api`) |
| Log masuk | Netlify Identity |

## Rahsia (jangan kongsi)
| Nama | Di mana | Fungsi |
|---|---|---|
| `API_SECRET` | Apps Script → Script Properties | Melindungi skrip dari akses luar |
| `APPS_SCRIPT_SECRET` | Netlify → Environment variables | Mesti sama dengan `API_SECRET` |
| `PIN_SECRET` | Netlify → Environment variables | Mengira kod pengesahan guru. **Jangan tukar** kecuali perlu, kerana semua kod sedia ada akan tidak sah |
| `APPS_SCRIPT_URL` | Netlify | URL web app Apps Script |

## Menukar rahsia
1. Tukar `API_SECRET` di Apps Script, dan `APPS_SCRIPT_SECRET` di Netlify dengan nilai yang sama.
2. **Trigger deploy → Deploy site** di Netlify.
3. Uji halaman Guru & Kelas (Ctrl+F5). Jika senarai muncul, sambungan berjaya.

## Menukar kod Apps Script
1. Edit kod, kemudian **Deploy → Manage deployments → ikon pensel → New version → Deploy**.
2. URL tidak berubah.

## Menukar kod laman
1. Edit fail di GitHub, dan commit ke `main`.
2. Tunggu status **Published** di Netlify (biasanya 1 hingga 3 minit).
3. Tekan Ctrl+F5 pada halaman yang diubah.

## Jika ada ralat
| Mesej | Punca biasa | Tindakan |
|---|---|---|
| Konfigurasi tidak lengkap | Environment variable hilang | Semak nama dan nilai di Netlify |
| Tidak dibenarkan (dari Apps Script) | Secret tidak sepadan | Samakan `API_SECRET` dan `APPS_SCRIPT_SECRET` |
| Respons Google Sheets tidak sah | URL Apps Script salah atau versi lama | Semak URL dan buat New version |
| Akses ditolak | Role belum ditetapkan | Semak Roles di Netlify Identity |

## Log dan semakan
- **Netlify → Cloud compute → Functions → Logs**: ralat fungsi server.
- **Apps Script → Executions**: panggilan ke skrip.
- **Google Sheets → Rekod Aktiviti**: semua tindakan pentadbir.

## Sandaran
- Google Sheets: **File → Version history** sudah menyimpan sejarah automatik. Buat salinan fail sekali setiap bulan (**File → Make a copy**).
- GitHub menyimpan semua versi kod.

## Penyelenggaraan berkala
- **Setiap bulan**: semak senarai guru dan kelas, nyahaktifkan yang tidak lagi bertugas.
- **Setiap semester**: semak senarai Admin dan Admin Utama di Netlify Identity.
- **Jika pentadbir berhenti**: nyahaktifkan akaunnya segera.
- **Jika kod guru bocor**: jana semula kod untuk guru berkenaan.
