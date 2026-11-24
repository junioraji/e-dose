# Panduan Instalasi — e-Dose Agora (QC Absolut Linac · IAEA TRS-398)

Arsitektur: **Google Apps Script** = backend REST API + database Google Sheets · **GitHub Pages** = frontend (HTML/CSS/JS murni).

```
Browser (GitHub Pages)  ──fetch POST (text/plain, JSON)──▶  Apps Script /exec  ──▶  Google Sheets
   cache lokal + antrean simpan                               validasi & hitung ulang TRS-398
```

> 💡 **Coba dulu tanpa server:** buka `index.html` dari GitHub Pages dengan `GAS_URL` masih kosong → aplikasi berjalan dalam **Mode Demo** (data contoh, isi password apa saja).

---

## BAGIAN A — Backend (Google Apps Script)

### A1. Buat proyek & tempel 4 file kode
1. Buka https://script.google.com → **Proyek baru**. Beri nama `e-Dose Agora API`.
2. Rename file `Code.gs` → **`Kode`**, lalu tempel seluruh isi **`Kode.gs`**.
3. Klik **＋ → Skrip** tiga kali, beri nama dan tempel isinya:

   | Nama file di editor | Isi dari berkas |
   |---|---|
   | `Trs398Engine` | `Trs398Engine.gs` |
   | `AppModel` | `AppModel.gs` |
   | `Laporan` | `Laporan.gs` |

   ⚠️ Ketiga file ini **identik** dengan `js/trs398.js`, `js/model.js`, `js/report.js` di frontend. Kalau suatu saat rumus diubah, salin ulang ke kedua sisi agar angka browser = angka server.
4. **Setelan proyek** (ikon ⚙️) → centang **"Tampilkan file manifes appsscript.json"** → buka `appsscript.json` → ganti isinya dengan berkas **`appsscript.json`** (zona waktu `Asia/Jakarta`).
5. Klik 💾 Simpan.

### A2. Jalankan setup — **SEKALI SAJA**
1. Dropdown fungsi → pilih **`setupAppEnvironment`** → ▶ **Jalankan**.
2. Klik **Tinjau izin** → pilih akun → *Advanced* → *Go to e-Dose Agora API* → **Izinkan** (Sheets, Drive, kirim email, trigger).
3. Buka **Log eksekusi**. Pastikan muncul:
   ```
   ✅ Setup selesai!
   LOGIN ADMIN  username : admin
                password : xxxxxxxxxxxx   ← CATAT
   ✅ Trigger terpasang: dailyCalibrationCheck (07:00 WIB) & warmup (10 menit)
   ```
4. Cek Google Drive: folder **📁 e-Dose Agora — QC Absolut Linac** berisi spreadsheet **🗃️ Database** dengan 7 sheet: `App_Config`, `Master_Personnel`, `Master_Linac_Energy`, `Master_Detector`, `Ref_kQ_TRS398`, `Trans_QC_Absolut`, `Log_Notifications`.

> Menjalankan `setupAppEnvironment()` lagi tidak akan membuat duplikat — fungsi menolak bila sudah pernah dijalankan.
> Opsional untuk latihan: jalankan `seedDemoTransactions()` untuk mengisi 6 bulan data contoh. **Jangan** di database klinis.

### A3. Deploy sebagai Web App
1. **Terapkan → Deployment baru** → ikon ⚙️ → **Aplikasi web**.
2. *Jalankan sebagai*: **Saya** · *Yang memiliki akses*: **Siapa saja**.
3. **Terapkan** → salin **URL aplikasi web** (berakhiran `/exec`).
4. Uji di browser: `URL/exec?action=ping` → harus tampil `{"success":true,"app":"e-Dose Agora",...}`.

> "Siapa saja" diperlukan agar browser bisa memanggil API. Data tetap aman: semua aksi selain `ping` & `login` wajib token login (HMAC-SHA256), password disimpan sebagai hash + salt di Script Properties, dan login dikunci 10 menit setelah 5x gagal.

> 🔁 **Setiap kali mengubah kode .gs:** Terapkan → *Kelola deployment* → ✏️ → Versi: **Versi baru** → Terapkan. URL `/exec` tetap sama.

---

## BAGIAN B — Frontend (GitHub Pages)

### B1. Isi URL backend
Buka **`js/config.js`**, tempel URL `/exec`:
```js
GAS_URL: 'https://script.google.com/macros/s/AKfy....../exec',
```

### B2. Pastikan struktur folder benar (sebelum `git init`)
Folder hasil ekstrak ZIP **adalah** folder repository. Jalankan `dir` (PowerShell) atau `ls` — baris teratas harus terlihat `index.html`:
```
e-dose-agora\          ← git init DI SINI
├── index.html
├── .nojekyll
├── README.md
├── PANDUAN-INSTALASI.md
├── css\style.css
└── js\  (config.js, trs398.js, model.js, report.js, api.js, ui.js, app.js, page-*.js)
```
Jangan memasukkan file `.gs` ke folder ini.

### B3. Push ke GitHub
Buat repository **Public** baru di github.com (tanpa centang README). Lalu dari folder di atas:
```bash
git init
git add .
git commit -m "Upload pertama e-Dose Agora"
git branch -M main
git remote add origin https://github.com/USERNAME/e-dose-agora.git
git push -u origin main
```
Saat diminta password, tempel **Personal Access Token** (github.com/settings/tokens → *classic* → centang **repo**), bukan password akun. Layar memang tidak menampilkan karakter saat mengetik token — itu normal.

### B4. Aktifkan Pages
Repository → **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main / (root)** → **Save** → centang **Enforce HTTPS**. Setelah 1–2 menit situs aktif di `https://USERNAME.github.io/e-dose-agora/`.

### B5. Update di kemudian hari
```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```
Jika browser masih menampilkan versi lama, naikkan angka `?v=1.0.0` di `index.html` (mis. `?v=1.0.1`) lalu push, atau tekan **Ctrl+Shift+R**.

---

## BAGIAN C — Konfigurasi awal di aplikasi (wajib sebelum Go-Live)

Login dengan `admin` + password dari log, lalu:

1. **Pengaturan → Akun Admin** — ganti password.
2. **Pengaturan → Profil Rumah Sakit** — nama RS, instalasi, alamat, logo kop, Kepala Departemen.
3. **Pengaturan → Profil Fismed & Kadep** — ganti personel contoh dengan tim Anda (nama, STR/NIP, email).
4. **Pengaturan → Notifikasi Email** — isi email penerima, klik **Pakai URL ini** untuk URL aplikasi, lalu **Kirim Email Uji**.
5. **Pesawat Linac & Energi** — ganti pesawat contoh: TPR20,10 / R50, z_ref, PDD(z_ref) atau TMR(z_ref), baseline output, k_pol & k_s tersimpan.
6. **Detektor & Tabel kQ → Daftar Detektor** — chamber & elektrometer Anda: N_D,w (cGy/nC atau Gy/C), k_elec, sertifikat, tanggal kedaluwarsa.
7. **Detektor & Tabel kQ → Tabel Referensi kQ** — sudah berisi data resmi **IAEA TRS-398 Rev. 1** (Pers. 34/Tabel 45 foton, Tabel 20 elektron). Pastikan chamber Anda bertanda ✓ Foton/Elektron di Daftar Detektor. Bila punya kQ terukur dari SSDL, masukkan lewat **Tempel Tabel** — data Anda menggantikan nilai generik untuk chamber itu.
8. **Pengaturan → Kebijakan Toleransi** — default Warning ±1.0%, Action ±2.0%, T₀ 20 °C, P₀ 101.325 kPa.

### Verifikasi kriteria penerimaan PRD (§8)
- **Akurasi:** isi satu pengukuran nyata, bandingkan k_TP, M_Q, D_w(z_ref), D_w(z_max), output & deviasi dengan lembar kerja manual TRS-398 Anda (target selisih ≤ 0.01%). Koefisien k_s dua-tegangan (berkas pulsa) ada di `Trs398Engine.gs` → `KS_COEF_PULSED` — cocokkan dengan salinan TRS-398 Anda.
- **Alur adjustment:** buat As-Found di atas Action Level → otomatis ke halaman Adjustment → iterasi sampai PASS → status `PASS (Cleared)`, As-Found tetap utuh di grafik & PDF.
- **Email:** simpan satu As-Found FAIL → cek email `[ALERT QC ABSOLUT]`.

---

## Cara kerja "tanpa loading lama"

| Aksi | Yang terjadi | Waktu tunggu |
|---|---|---|
| Login | 1 panggilan: token + seluruh data sekaligus | ±1–3 dtk (sekali) |
| Buka ulang aplikasi | Tampil dari cache perangkat, sinkron di latar | instan |
| Pindah halaman / filter / grafik | Dari memori, 0 panggilan server | instan |
| Kalkulasi TRS-398 saat mengetik | Di browser, mesin yang sama dengan server | instan |
| Simpan QC / adjustment / master | UI berubah seketika, server menyusul via antrean; server menghitung ulang & bisa menolak (perubahan lokal dibatalkan + notifikasi) | instan |
| Internet putus | Perubahan antre (indikator "Offline · n antre") dan terkirim otomatis saat online | — |
| Sinkron latar | Server cukup menjawab "unchanged" bila versi data sama | ringan |
| Unduh PDF resmi | Dibuat server dari data tersimpan | ±3–8 dtk |
| Cetak Langsung | Pratinjau A4 di browser → *Save as PDF* | instan |

Trigger `warmup` tiap 10 menit menjaga server Apps Script tetap "hangat" sehingga panggilan pertama tidak lambat.

---

## Memperbarui ke versi baru (mis. v1.0 → v1.1)

Data di Google Sheets **tidak perlu diubah dan setup TIDAK dijalankan ulang**.

1. **Backend:** di editor Apps Script, ganti seluruh isi `Kode`, `Trs398Engine`, `AppModel`, `Laporan` dengan berkas versi baru → 💾 Simpan → **Terapkan → Kelola deployment → ✏️ → Versi: Versi baru → Terapkan**. Kolom baru (mis. `m_minus_list`, `m_v2_list` di v1.1) ditambahkan otomatis ke sheet pada panggilan pertama.
2. **Frontend:** timpa isi folder repo dengan isi ZIP baru, **kecuali `js/config.js`** (simpan `GAS_URL` Anda), lalu:
   ```bash
   git add .
   git commit -m "Update e-Dose Agora v1.1"
   git push
   ```
   Versi file sudah dinaikkan (`?v=1.1.0`), jadi browser otomatis memuat versi baru.

### Perubahan v1.2 — data resmi IAEA TRS-398 Rev. 1 (2024)
- **k_Q foton**: Pers. (34) dengan konstanta a, b Tabel 45 untuk 26 tipe chamber — nilai pas pada TPR20,10 berapa pun (mereproduksi Tabel 16 dalam ±0.0001), rentang 0.56–0.82.
- **k_Q elektron**: Tabel 20 (8 chamber) dengan interpolasi linier; chamber silindris hanya untuk R50 ≥ 3 g/cm² (Tabel 19).
- **k_s**: Tabel 10 + Pers. (13); rasio V1/V2 di luar tabel memakai Pers. (14). Peringatan bila V1/V2 < 3.
- **k_vol (baru)** untuk berkas FFF: Pers. (22) dari panjang rongga chamber (Tabel 4) dan SDD, atau nilai dari profil terukur. Masuk ke M_Q.
- **Pustaka chamber** (Tabel 4, 5, 45) untuk mengisi otomatis model, tipe & panjang rongga di Master Detektor; nama model dicocokkan toleran ("PTW 30013" = "PTW 30013 Farmer").
- **Migrasi otomatis** database lama: baris kQ "CONTOH" diganti data Rev. 1; baris kQ yang Anda isi sendiri (mis. sertifikat SSDL) dipertahankan; energi berlabel FFF ditandai; panjang rongga chamber yang dikenal diisi.
- Kartu k_pol & k_s di Input QC kini simetris dan sejajar per baris.

### Perubahan v1.1
- Hapus permanen untuk personel, detektor, energi & pesawat yang **belum pernah dipakai** di pengukuran (yang sudah dipakai tetap hanya bisa dinonaktifkan agar riwayat & laporan utuh).
- Judul menu menjadi **Master Pesawat Linac & Energi**.
- Form edit tidak lagi tertutup saat di-scroll.
- Input QC ditata ulang: pilih energi lewat chip (✓ = sudah diukur bulan ini), tombol Enter berpindah kolom.
- k_pol: **M+ = rata-rata bacaan rutin**, **M− = rata-rata ulangan polaritas terbalik** (3–5 kali).
- k_s: **M1 = rata-rata bacaan rutin (V1)**, **M2 = rata-rata ulangan pada V2** (3–5 kali).
- Sidebar ringkas: seluruh menu terlihat tanpa scroll (layar ≥ 600 px tinggi).

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Situs GitHub 404 | `index.html` tidak di root repo — `git init` dijalankan di folder yang salah. Lihat B2. |
| Login: "Tidak dapat terhubung ke server" | `GAS_URL` salah/kosong, atau deployment bukan "Siapa saja". Uji `URL/exec?action=ping`. |
| Perubahan .gs tidak berlaku | Belum membuat **Versi baru** di Kelola deployment. |
| "Sesi berakhir" | Token kedaluwarsa (12 jam, atau 30 hari bila "Ingat perangkat") atau password diganti. Login ulang. |
| Lupa password | Editor Apps Script → jalankan `resetAdminPassword()` → password baru di log. |
| Email tidak terkirim | Isi penerima di Pengaturan → Notifikasi; cek `Log_Notifications`. Kuota MailApp akun Gmail biasa ±100/hari. |
| "Tabel kQ ... belum ada" / "di luar rentang" | Tambah baris kQ untuk model chamber & jenis berkas tsb. Sistem sengaja tidak mengekstrapolasi. |
| Data di HP tidak sama dengan PC | Tunggu sinkron latar (≤2 menit) atau Pengaturan → Akun Admin → **Muat Ulang Data dari Server**. |

Struktur sheet mengikuti PRD §4 dengan beberapa kolom tambahan untuk audit (snapshot `pdd_used`, `baseline_used`, `quality_index`, mode k_pol/k_s, kategori & tiket adjustment, `edit_log`). Jangan mengubah nama kolom baris pertama secara manual.
