/* =====================================================================
 * e-Dose Agora — Mesin Kalkulasi IAEA TRS-398
 * ---------------------------------------------------------------------
 * FILE BERSAMA: isi file ini IDENTIK dengan Trs398Engine.gs di Apps Script.
 * Browser memakainya untuk pratinjau real-time, server memakainya untuk
 * menghitung ulang & memvalidasi sebelum data disimpan. Jika Anda mengubah
 * rumus, ubah KEDUA salinan (atau salin ulang file ini ke GAS).
 * Tidak boleh memakai window/document di file ini.
 * ===================================================================== */
var TRS398 = (function () {
  'use strict';

  /* Koefisien rekombinasi metode dua tegangan, berkas PULSA
   * (IAEA TRS-398 Tabel 4.VII). Kunci = rasio V1/V2.
   * Verifikasi terhadap salinan protokol Anda sebelum Go-Live. */
  var KS_COEF_PULSED = {
    '2.0': [2.337, -3.636, 2.299],
    '2.5': [1.474, -1.587, 1.114],
    '3.0': [1.198, -0.875, 0.677],
    '3.5': [1.080, -0.542, 0.463],
    '4.0': [1.022, -0.363, 0.341],
    '5.0': [0.975, -0.188, 0.214]
  };

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

  /* Koefisien a0,a1,a2 untuk rasio V1/V2 — interpolasi linier antar baris tabel */
  function ksCoef(ratio) {
    var keys = Object.keys(KS_COEF_PULSED).map(parseFloat).sort(function (a, b) { return a - b; });
    if (!ok(ratio) || ratio < keys[0] - 1e-9 || ratio > keys[keys.length - 1] + 1e-9) return null;
    for (var i = 0; i < keys.length; i++) {
      if (Math.abs(keys[i] - ratio) < 1e-9) return KS_COEF_PULSED[keys[i].toFixed(1)];
      if (keys[i] > ratio) {
        var lo = keys[i - 1], hi = keys[i];
        var A = KS_COEF_PULSED[lo.toFixed(1)], B = KS_COEF_PULSED[hi.toFixed(1)];
        var t = (ratio - lo) / (hi - lo);
        return [0, 1, 2].map(function (j) { return A[j] + t * (B[j] - A[j]); });
      }
    }
    return null;
  }

  /* k_s = a0 + a1(M1/M2) + a2(M1/M2)^2 — M1 pada V1 (normal), M2 pada V2 (rendah) */
  function kS(m1, m2, v1, v2) {
    var c = ksCoef(num(v1) / num(v2));
    if (!c) return NaN;
    var r = num(m1) / num(m2);
    return c[0] + c[1] * r + c[2] * r * r;
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

  /* Cari k_Q,Q0 dari tabel: interpolasi linier, TIDAK ekstrapolasi.
   * rows: [{chamber_model, beam_type, quality_index_val, kq_value}] */
  function lookupKq(rows, chamberModel, beamType, q) {
    q = num(q);
    var pts = (rows || []).filter(function (r) {
      return String(r.chamber_model).trim().toLowerCase() === String(chamberModel || '').trim().toLowerCase() &&
        String(r.beam_type).toUpperCase() === String(beamType || '').toUpperCase();
    }).map(function (r) { return { x: num(r.quality_index_val), y: num(r.kq_value) }; })
      .filter(function (p) { return ok(p.x) && ok(p.y); })
      .sort(function (a, b) { return a.x - b.x; });
    if (!pts.length) return { error: 'Tabel kQ untuk ' + chamberModel + ' (' + beamType + ') belum ada di Master Tabel kQ.' };
    if (!ok(q)) return { error: 'Indeks kualitas berkas (TPR20,10 / R50) belum diisi.' };
    for (var i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].x - q) < 1e-9) return { value: pts[i].y, lo: pts[i], hi: pts[i], exact: true };
    }
    if (q < pts[0].x || q > pts[pts.length - 1].x) {
      return { error: 'Nilai ' + q + ' di luar rentang tabel kQ ' + chamberModel + ' (' + pts[0].x + '–' + pts[pts.length - 1].x + '). Ekstrapolasi tidak diizinkan.' };
    }
    for (var j = 1; j < pts.length; j++) {
      if (pts[j].x > q) {
        var a = pts[j - 1], b = pts[j];
        return { value: a.y + (q - a.x) * (b.y - a.y) / (b.x - a.x), lo: a, hi: b, exact: false };
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
      r.ks = kS(inp.mV1, inp.mV2, inp.v1, inp.v2);
      if (!ok(r.ks)) e.push('k_s belum dapat dihitung: isi bacaan ulangan pada V2 (M2); rasio V1/V2 harus 2.0–5.0.');
    } else r.ks = ok(num(inp.ks)) ? num(inp.ks) : 1;
    if (ok(r.ks) && (r.ks < 1 || r.ks > 1.05)) w.push('k_s di luar kisaran 1.000–1.050.');

    r.ndw = ndwToCgyPerNc(inp.ndw, inp.ndwUnit);
    if (!ok(r.ndw) || r.ndw <= 0) e.push('Faktor kalibrasi N_D,w detektor tidak valid.');

    if (ok(num(inp.kq))) { r.kq = num(inp.kq); r.kqInfo = { manual: true }; }
    else {
      var k = lookupKq(inp.kqRows, inp.chamberModel, inp.beamType, inp.qualityIndex);
      if (k.error) e.push(k.error); else { r.kq = k.value; r.kqInfo = k; }
    }

    r.mq = r.mAvg * r.ktp * r.kelec * r.kpol * r.ks;
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
    KS_COEF_PULSED: KS_COEF_PULSED, num: num, ok: ok, round: round, mean: mean, rsd: rsd, toKPa: toKPa,
    kTP: kTP, kPol: kPol, kS: kS, ksCoef: ksCoef, ndwToCgyPerNc: ndwToCgyPerNc, lookupKq: lookupKq,
    limitsFor: limitsFor, classify: classify, compute: compute, sessionSummary: sessionSummary,
    STATUS_META: STATUS_META, fmtDev: fmtDev
  };
})();
