# e-Dose Agora — QC Absolut Linac (IAEA TRS-398)

Aplikasi web Fisikawan Medis untuk QC dosimetri absolut Linac: kalkulasi TRS-398 real-time, alur As-Found → Adjustment → As-Left, control chart, laporan PDF resmi, dan notifikasi email.

- **Frontend:** HTML/CSS/JS murni (folder ini) → GitHub Pages
- **Backend:** Google Apps Script REST API + Google Sheets (berkas `.gs` terpisah, tidak di repo ini)
- **Panduan lengkap:** [PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md)

## Struktur
```
index.html              Shell SPA + layar login
css/style.css           Design system Clinical Dosimetry (token Siloam)
js/config.js            ← isi GAS_URL di sini (kosong = Mode Demo)
js/trs398.js            Mesin kalkulasi TRS-398   (identik Trs398Engine.gs)
js/model.js             Skema sheet & model data  (identik AppModel.gs)
js/report.js            Control chart & laporan   (identik Laporan.gs)
js/api.js               Cache lokal, sinkron berversi, antrean simpan optimistis
js/ui.js, js/app.js     Komponen UI, router, navigasi
js/page-*.js            Dashboard, Input QC, Adjustment, Riwayat, Laporan, Master, Pengaturan
```

## Rumus inti
k_TP = ((273.2+T)/(273.2+T₀))·(P₀/P) · M_Q = M_raw·k_TP·k_elec·k_pol·k_s · D_w(z_ref) = M_Q·N_D,w·k_Q,Q0 ·
D_w(z_max) = D_w(z_ref)/(PDD/100) [SSD] atau /TMR [SAD] · Output = D_w(z_max)/MU · Deviasi = (Output−Baseline)/Baseline·100%

Status: PASS ≤ Warning < WARNING ≤ Action < FAIL (deviasi dibulatkan 2 desimal, sama dengan tampilan & laporan).

> ⚠️ Tabel kQ bawaan adalah **contoh**. Ganti dengan nilai resmi TRS-398 sebelum digunakan klinis.
