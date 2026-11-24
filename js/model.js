/* =====================================================================
 * e-Dose Agora — Model Data Bersama (skema sheet, perakit input, seed demo)
 * ---------------------------------------------------------------------
 * FILE BERSAMA: isi file ini IDENTIK dengan AppModel.gs di Apps Script.
 * Bergantung pada TRS398 (trs398.js / Trs398Engine.gs).
 * ===================================================================== */
var AppModel = (function () {
  'use strict';

  /* Tipe kolom: s = teks, n = angka, b = boolean, j = JSON */
  var SCHEMA = {
    App_Config: { key: 'config_key', cols: [['config_key', 's'], ['config_value', 's'], ['category', 's'], ['updated_at', 's']] },
    Master_Personnel: { key: 'person_id', cols: [['person_id', 's'], ['full_name', 's'], ['role', 's'], ['nip_str', 's'], ['email', 's'], ['position', 's'], ['is_active', 'b']] },
    Master_Linac_Energy: { key: 'energy_id', cols: [['energy_id', 's'], ['linac_id', 's'], ['linac_name', 's'], ['linac_model', 's'], ['serial_no', 's'], ['bunker', 's'],
      ['beam_type', 's'], ['energy_label', 's'], ['setup_type', 's'], ['ssd_sad_cm', 'n'], ['z_ref_cm', 'n'], ['z_max_cm', 'n'], ['pdd_zref', 'n'], ['tmr_zref', 'n'],
      ['quality_index', 'n'], ['baseline_cgy_mu', 'n'], ['kpol_default', 'n'], ['ks_default', 'n'], ['is_active', 'b']] },
    Master_Detector: { key: 'detector_id', cols: [['detector_id', 's'], ['category', 's'], ['chamber_type', 's'], ['model_name', 's'], ['serial_no', 's'], ['cal_factor', 'n'], ['unit', 's'],
      ['cal_lab', 's'], ['cert_no', 's'], ['cal_date', 's'], ['expiry_date', 's'], ['is_active', 'b']] },
    Ref_kQ_TRS398: { key: 'kq_id', cols: [['kq_id', 's'], ['chamber_model', 's'], ['beam_type', 's'], ['quality_index_val', 'n'], ['kq_value', 'n'], ['source', 's']] },
    Trans_QC_Absolut: { key: 'qc_id', cols: [['qc_id', 's'], ['session_group_id', 's'], ['record_type', 's'], ['iteration_no', 'n'], ['qc_datetime', 's'],
      ['energy_id', 's'], ['chamber_id', 's'], ['electrometer_id', 's'], ['fismed_id', 's'], ['temp_c', 'n'], ['press_kpa', 'n'], ['mu_set', 'n'],
      ['m_raw_list', 'j'], ['m_raw_avg', 'n'], ['kpol_mode', 's'], ['m_plus', 'n'], ['m_minus', 'n'], ['ks_mode', 's'], ['m_v1', 'n'], ['m_v2', 'n'], ['v1', 'n'], ['v2', 'n'],
      ['k_tp', 'n'], ['k_pol', 'n'], ['k_s', 'n'], ['k_elec', 'n'], ['n_dw', 'n'], ['k_q', 'n'], ['quality_index', 'n'], ['setup_type', 's'], ['pdd_used', 'n'], ['tmr_used', 'n'],
      ['baseline_used', 'n'], ['m_q', 'n'], ['dw_zref', 'n'], ['dw_zmax', 'n'], ['output_cgy_mu', 'n'], ['deviation_pct', 'n'], ['status', 's'],
      ['warning_limit_used', 'n'], ['action_limit_used', 'n'], ['adj_datetime', 's'], ['adj_category', 's'], ['adj_action_desc', 's'], ['adj_performer', 's'], ['adj_ticket', 's'],
      ['notes', 's'], ['edit_log', 'j'], ['created_at', 's'], ['updated_at', 's']] },
    Log_Notifications: { key: 'log_id', cols: [['log_id', 's'], ['notif_type', 's'], ['ref_id', 's'], ['recipient_emails', 's'], ['sent_at', 's'], ['status', 's'], ['detail', 's']] }
  };

  var DEFAULT_CONFIG = [
    ['WARNING_LIMIT', '1.0', 'TOLERANSI'], ['ACTION_LIMIT', '2.0', 'TOLERANSI'],
    ['SEPARATE_LIMITS', 'false', 'TOLERANSI'], ['WARNING_LIMIT_ELECTRON', '2.0', 'TOLERANSI'], ['ACTION_LIMIT_ELECTRON', '3.0', 'TOLERANSI'],
    ['T0', '20.0', 'REFERENSI'], ['P0', '101.325', 'REFERENSI'],
    ['ALERT_ENABLED', 'true', 'EMAIL'], ['CAL_REMINDER_ENABLED', 'true', 'EMAIL'], ['CAL_REMINDER_DAYS', '60,30,7', 'EMAIL'], ['ALERT_EMAILS', '', 'EMAIL'],
    ['APP_URL', '', 'SISTEM'],
    ['HOSPITAL_NAME', 'RS Siloam Hospitals', 'PROFIL'], ['HOSPITAL_UNIT', 'Instalasi Radioterapi', 'PROFIL'],
    ['HOSPITAL_ADDRESS', 'Alamat rumah sakit', 'PROFIL'], ['HOSPITAL_LOGO', '', 'PROFIL'], ['KADEP_ID', 'P004', 'PROFIL']
  ];

  /* Urutan energi: foton dulu, lalu numerik (6 MV, 6 FFF, 10 MV, 9 MeV, 12 MeV) */
  function energyOrder(a, b) {
    var ra = a.beam_type === 'ELECTRON' ? 1 : 0, rb = b.beam_type === 'ELECTRON' ? 1 : 0;
    return ra - rb || (parseFloat(a.energy_label) || 0) - (parseFloat(b.energy_label) || 0) || String(a.energy_label).localeCompare(String(b.energy_label));
  }
  function idx(list, key) { var m = {}; (list || []).forEach(function (x) { m[x[key]] = x; }); return m; }

  /* Rakit input TRS398.compute dari record transaksi + master data.
   * snap (opsional) = record sumber snapshot (As-Found untuk Adjustment,
   * record lama untuk koreksi). Nilai N_D,w, k_Q, k_elec, PDD/TMR, baseline
   * & batas toleransi diambil dari snapshot agar riwayat tetap valid audit. */
  function buildInput(rec, db, snap) {
    var n = TRS398.num, ok = TRS398.ok;
    var en = idx(db.energies, 'energy_id')[rec.energy_id] || {};
    var det = idx(db.detectors, 'detector_id');
    var ch = det[rec.chamber_id] || {}, el = det[rec.electrometer_id] || {};
    var lim = TRS398.limitsFor(db.config, en.beam_type);
    var inp = {
      T: rec.temp_c, P: rec.press_kpa, pUnit: 'kPa',
      T0: n(db.config.T0) || 20, P0: n(db.config.P0) || 101.325,
      mu: rec.mu_set, readings: rec.m_raw_list || [],
      kelec: el.cal_factor, ndw: ch.cal_factor, ndwUnit: ch.unit,
      kqRows: db.kq, chamberModel: ch.model_name, beamType: en.beam_type, qualityIndex: en.quality_index,
      kpolMode: rec.kpol_mode || 'stored', kpol: rec.kpol_mode === 'measured' ? '' : (ok(n(rec.k_pol)) ? rec.k_pol : en.kpol_default),
      mPlus: rec.m_plus, mMinus: rec.m_minus, polRoutine: '+',
      ksMode: rec.ks_mode || 'stored', ks: rec.ks_mode === 'measured' ? '' : (ok(n(rec.k_s)) ? rec.k_s : en.ks_default),
      mV1: rec.m_v1, mV2: rec.m_v2, v1: rec.v1, v2: rec.v2,
      setup: en.setup_type, pdd: en.pdd_zref, tmr: en.tmr_zref, baseline: en.baseline_cgy_mu,
      warn: lim.warn, action: lim.action, snapshot: false
    };
    if (snap && ok(n(snap.n_dw)) && ok(n(snap.k_q))) {
      inp.ndw = snap.n_dw; inp.ndwUnit = 'cGy/nC'; inp.kq = snap.k_q;
      if (ok(n(snap.k_elec))) inp.kelec = snap.k_elec;
      if (snap.setup_type) inp.setup = snap.setup_type;
      if (ok(n(snap.pdd_used))) inp.pdd = snap.pdd_used;
      if (ok(n(snap.tmr_used))) inp.tmr = snap.tmr_used;
      if (ok(n(snap.baseline_used))) inp.baseline = snap.baseline_used;
      if (ok(n(snap.quality_index))) inp.qualityIndex = snap.quality_index;
      if (ok(n(snap.warning_limit_used))) inp.warn = n(snap.warning_limit_used);
      if (ok(n(snap.action_limit_used))) inp.action = n(snap.action_limit_used);
      inp.snapshot = true;
    }
    return inp;
  }

  /* Terapkan hasil compute ke record (kolom turunan + snapshot parameter) */
  function applyResult(rec, r, inp) {
    rec.m_raw_avg = r.mAvg; rec.k_tp = r.ktp; rec.k_pol = r.kpol; rec.k_s = r.ks; rec.k_elec = r.kelec;
    rec.n_dw = r.ndw; rec.k_q = r.kq; rec.quality_index = TRS398.num(inp.qualityIndex); rec.setup_type = inp.setup;
    rec.pdd_used = TRS398.ok(TRS398.num(inp.pdd)) ? TRS398.num(inp.pdd) : ''; rec.tmr_used = TRS398.ok(TRS398.num(inp.tmr)) ? TRS398.num(inp.tmr) : '';
    rec.baseline_used = TRS398.num(inp.baseline);
    rec.m_q = r.mq; rec.dw_zref = r.dwZref; rec.dw_zmax = r.dwZmax; rec.output_cgy_mu = r.output;
    rec.deviation_pct = r.deviation; rec.status = r.status;
    rec.warning_limit_used = r.warn; rec.action_limit_used = r.action;
    return rec;
  }

  /* Hitung ulang record (server saat simpan/edit & klien saat pratinjau) */
  function recompute(rec, db, snap) {
    var inp = buildInput(rec, db, snap);
    var r = TRS398.compute(inp);
    return { result: r, input: inp, record: r.valid ? applyResult(rec, r, inp) : rec };
  }

  /* Ringkasan sesi: kelompokkan transaksi per session_group_id */
  function groupSessions(transactions) {
    var g = {};
    (transactions || []).forEach(function (t) { (g[t.session_group_id] = g[t.session_group_id] || []).push(t); });
    return Object.keys(g).map(function (k) {
      var s = TRS398.sessionSummary(g[k]); s.id = k; s.records = g[k];
      s.datetime = s.asFound ? s.asFound.qc_datetime : (g[k][0] || {}).qc_datetime;
      s.energy_id = (s.asFound || g[k][0] || {}).energy_id;
      return s;
    }).sort(function (a, b) { return a.datetime < b.datetime ? 1 : -1; });
  }

  /* Status kalibrasi detektor */
  function calStatus(det, todayIso, warnDays) {
    var d = Math.round((new Date(det.expiry_date + 'T00:00:00') - new Date(todayIso + 'T00:00:00')) / 86400000);
    var w = warnDays || 60;
    return { days: d, status: !det.expiry_date ? 'UNKNOWN' : d < 0 ? 'EXPIRED' : d <= w ? 'EXPIRING' : 'VALID' };
  }

  /* ------------------------------------------------------------------
   * SEED DEMO — deterministik, dihitung lewat mesin TRS-398 asli
   * Nilai kQ di bawah adalah CONTOH. Wajib diverifikasi terhadap
   * IAEA TRS-398 (Tabel 14 foton, Tabel 18 elektron) sebelum klinis.
   * ------------------------------------------------------------------ */
  function buildSeed() {
    var config = {};
    DEFAULT_CONFIG.forEach(function (c) { config[c[0]] = c[1]; });
    config.HOSPITAL_NAME = 'RS Siloam Hospitals Semanggi';
    config.HOSPITAL_UNIT = 'Instalasi Radioterapi & Onkologi Radiasi';
    config.HOSPITAL_ADDRESS = 'Jl. Garnisun Dalam No. 2–3, Karet Semanggi, Jakarta Selatan 12930';

    var personnel = [
      { person_id: 'P001', full_name: 'Dr. Andi, M.Si', role: 'FISMED', nip_str: 'STR-FM-0014', email: '', position: 'Fisikawan Medis', is_active: true },
      { person_id: 'P002', full_name: 'Siti Rahma, M.Si', role: 'FISMED', nip_str: 'STR-FM-0021', email: '', position: 'Fisikawan Medis', is_active: true },
      { person_id: 'P003', full_name: 'Budi Santoso, S.Si', role: 'FISMED', nip_str: 'STR-FM-0032', email: '', position: 'Fisikawan Medis', is_active: true },
      { person_id: 'P004', full_name: 'dr. Ratna Kusuma, Sp.Onk.Rad', role: 'KADEP', nip_str: 'NIP. 19780412-200501', email: '', position: 'Kepala Instalasi Radioterapi', is_active: true }
    ];

    function E(id, lid, lname, model, sn, bunker, bt, label, setup, zref, zmax, pdd, tmr, q, kpol, ks) {
      return { energy_id: id, linac_id: lid, linac_name: lname, linac_model: model, serial_no: sn, bunker: bunker, beam_type: bt, energy_label: label,
        setup_type: setup, ssd_sad_cm: 100, z_ref_cm: zref, z_max_cm: zmax, pdd_zref: pdd, tmr_zref: tmr, quality_index: q, baseline_cgy_mu: 1.000,
        kpol_default: kpol, ks_default: ks, is_active: true };
    }
    var TB = ['L01', 'Varian TrueBeam #1', 'Varian TrueBeam STx', 'SN-TB-2041', 'Bunker 1'];
    var VH = ['L02', 'Elekta Versa HD #2', 'Elekta Versa HD', 'SN-VH-8812', 'Bunker 2'];
    var energies = [
      E('E01', TB[0], TB[1], TB[2], TB[3], TB[4], 'PHOTON', '6 MV', 'SSD', 10, 1.5, 66.80, '', 0.671, 1.0008, 1.0028),
      E('E02', TB[0], TB[1], TB[2], TB[3], TB[4], 'PHOTON', '10 MV', 'SSD', 10, 2.3, 73.90, '', 0.738, 1.0010, 1.0035),
      E('E03', TB[0], TB[1], TB[2], TB[3], TB[4], 'PHOTON', '6 FFF', 'SSD', 10, 1.3, 64.20, '', 0.632, 1.0006, 1.0062),
      E('E04', TB[0], TB[1], TB[2], TB[3], TB[4], 'ELECTRON', '9 MeV', 'SSD', 2.07, 2.1, 99.80, '', 3.61, 1.0040, 1.0080),
      E('E05', VH[0], VH[1], VH[2], VH[3], VH[4], 'PHOTON', '6 MV', 'SSD', 10, 1.5, 67.50, '', 0.684, 1.0008, 1.0030),
      E('E06', VH[0], VH[1], VH[2], VH[3], VH[4], 'PHOTON', '10 MV', 'SSD', 10, 2.3, 76.34, '', 0.734, 1.0012, 1.0032),
      E('E07', VH[0], VH[1], VH[2], VH[3], VH[4], 'ELECTRON', '9 MeV', 'SSD', 2.07, 2.1, 99.60, '', 3.61, 1.0045, 1.0085),
      E('E08', VH[0], VH[1], VH[2], VH[3], VH[4], 'ELECTRON', '12 MeV', 'SSD', 2.84, 2.8, 99.90, '', 4.90, 1.0030, 1.0070)
    ];

    var detectors = [
      { detector_id: 'D01', category: 'CHAMBER', chamber_type: 'CYLINDRICAL', model_name: 'PTW 30013 Farmer', serial_no: 'SN-4421', cal_factor: 5.382, unit: 'cGy/nC', cal_lab: 'PTKMR BRIN', cert_no: 'S-2024-882', cal_date: '2024-12-14', expiry_date: '2026-12-14', is_active: true },
      { detector_id: 'D02', category: 'CHAMBER', chamber_type: 'CYLINDRICAL', model_name: 'IBA FC65-G', serial_no: 'SN-1190', cal_factor: 4.815, unit: 'cGy/nC', cal_lab: 'PTKMR BRIN', cert_no: 'S-2025-114', cal_date: '2025-08-10', expiry_date: '2027-08-10', is_active: true },
      { detector_id: 'D03', category: 'CHAMBER', chamber_type: 'PLANE_PARALLEL', model_name: 'PTW 34001 Roos', serial_no: 'SN-2210', cal_factor: 8.215, unit: 'cGy/nC', cal_lab: 'PTKMR BRIN', cert_no: 'S-2025-207', cal_date: '2025-03-02', expiry_date: '2027-03-02', is_active: true },
      { detector_id: 'D11', category: 'ELECTROMETER', chamber_type: '', model_name: 'PTW UNIDOS E', serial_no: 'SN-EL-091', cal_factor: 1.000, unit: 'k_elec', cal_lab: 'PTKMR BRIN', cert_no: 'E-2025-042', cal_date: '2025-09-18', expiry_date: '2027-09-18', is_active: true },
      { detector_id: 'D12', category: 'ELECTROMETER', chamber_type: '', model_name: 'IBA Dose 1', serial_no: 'SN-EL-114', cal_factor: 0.9995, unit: 'k_elec', cal_lab: 'PTKMR BRIN', cert_no: 'E-2025-090', cal_date: '2025-05-20', expiry_date: '2027-05-20', is_active: true }
    ];

    var kq = [], n = 0;
    function K(model, bt, pairs) {
      pairs.forEach(function (p) { kq.push({ kq_id: 'KQ' + String(++n).padStart(3, '0'), chamber_model: model, beam_type: bt, quality_index_val: p[0], kq_value: p[1], source: 'CONTOH — verifikasi TRS-398' }); });
    }
    K('PTW 30013 Farmer', 'PHOTON', [[0.50, 1.004], [0.56, 1.001], [0.62, 0.997], [0.65, 0.994], [0.68, 0.990], [0.70, 0.988], [0.72, 0.985], [0.74, 0.981], [0.76, 0.976], [0.78, 0.969], [0.80, 0.962]]);
    K('IBA FC65-G', 'PHOTON', [[0.50, 1.005], [0.56, 1.002], [0.62, 0.998], [0.65, 0.995], [0.68, 0.992], [0.70, 0.989], [0.72, 0.986], [0.74, 0.982], [0.76, 0.977], [0.78, 0.971], [0.80, 0.964]]);
    K('PTW 34001 Roos', 'ELECTRON', [[1.0, 0.965], [1.5, 0.955], [2.0, 0.946], [2.5, 0.939], [3.0, 0.934], [3.5, 0.929], [4.0, 0.926], [5.0, 0.919], [6.0, 0.914], [7.0, 0.910], [8.0, 0.906]]);
    K('PTW 30013 Farmer', 'ELECTRON', [[4.0, 0.917], [5.0, 0.912], [6.0, 0.908], [7.0, 0.905], [8.0, 0.901], [10.0, 0.895]]);

    var db = { config: config, energies: energies, detectors: detectors, kq: kq, personnel: personnel };
    var transactions = [], seq = 1050;

    /* Back-solve rata-rata bacaan agar menghasilkan deviasi target, lalu hitung maju */
    function mk(dt, eid, dev, fismed, extra) {
      var en = idx(energies, 'energy_id')[eid];
      var chamber = en.beam_type === 'ELECTRON' ? 'D03' : 'D01';
      var T = 22.0 + ((seq * 7) % 9) / 10, P = 100.70 + ((seq * 13) % 30) / 100;
      var rec = { energy_id: eid, chamber_id: chamber, electrometer_id: 'D11', fismed_id: fismed, temp_c: T, press_kpa: P, mu_set: 100,
        kpol_mode: 'stored', ks_mode: 'stored', k_pol: en.kpol_default, k_s: en.ks_default };
      var probe = TRS398.compute(buildInput(Object.assign({}, rec, { m_raw_list: [10] }), db));
      var target = en.baseline_cgy_mu * (1 + dev / 100);
      var m = 10 * target / probe.output;
      rec.m_raw_list = [m - 0.004, m + 0.006, m - 0.002].map(function (x) { return Math.round(x * 1000) / 1000; });
      Object.assign(rec, extra || {});
      rec.qc_datetime = dt; rec.created_at = dt; rec.updated_at = dt; rec.notes = rec.notes || ''; rec.edit_log = [];
      recompute(rec, db);
      return rec;
    }
    function asFound(dt, eid, dev, f, notes) {
      var r = mk(dt, eid, dev, f, { notes: notes || '' });
      r.qc_id = 'QC-' + dt.slice(0, 4) + '-' + (++seq); r.session_group_id = r.qc_id; r.record_type = 'AS_FOUND'; r.iteration_no = 0;
      transactions.push(r); return r;
    }
    function adjust(af, dt, dev, it, extra) {
      var r = mk(dt, af.energy_id, dev, af.fismed_id, extra);
      r.temp_c = r.temp_c - 0.1;
      recompute(r, db, af);
      r.qc_id = af.session_group_id + '-ADJ' + it; r.session_group_id = af.session_group_id; r.record_type = 'ADJUSTMENT'; r.iteration_no = it;
      r.chamber_id = af.chamber_id; r.electrometer_id = af.electrometer_id;
      transactions.push(r); return r;
    }

    var months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    var pattern = {
      E01: [0.20, 0.35, -0.15, 0.30, 0.45], E02: [-0.20, 0.10, -0.35, 0.05, 2.35], E03: [0.30, 0.15, 0.40, 0.25, 0.50], E04: [-0.40, 0.20, 0.55, -0.30, 0.65],
      E05: [0.10, -0.20, 0.30, 0.15, 0.05], E06: [0.20, 0.40, -0.20, 0.30, 0.70], E07: [0.30, 0.55, 0.80, 0.95, 1.05], E08: [-0.10, 0.20, 0.35, 0.10, 0.25]
    };
    var fis = ['P001', 'P002', 'P003'];
    months.forEach(function (mo, i) {
      Object.keys(pattern).forEach(function (eid, j) {
        var day = (eid <= 'E04' ? 8 : 15) + (j % 4);
        var dt = mo + '-' + String(day).padStart(2, '0') + 'T' + String(8 + j).padStart(2, '0') + ':15';
        var af = asFound(dt, eid, pattern[eid][i], fis[(i + j) % 3]);
        if (mo === '2026-10' && eid === 'E02') {
          adjust(af, mo + '-' + String(day).padStart(2, '0') + 'T15:40', 0.10, 1, {
            adj_datetime: mo + '-' + String(day).padStart(2, '0') + 'T15:10', adj_category: 'Monitor Chamber Gain Adjustment',
            adj_action_desc: 'Koreksi gain monitor chamber -2.2% pada service mode, verifikasi stabilitas 3x.', adj_performer: 'FSE Varian & Budi Santoso, S.Si', adj_ticket: 'SR-VAR-2026-417'
          });
        }
      });
    });
    /* November 2026 — kondisi seperti di wireframe */
    asFound('2026-11-22T10:05', 'E01', 0.40, 'P002');
    asFound('2026-11-22T10:40', 'E02', -0.30, 'P002');
    asFound('2026-11-22T11:10', 'E03', 0.55, 'P002');
    asFound('2026-11-22T11:45', 'E04', 0.35, 'P002');
    asFound('2026-11-19T11:30', 'E07', 1.15, 'P001', 'Tren naik 5 bulan berturut — pantau.');
    asFound('2026-11-19T12:10', 'E08', 0.30, 'P001');
    asFound('2026-11-23T13:50', 'E05', 0.25, 'P001');
    asFound('2026-11-23T14:20', 'E06', 2.60, 'P001', 'Output terukur meningkat pasca servis ion pump minggu lalu.');

    return { config: config, personnel: personnel, energies: energies, detectors: detectors, kq: kq, transactions: transactions, notifications: [] };
  }

  return { energyOrder: energyOrder, SCHEMA: SCHEMA, DEFAULT_CONFIG: DEFAULT_CONFIG, idx: idx, buildInput: buildInput, applyResult: applyResult,
    recompute: recompute, groupSessions: groupSessions, calStatus: calStatus, buildSeed: buildSeed };
})();
