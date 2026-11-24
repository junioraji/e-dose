/* =====================================================================
 * e-Dose Agora — Mesin Kalkulasi IAEA TRS-398
 * ---------------------------------------------------------------------
 * FILE BERSAMA: isi file ini IDENTIK dengan Trs398Engine.gs di Apps Script.
 * Browser memakainya untuk pratinjau real-time, server memakainya untuk
 * menghitung ulang & memvalidasi sebelum data disimpan. Jika Anda mengubah
 * rumus, ubah KEDUA salinan (atau salin ulang file ini ke GAS).
 * Tidak boleh memakai window/document di file ini.
 * Sumber data: IAEA TRS-398 Rev. 1 (2024), https://doi.org/10.61092/iaea.ve7q-y94k
 * ===================================================================== */
var TRS398 = (function () {
  'use strict';

  /* ===================================================================
   * PUSTAKA IAEA TRS-398 Rev. 1 (2024) — disalin dari dokumen resmi
   * =================================================================== */
  /* Tabel 10 — koefisien kuadrat k_s metode dua tegangan (Pers. 13). Kunci = V1/V2 */
  var KS_COEF_PULSED = {
    '2.0': [2.337, -3.636, 2.299],
    '2.5': [1.474, -1.587, 1.114],
    '3.0': [1.198, -0.875, 0.677],
    '3.5': [1.080, -0.542, 0.463],
    '4.0': [1.022, -0.363, 0.341],
    '5.0': [0.975, -0.188, 0.214]
  };
  var KS_COEF_PULSED_SCANNED = {
    '2.0': [4.711, -8.242, 4.533],
    '2.5': [2.719, -3.977, 2.261],
    '3.0': [2.001, -2.402, 1.404],
    '3.5': [1.665, -1.647, 0.984],
    '4.0': [1.468, -1.200, 0.734],
    '5.0': [1.279, -0.750, 0.474]
  };
  /* Tabel 45 → Pers. (34): kQ(TPR) = [1+exp((a−0.57)/b)] / [1+exp((a−TPR)/b)], kalibrasi 60Co.
   * Diverifikasi: mereproduksi seluruh Tabel 16 (26 chamber × 12 titik) dalam ±0.0001. */
  var PHOTON_EQ34 = [
    ["Capintec PR-06C Farmer", 1.06833, -0.08262],
    ["Exradin A1SL Miniature", 1.21633, -0.13351],
    ["Exradin A12 Farmer", 1.09783, -0.09544],
    ["Exradin A12S Short Farmer", 1.11499, -0.10057],
    ["Exradin A18", 1.10487, -0.0967],
    ["Exradin A19 Classic Farmer", 1.12024, -0.10493],
    ["Exradin A26", 1.09587, -0.09383],
    ["Exradin A28", 1.12453, -0.10278],
    ["IBA CC13", 1.11441, -0.1026],
    ["IBA CC25", 1.08981, -0.09254],
    ["IBA FC23-C Short Farmer", 1.09189, -0.09346],
    ["IBA FC65-G Farmer", 1.09752, -0.09642],
    ["IBA FC65-P Farmer", 1.12374, -0.10784],
    ["NE 2561/2611A Secondary standard", 1.07699, -0.08732],
    ["NE 2571 Farmer", 1.08918, -0.09222],
    ["PTW 30010 Farmer", 1.12594, -0.1074],
    ["PTW 30011 Farmer", 1.1085, -0.10107],
    ["PTW 30012 Farmer", 1.12442, -0.10415],
    ["PTW 30013 Farmer", 1.18273, -0.13256],
    ["PTW 31010 Semiflex", 1.23755, -0.15295],
    ["PTW 31013 Semiflex", 1.19297, -0.13366],
    ["PTW 31016 PinPoint 3D", 1.1165, -0.10841],
    ["PTW 31021 Semiflex 3D", 1.29612, -0.16514],
    ["PTW 31022 PinPoint 3D", 1.14435, -0.1113],
    ["Sun Nuclear SNC125c", 1.097, -0.09749],
    ["Sun Nuclear SNC600c Farmer", 1.068, -0.08485]
  ];
  /* Tabel 20 — kQ elektron, kalibrasi 60Co, vs R50 (g/cm²). Silindris hanya R50 ≥ 3.0 (Tabel 19). */
  var ELECTRON_T20 = [
    ["PTW 34001 Roos", [1.0, 1.4, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.9743, 0.9645, 0.9518, 0.9428, 0.9349, 0.9281, 0.9222, 0.9171, 0.9127, 0.9088, 0.9055, 0.9001, 0.896, 0.8907]],
    ["IBA NACP-02", [1.0, 1.4, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.9679, 0.958, 0.9451, 0.936, 0.9281, 0.9214, 0.9155, 0.9104, 0.9061, 0.9023, 0.899, 0.8938, 0.8899, 0.8848]],
    ["NE 2571 Farmer", [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.9297, 0.9248, 0.921, 0.9181, 0.9157, 0.9137, 0.9121, 0.9095, 0.9075, 0.9047]],
    ["IBA FC65-G Farmer", [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.9328, 0.9279, 0.9241, 0.921, 0.9184, 0.9163, 0.9144, 0.9114, 0.909, 0.9055]],
    ["Exradin A12 Farmer", [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.9353, 0.9304, 0.9264, 0.9232, 0.9205, 0.9182, 0.9163, 0.913, 0.9104, 0.9066]],
    ["Exradin A19 Classic Farmer", [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.932, 0.9273, 0.9236, 0.9205, 0.9178, 0.9156, 0.9136, 0.9103, 0.9077, 0.9036]],
    ["PTW 30013 Farmer", [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.93, 0.9247, 0.921, 0.918, 0.9155, 0.9135, 0.9118, 0.909, 0.9068, 0.9037]],
    ["PTW 30012 Farmer", [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0], [0.9384, 0.9331, 0.929, 0.9257, 0.923, 0.9207, 0.9187, 0.9156, 0.9131, 0.9094]]
  ];
  /* Tabel 4 (silindris) & Tabel 5 (plan-paralel) — karakteristik chamber dari pabrikan.
   * L = panjang rongga (mm, untuk k_vol Pers. 22); kosong bila tidak tercantum. */
  var CHAMBERS = [
    ['NE 2571 Farmer', 'CYLINDRICAL', 0.69, 24.1, 3.2, 'Graphite'],
    ['PTW 30010 Farmer', 'CYLINDRICAL', 0.6, 23.0, 3.1, 'PMMA/graphite'],
    ['PTW 30012 Farmer', 'CYLINDRICAL', 0.6, 23.0, 3.1, 'Graphite'],
    ['PTW 30013 Farmer', 'CYLINDRICAL', 0.6, 23.0, 3.1, 'PMMA/graphite, kedap air'],
    ['PTW 31010 Semiflex', 'CYLINDRICAL', 0.13, 6.5, 2.8, 'PMMA/graphite (opsi FFF)'],
    ['PTW 31013 Semiflex', 'CYLINDRICAL', 0.3, 16.3, 2.8, 'PMMA/graphite'],
    ['PTW 31021 Semiflex 3D', 'CYLINDRICAL', 0.07, 4.8, 2.4, 'PMMA/graphite'],
    ['IBA CC13', 'CYLINDRICAL', 0.13, 5.8, 3.0, 'C552'],
    ['IBA FC65-G Farmer', 'CYLINDRICAL', 0.65, 23.0, 3.1, 'Graphite'],
    ['IBA FC65-P Farmer', 'CYLINDRICAL', 0.65, 23.0, 3.1, 'POM'],
    ['Exradin A12 Farmer', 'CYLINDRICAL', 0.64, '', 3.1, 'C-552 (panjang n.a.)'],
    ['Exradin A19 Classic Farmer', 'CYLINDRICAL', 0.62, '', 3.1, 'C-552 (panjang n.a.)'],
    ['Exradin A10 Markus', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm'],
    ['Exradin A11 Roos', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm'],
    ['IBA PPC05', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 0.5 mm'],
    ['IBA PPC40 Roos', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm'],
    ['IBA NACP-02', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm'],
    ['PTW 34001 Roos', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm'],
    ['PTW 34045 Advanced Markus', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 1 mm'],
    ['PTW 23343 Markus', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm'],
    ['Sun Nuclear SNC350p Roos', 'PLANE_PARALLEL', '', '', '', 'Jarak elektroda 2 mm']
  ];

  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(',', '.'));
  }
  function ok(v) { return typeof v === 'number' && isFinite(v); }
  function round(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }

  function mean(arr) {
    var xs = (arr || []).map(num).filter(ok);
    if (!xs.length) return NaN;
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  /* Standar deviasi relatif (%) dari pembacaan — indikator stabilitas */
  function rsd(arr) {
    var xs = (arr || []).map(num).filter(ok);
    if (xs.length < 2) return NaN;
    var m = mean(xs);
    var v = xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (xs.length - 1);
    return Math.sqrt(v) / m * 100;
  }

  /* Tekanan ke kPa (input bisa kPa atau mbar/hPa) */
  function toKPa(p, unit) {
    p = num(p);
    return unit === 'mbar' || unit === 'hPa' ? p / 10 : p;
  }

  /* k_TP = ((273.2 + T)/(273.2 + T0)) · (P0/P) */
  function kTP(T, P_kPa, T0, P0) {
    return ((273.2 + num(T)) / (273.2 + num(T0))) * (num(P0) / num(P_kPa));
  }

  /* k_pol = (|M+| + |M-|) / (2|M|), M = bacaan polaritas rutin */
  function kPol(mPlus, mMinus, routine) {
    var a = Math.abs(num(mPlus)), b = Math.abs(num(mMinus));
    var m = routine === '-' ? b : a;
    return (a + b) / (2 * m);
  }

  /* k_s metode dua tegangan (Bagian 4.4.3.4):
   *  - V1/V2 ada di Tabel 10 → Pers. (13): k_s = a0 + a1(M1/M2) + a2(M1/M2)²
   *  - V1/V2 di luar tabel   → Pers. (14): k_s ≈ (n − 1)/(n − M1/M2), valid untuk k_s < 1.03
   * M1 pada V1 (tegangan kerja), M2 pada V2 (rendah). */
  function ksDetail(m1, m2, v1, v2, scanned) {
    var n = num(v1) / num(v2), r = num(m1) / num(m2);
    if (!ok(n) || !ok(r) || n <= 1) return { value: NaN, n: n };
    var table = scanned ? KS_COEF_PULSED_SCANNED : KS_COEF_PULSED, key = null;
    Object.keys(table).forEach(function (k) { if (Math.abs(parseFloat(k) - n) < 1e-6) key = k; });
    if (key) { var c = table[key]; return { value: c[0] + c[1] * r + c[2] * r * r, n: n, method: 'Pers. (13), Tabel 10' + (scanned ? ' pulsed–scanned' : '') }; }
    if (scanned) return { value: NaN, n: n, error: 'Berkas pulsed–scanned: V1/V2 harus salah satu nilai Tabel 10 (2, 2.5, 3, 3.5, 4, 5).' };
    return { value: (n - 1) / (n - r), n: n, method: 'Pers. (14) — V1/V2 di luar Tabel 10' };
  }
  function kS(m1, m2, v1, v2) { return ksDetail(m1, m2, v1, v2).value; }

  /* Pers. (22) — k_vol generik untuk berkas FFF: 1 + (0.0062·TPR − 0.0036)·(100·L/SDD)², L & SDD dalam cm */
  function kvolEq22(tpr, Lcm, sdd) {
    tpr = num(tpr); Lcm = num(Lcm); sdd = num(sdd);
    if (!ok(tpr) || !ok(Lcm) || !ok(sdd) || sdd <= 0) return NaN;
    var x = 100 * Lcm / sdd;
    return 1 + (0.0062 * tpr - 0.0036) * x * x;
  }

  /* Kunci nama chamber yang toleran: "PTW 30013 Farmer" = "ptw 30013" = "PTW30013" */
  function modelKey(name) {
    return String(name || '').toLowerCase()
      .replace(/\(npl 2611a\)|secondary standard|advanced|classic|miniature|semiflex|pinpoint|farmer|short|markus|roos|3db?\b|type|chamber/g, ' ')
      .replace(/[^a-z0-9]/g, '');
  }

  /* Baris tabel kQ resmi untuk dimuat ke sheet Ref_kQ_TRS398 */
  function libraryKqRows() {
    var rows = [];
    PHOTON_EQ34.forEach(function (p) { rows.push({ chamber_model: p[0], beam_type: 'PHOTON', method: 'EQ34', fit_a: p[1], fit_b: p[2], quality_index_val: '', kq_value: '', source: 'TRS-398 Rev.1 Tabel 45 / Pers. (34)' }); });
    ELECTRON_T20.forEach(function (e) { e[1].forEach(function (q, i) { rows.push({ chamber_model: e[0], beam_type: 'ELECTRON', method: 'TABLE', fit_a: '', fit_b: '', quality_index_val: q, kq_value: e[2][i], source: 'TRS-398 Rev.1 Tabel 20' }); }); });
    return rows;
  }
  function libraryChamber(name) {
    var k = modelKey(name);
    for (var i = 0; i < CHAMBERS.length; i++) if (modelKey(CHAMBERS[i][0]) === k) return CHAMBERS[i];
    return null;
  }

  /* Konversi faktor kalibrasi N_D,w ke cGy/nC */
  function ndwToCgyPerNc(value, unit) {
    var v = num(value);
    switch ((unit || 'cGy/nC').replace(/\s/g, '')) {
      case 'Gy/C': return v * 1e-7;
      case 'mGy/nC': return v / 10;
      case 'Gy/nC': return v * 100;
      default: return v;
    }
  }

  /* Cari k_Q,Q0. rows: baris sheet Ref_kQ_TRS398 (method EQ34 = Pers. 34 dgn a,b; TABLE = interpolasi linier).
   * Bila model belum ada di sheet → pakai pustaka bawaan Rev. 1. Tidak pernah ekstrapolasi. */
  function lookupKq(rows, chamberModel, beamType, q) {
    q = num(q);
    var key = modelKey(chamberModel), bt = String(beamType || '').toUpperCase();
    var mine = (rows || []).filter(function (r) { return modelKey(r.chamber_model) === key && String(r.beam_type).toUpperCase() === bt; });
    var source = mine.length ? (mine[0].source || 'Master Tabel kQ') : '';
    if (!mine.length) { mine = libraryKqRows().filter(function (r) { return modelKey(r.chamber_model) === key && r.beam_type === bt; }); source = mine.length ? mine[0].source + ' (pustaka bawaan)' : ''; }
    if (!mine.length) return { error: 'k_Q untuk ' + chamberModel + ' (' + (bt === 'ELECTRON' ? 'elektron' : 'foton') + ') tidak ada di TRS-398 Rev.1 maupun Master Tabel kQ. Isi data dari sertifikat SSDL.' };
    if (!ok(q)) return { error: 'Indeks kualitas berkas (' + (bt === 'ELECTRON' ? 'R50' : 'TPR20,10') + ') belum diisi di Master Energi.' };
    var fit = mine.filter(function (r) { return r.method === 'EQ34' && ok(num(r.fit_a)) && ok(num(r.fit_b)); })[0];
    if (fit) {
      if (q < 0.56 - 1e-9 || q > 0.82 + 1e-9) return { error: 'TPR20,10 = ' + q + ' di luar rentang Pers. (34)/Tabel 16 (0.56–0.82). Ekstrapolasi tidak diizinkan.' };
      var A = num(fit.fit_a), B = num(fit.fit_b);
      return { value: (1 + Math.exp((A - 0.57) / B)) / (1 + Math.exp((A - q) / B)), method: 'EQ34', a: A, b: B, source: source };
    }
    var pts = mine.map(function (r) { return { x: num(r.quality_index_val), y: num(r.kq_value) }; })
      .filter(function (p) { return ok(p.x) && ok(p.y); }).sort(function (a, b) { return a.x - b.x; });
    if (!pts.length) return { error: 'Tabel kQ ' + chamberModel + ' kosong.' };
    for (var i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - q) < 1e-9) return { value: pts[i].y, method: 'TABLE', lo: pts[i], hi: pts[i], exact: true, source: source };
    if (q < pts[0].x || q > pts[pts.length - 1].x) {
      return { error: (bt === 'ELECTRON' ? 'R50' : 'TPR20,10') + ' = ' + q + ' di luar rentang tabel kQ ' + chamberModel + ' (' + pts[0].x + '–' + pts[pts.length - 1].x + ').' +
        (bt === 'ELECTRON' && q < 3 ? ' Untuk R50 < 3 g/cm² wajib chamber plan-paralel (Tabel 19).' : '') + ' Ekstrapolasi tidak diizinkan.' };
    }
    for (var j = 1; j < pts.length; j++) {
      if (pts[j].x > q) {
        var a = pts[j - 1], b = pts[j];
        return { value: a.y + (q - a.x) * (b.y - a.y) / (b.x - a.x), method: 'TABLE', lo: a, hi: b, exact: false, source: source };
      }
    }
    return { error: 'Interpolasi kQ gagal.' };
  }

  /* Batas toleransi per jenis berkas */
  function limitsFor(config, beamType) {
    config = config || {};
    var sep = String(config.SEPARATE_LIMITS) === 'true';
    if (sep && String(beamType).toUpperCase() === 'ELECTRON') {
      return { warn: num(config.WARNING_LIMIT_ELECTRON) || num(config.WARNING_LIMIT) || 1, action: num(config.ACTION_LIMIT_ELECTRON) || num(config.ACTION_LIMIT) || 2 };
    }
    return { warn: num(config.WARNING_LIMIT) || 1, action: num(config.ACTION_LIMIT) || 2 };
  }

  /* Status berdasarkan deviasi (dibulatkan 2 desimal = sama dengan tampilan & laporan) */
  function classify(dev, warn, action) {
    if (!ok(dev)) return '';
    var a = Math.abs(round(dev, 2));
    if (a <= warn + 1e-9) return 'PASS';
    if (a <= action + 1e-9) return 'WARNING';
    return 'FAIL';
  }

  /* ------------------------------------------------------------------
   * compute(input) — menjalankan seluruh rantai TRS-398.
   * input: { T, P, pUnit, T0, P0, mu, readings[], kelec, ndw, ndwUnit,
   *   kq (opsional, override) | kqRows+chamberModel, beamType, qualityIndex,
   *   kpolMode 'stored'|'measured', kpol, mPlus, mMinus, polRoutine,
   *   ksMode 'stored'|'measured', ks, mV1, mV2, v1, v2,
   *   setup 'SSD'|'SAD', pdd, tmr, baseline, warn, action }
   * ------------------------------------------------------------------ */
  function compute(inp) {
    var e = [], w = [], r = {};
    var P = toKPa(inp.P, inp.pUnit);
    r.pressKpa = P;
    r.mAvg = mean(inp.readings);
    r.nReadings = (inp.readings || []).map(num).filter(ok).length;
    r.rsd = rsd(inp.readings);
    if (!ok(num(inp.T))) e.push('Suhu T belum diisi.');
    if (!ok(P) || P <= 0) e.push('Tekanan P belum diisi.');
    if (ok(P) && (P < 60 || P > 110)) w.push('Tekanan ' + P.toFixed(2) + ' kPa di luar kisaran wajar — periksa satuan (kPa/mbar).');
    if (ok(num(inp.T)) && (num(inp.T) < 15 || num(inp.T) > 30)) w.push('Suhu di luar kisaran 15–30 °C.');
    if (!ok(r.mAvg)) e.push('Minimal satu bacaan elektrometer harus diisi.');
    if (ok(r.rsd) && r.rsd > 0.1) w.push('Variasi bacaan ' + r.rsd.toFixed(3) + '% (>0.1%) — periksa stabilitas berkas.');
    var mu = num(inp.mu);
    if (!ok(mu) || mu <= 0) e.push('Jumlah MU harus > 0.');

    r.ktp = kTP(inp.T, P, inp.T0 !== undefined ? inp.T0 : 20, inp.P0 !== undefined ? inp.P0 : 101.325);
    r.kelec = ok(num(inp.kelec)) ? num(inp.kelec) : 1;

    if (inp.kpolMode === 'measured') {
      r.kpol = kPol(inp.mPlus, inp.mMinus, inp.polRoutine);
      if (!ok(r.kpol)) e.push('Isi bacaan ulangan polaritas terbalik (M−) untuk menghitung k_pol.');
    } else r.kpol = ok(num(inp.kpol)) ? num(inp.kpol) : 1;
    if (ok(r.kpol) && Math.abs(r.kpol - 1) > 0.03) w.push('k_pol menyimpang >3% dari 1 — periksa detektor.');

    if (inp.ksMode === 'measured') {
      var kd = ksDetail(inp.mV1, inp.mV2, inp.v1, inp.v2, inp.scanned);
      r.ks = kd.value; r.ksInfo = kd;
      if (kd.error) e.push(kd.error);
      else if (!ok(r.ks)) e.push('k_s belum dapat dihitung: isi V1, V2 dan bacaan ulangan pada V2 (M2).');
      else {
        if (ok(kd.n) && kd.n < 3) w.push('V1/V2 = ' + kd.n.toFixed(2) + ' — TRS-398 menyarankan V1/V2 ≥ 3.');
        if (/14/.test(kd.method) && r.ks >= 1.03) w.push('k_s ≥ 1.03: pendekatan Pers. (14) kurang akurat — pakai V1/V2 dari Tabel 10.');
      }
    } else r.ks = ok(num(inp.ks)) ? num(inp.ks) : 1;

    /* k_vol (Bagian 4.4.3.5): berkas FFF → Pers. (22) atau nilai dari profil terukur */
    r.kvol = 1; r.kvolInfo = { mode: 'none' };
    if (inp.fff) {
      if (inp.kvolMode === 'manual') {
        r.kvol = num(inp.kvol); r.kvolInfo = { mode: 'manual' };
        if (!ok(r.kvol)) e.push('Isi k_vol dari profil terukur (atau pilih Pers. 22).');
      } else {
        var kv = kvolEq22(inp.qualityIndex, inp.cavityLengthCm, inp.sdd);
        if (ok(kv)) { r.kvol = kv; r.kvolInfo = { mode: 'eq22', L: num(inp.cavityLengthCm), sdd: num(inp.sdd) }; }
        else { w.push('Berkas FFF: panjang rongga chamber belum diisi di Master Detektor — k_vol dianggap 1.000.'); r.kvolInfo = { mode: 'missing' }; }
      }
    }
    if (ok(r.kvol) && (r.kvol < 0.99 || r.kvol > 1.03)) w.push('k_vol di luar kisaran wajar (0.99–1.03).');
    /* Kondisi referensi Rev. 1 */
    if (String(inp.beamType).toUpperCase() === 'PHOTON' && inp.chamberType === 'PLANE_PARALLEL') w.push('Tabel 15: dosimetri referensi foton memakai chamber silindris.');
    if (String(inp.beamType).toUpperCase() === 'ELECTRON' && ok(num(inp.qualityIndex)) && num(inp.qualityIndex) < 1.4) w.push('R50 < 1.4 g/cm²: kQ terhitung belum tervalidasi eksperimen — disarankan kQ terukur (catatan Tabel 20).');
    if (ok(r.ks) && (r.ks < 1 || r.ks > 1.05)) w.push('k_s di luar kisaran 1.000–1.050.');

    r.ndw = ndwToCgyPerNc(inp.ndw, inp.ndwUnit);
    if (!ok(r.ndw) || r.ndw <= 0) e.push('Faktor kalibrasi N_D,w detektor tidak valid.');

    if (ok(num(inp.kq))) { r.kq = num(inp.kq); r.kqInfo = { manual: true }; }
    else {
      var k = lookupKq(inp.kqRows, inp.chamberModel, inp.beamType, inp.qualityIndex);
      if (k.error) e.push(k.error); else { r.kq = k.value; r.kqInfo = k; }
    }

    r.mq = r.mAvg * r.ktp * r.kelec * r.kpol * r.ks * r.kvol;
    r.dwZref = r.mq * r.ndw * r.kq;
    if (inp.setup === 'SAD') {
      var tmr = num(inp.tmr);
      if (!ok(tmr) || tmr <= 0) e.push('TMR(z_ref) belum diisi di Master Energi (setup SAD).');
      r.dwZmax = r.dwZref / tmr;
    } else {
      var pdd = num(inp.pdd);
      if (!ok(pdd) || pdd <= 0) e.push('PDD(z_ref) belum diisi di Master Energi (setup SSD).');
      r.dwZmax = r.dwZref / (pdd / 100);
    }
    r.output = r.dwZmax / mu;
    var base = num(inp.baseline);
    if (!ok(base) || base <= 0) e.push('Baseline output belum diisi.');
    r.deviation = (r.output - base) / base * 100;
    r.warn = num(inp.warn); r.action = num(inp.action);
    r.status = e.length ? '' : classify(r.deviation, r.warn, r.action);
    r.errors = e; r.warnings = w; r.valid = e.length === 0 && ok(r.output);
    return r;
  }

  /* ------------------------------------------------------------------
   * Status sesi dari kumpulan record satu session_group_id
   * HOLD = As-Found FAIL & belum ada Adjustment PASS
   * CLEARED = ada Adjustment dengan status PASS (iterasi terakhir)
   * ------------------------------------------------------------------ */
  function sessionSummary(records) {
    var af = null, adj = [];
    (records || []).forEach(function (x) {
      if (x.record_type === 'AS_FOUND') af = x; else adj.push(x);
    });
    adj.sort(function (a, b) { return num(a.iteration_no) - num(b.iteration_no); });
    var last = adj.length ? adj[adj.length - 1] : null;
    var final = last || af;
    var st = af ? af.status : '';
    if (last) st = last.status === 'PASS' ? 'CLEARED' : (af && af.status === 'FAIL' ? 'HOLD' : last.status);
    else if (af && af.status === 'FAIL') st = 'HOLD';
    return { asFound: af, adjustments: adj, final: final, status: st, hasAdjustment: adj.length > 0, pending: st === 'HOLD' };
  }

  /* Label & kelas tampilan status */
  var STATUS_META = {
    PASS: { label: 'PASS', cls: 'pass' },
    WARNING: { label: 'WARNING', cls: 'warning' },
    FAIL: { label: 'FAIL', cls: 'fail' },
    HOLD: { label: 'HOLD', cls: 'fail' },
    CLEARED: { label: 'PASS (Cleared)', cls: 'cleared' }
  };

  function fmtDev(v) { return ok(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : '—'; }

  return {
    KS_COEF_PULSED: KS_COEF_PULSED, KS_COEF_PULSED_SCANNED: KS_COEF_PULSED_SCANNED, PHOTON_EQ34: PHOTON_EQ34, ELECTRON_T20: ELECTRON_T20,
    CHAMBERS: CHAMBERS, ksDetail: ksDetail, kvolEq22: kvolEq22, modelKey: modelKey, libraryKqRows: libraryKqRows, libraryChamber: libraryChamber, num: num, ok: ok, round: round, mean: mean, rsd: rsd, toKPa: toKPa,
    kTP: kTP, kPol: kPol, kS: kS, ndwToCgyPerNc: ndwToCgyPerNc, lookupKq: lookupKq,
    limitsFor: limitsFor, classify: classify, compute: compute, sessionSummary: sessionSummary,
    STATUS_META: STATUS_META, fmtDev: fmtDev
  };
})();
