/* =====================================================================
 * W-03 · Input QC Absolut (IAEA TRS-398) + komponen form pengukuran
 * yang dipakai ulang oleh halaman Adjustment (MeasUI).
 * ===================================================================== */
var MeasUI = (function () {
  var esc = UI.esc, N = TRS398.num, OK = TRS398.ok;

  function blankMeas(en) {
    en = en || {};
    return { temp_c: '', press: '', pUnit: 'kPa', mu_set: 100, readings: ['', '', ''], kpol_mode: 'stored', k_pol: en.kpol_default || 1, ks_mode: 'stored', k_s: en.ks_default || 1,
      m_plus: '', m_minus: '', m_v1: '', m_v2: '', v1: 400, v2: 200, notes: '', qc_datetime: UI.nowLocalInput() };
  }
  function fromRecord(r) {
    return { temp_c: r.temp_c, press: r.press_kpa, pUnit: 'kPa', mu_set: r.mu_set, readings: (r.m_raw_list || []).map(String), kpol_mode: r.kpol_mode || 'stored', k_pol: r.k_pol,
      ks_mode: r.ks_mode || 'stored', k_s: r.k_s, m_plus: r.m_plus, m_minus: r.m_minus, m_v1: r.m_v1, m_v2: r.m_v2, v1: r.v1 || 400, v2: r.v2 || 200, notes: r.notes || '', qc_datetime: String(r.qc_datetime).slice(0, 16), fismed_id: r.fismed_id };
  }
  /* state → field record untuk dikirim/dihitung */
  function toRecord(s) {
    var kpa = s.pUnit === 'mbar' ? N(s.press) / 10 : N(s.press);
    var r = { qc_datetime: s.qc_datetime, temp_c: N(s.temp_c), press_kpa: OK(kpa) ? Math.round(kpa * 10000) / 10000 : '', mu_set: N(s.mu_set),
      m_raw_list: (s.readings || []).map(N).filter(OK), kpol_mode: s.kpol_mode, ks_mode: s.ks_mode, notes: s.notes || '', fismed_id: s.fismed_id };
    if (s.kpol_mode === 'measured') { r.m_plus = N(s.m_plus); r.m_minus = N(s.m_minus); r.k_pol = ''; } else { r.k_pol = N(s.k_pol); r.m_plus = ''; r.m_minus = ''; }
    if (s.ks_mode === 'measured') { r.m_v1 = N(s.m_v1); r.m_v2 = N(s.m_v2); r.v1 = N(s.v1); r.v2 = N(s.v2); r.k_s = ''; } else { r.k_s = N(s.k_s); r.m_v1 = ''; r.m_v2 = ''; r.v1 = ''; r.v2 = ''; }
    return r;
  }

  function envFields(s, opts) {
    opts = opts || {};
    return '<label class="field"><span>' + (opts.tLabel || 'Suhu T (°C)') + '</span><input name="temp_c" type="number" step="0.1" inputmode="decimal" value="' + esc(s.temp_c) + '" placeholder="22.0"></label>' +
      '<label class="field"><span>' + (opts.pLabel || 'Tekanan P') + ' (' + s.pUnit + ')</span><div class="inp-unit"><input name="press" type="number" step="0.01" inputmode="decimal" value="' + esc(s.press) + '" placeholder="' + (s.pUnit === 'kPa' ? '101.33' : '1013.3') + '">' +
      '<span class="u"><button type="button" data-punit title="Ganti satuan kPa / mbar">' + s.pUnit + ' ⇄</button></span></div></label>' +
      (opts.noMu ? '' : '<label class="field"><span>Monitor Unit (MU)</span><input name="mu_set" type="number" step="1" inputmode="numeric" value="' + esc(s.mu_set) + '"></label>');
  }

  function readingsBlock(s, label) {
    var rd = s.readings.length ? s.readings : ['', '', ''];
    return '<div class="readings" id="readings">' + rd.map(function (v, i) {
      return '<label class="field reading"><span>' + (label || 'M') + (i + 1) + ' (nC)</span><input name="r' + i + '" data-reading="' + i + '" type="number" step="0.001" inputmode="decimal" value="' + esc(v) + '" placeholder="0.000">' +
        (rd.length > 1 ? '<button type="button" class="rm" data-rm="' + i + '" aria-label="Hapus bacaan ' + (i + 1) + '">' + UI.icon('x', 'ic-xs', 2) + '</button>' : '') + '</label>';
    }).join('') +
      '<div class="field"><span style="color:var(--info-text)">Rata-rata M_raw</span><div class="calc-out" id="m-avg">—</div></div></div>' +
      '<div class="row-between mt"><span class="small muted" id="m-rsd"></span>' + (rd.length < 5 ? '<button type="button" class="btn btn-text label" data-addreading>' + UI.icon('plus', 'ic-xs', 2) + ' Tambah bacaan (maks. 5)</button>' : '') + '</div>';
  }

  function factorsBlock(s) {
    return '<div class="factor-box"><div class="row-between"><div><div class="label">Faktor Polaritas (k_pol)</div><div class="small muted">Nilai tersimpan dari Master Energi, atau hitung dari bacaan M+ / M−</div></div>' +
      '<div class="seg sm"><button type="button" data-kpolmode="stored" class="' + (s.kpol_mode !== 'measured' ? 'on' : '') + '">Tersimpan</button><button type="button" data-kpolmode="measured" class="' + (s.kpol_mode === 'measured' ? 'on' : '') + '">Hitung</button></div></div>' +
      '<div class="g g-3 g-gap-sm mt">' + (s.kpol_mode === 'measured'
        ? '<label class="field"><span>M+ (nC, rutin)</span><input name="m_plus" type="number" step="0.001" value="' + esc(s.m_plus) + '"></label><label class="field"><span>M− (nC)</span><input name="m_minus" type="number" step="0.001" value="' + esc(s.m_minus) + '"></label><div class="field"><span>k_pol</span><div class="calc-out" id="kpol-out">—</div></div>'
        : '<label class="field"><span>k_pol</span><input name="k_pol" type="number" step="0.0001" value="' + esc(s.k_pol) + '"></label>') + '</div></div>' +
      '<div class="factor-box mt"><div class="row-between"><div><div class="label">Faktor Rekombinasi (k_s)</div><div class="small muted">Metode dua tegangan berkas pulsa (TRS-398): M1 pada V1 normal, M2 pada V2 rendah</div></div>' +
      '<div class="seg sm"><button type="button" data-ksmode="stored" class="' + (s.ks_mode !== 'measured' ? 'on' : '') + '">Tersimpan</button><button type="button" data-ksmode="measured" class="' + (s.ks_mode === 'measured' ? 'on' : '') + '">Hitung</button></div></div>' +
      '<div class="g g-4 g-gap-sm mt">' + (s.ks_mode === 'measured'
        ? '<label class="field"><span>M1 @V1 (nC)</span><input name="m_v1" type="number" step="0.001" value="' + esc(s.m_v1) + '"></label><label class="field"><span>M2 @V2 (nC)</span><input name="m_v2" type="number" step="0.001" value="' + esc(s.m_v2) + '"></label>' +
          '<label class="field"><span>V1 / V2 (V)</span><div class="row" style="gap:4px"><input name="v1" type="number" step="1" value="' + esc(s.v1) + '"><input name="v2" type="number" step="1" value="' + esc(s.v2) + '"></div></label><div class="field"><span>k_s</span><div class="calc-out" id="ks-out">—</div></div>'
        : '<label class="field"><span>k_s</span><input name="k_s" type="number" step="0.0001" value="' + esc(s.k_s) + '"></label>') + '</div></div>';
  }

  /* Ikat input generik ke state; onChange(structural) dipanggil saat perlu render ulang */
  function bind(root, s, onLive, onStructural) {
    root.addEventListener('input', function (e) {
      var t = e.target; if (!t.name) return;
      if (t.dataset.reading !== undefined) s.readings[+t.dataset.reading] = t.value;
      else s[t.name] = t.value;
      onLive();
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-punit')) {
        var v = N(s.press);
        if (OK(v)) s.press = s.pUnit === 'kPa' ? (v * 10).toFixed(1) : (v / 10).toFixed(3);
        s.pUnit = s.pUnit === 'kPa' ? 'mbar' : 'kPa'; onStructural();
      } else if (b.hasAttribute('data-addreading')) { if (s.readings.length < 5) s.readings.push(''); onStructural('r' + (s.readings.length - 1)); }
      else if (b.dataset.rm !== undefined) { s.readings.splice(+b.dataset.rm, 1); onStructural(); }
      else if (b.dataset.kpolmode) { s.kpol_mode = b.dataset.kpolmode; onStructural(); }
      else if (b.dataset.ksmode) { s.ks_mode = b.dataset.ksmode; onStructural(); }
    });
  }

  function updateLiveBits(root, r) {
    var q = function (sel) { return root.querySelector(sel); };
    if (q('#m-avg')) q('#m-avg').textContent = OK(r.mAvg) ? r.mAvg.toFixed(3) + ' nC' : '—';
    if (q('#m-rsd')) q('#m-rsd').textContent = OK(r.rsd) ? 'n = ' + r.nReadings + ' · RSD ' + r.rsd.toFixed(3) + '%' : r.nReadings ? 'n = ' + r.nReadings : '';
    if (q('#kpol-out')) q('#kpol-out').textContent = OK(r.kpol) ? r.kpol.toFixed(4) : '—';
    if (q('#ks-out')) q('#ks-out').textContent = OK(r.ks) ? r.ks.toFixed(4) : '—';
    if (q('#ktp-out')) q('#ktp-out').textContent = OK(r.ktp) ? r.ktp.toFixed(4) : '—';
  }

  function stCls(status) { var m = TRS398.STATUS_META[status]; return m ? 'st-' + m.cls : 'st-none'; }
  function statusLabel(status, adj) {
    if (status === 'FAIL') return adj ? 'FAIL — MASIH DI LUAR TOLERANSI' : 'FAIL — NEED ADJUSTMENT';
    if (status === 'WARNING') return adj ? 'WARNING — BELUM LAIK' : 'WARNING — PANTAU KETAT';
    if (status === 'PASS') return adj ? 'PASS — CLEARED (Laik Klinis)' : 'PASS — LAIK KLINIS';
    return 'Menunggu data pengukuran';
  }
  function issues(r) {
    var h = '';
    if (r.errors && r.errors.length) h += '<div class="notice n-fail">' + UI.icon('alertC') + '<ul>' + r.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if (r.warnings && r.warnings.length) h += '<div class="notice n-warning">' + UI.icon('alert') + '<ul>' + r.warnings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }
  function instrumentIssues(chamber, elec, day) {
    var out = [];
    [chamber, elec].forEach(function (d) {
      if (!d) return;
      var cs = AppModel.calStatus(d, day || Data.today(), Data.reminderMax());
      if (d.expiry_date && d.expiry_date < String(day || Data.today()).slice(0, 10)) out.push({ t: 'fail', m: 'Sertifikat ' + d.model_name + ' ' + d.serial_no + ' KEDALUWARSA (' + UI.date(d.expiry_date) + '). Pengukuran akan ditolak.' });
      else if (cs.status === 'EXPIRING') out.push({ t: 'warning', m: 'Sertifikat ' + d.model_name + ' berakhir dalam ' + cs.days + ' hari (' + UI.date(d.expiry_date) + ').' });
    });
    return out;
  }

  return { blankMeas: blankMeas, fromRecord: fromRecord, toRecord: toRecord, envFields: envFields, readingsBlock: readingsBlock, factorsBlock: factorsBlock,
    bind: bind, updateLiveBits: updateLiveBits, stCls: stCls, statusLabel: statusLabel, issues: issues, instrumentIssues: instrumentIssues };
})();

(function () {
  var esc = UI.esc, N = TRS398.num, OK = TRS398.ok;
  var DRAFT = 'edose_draft_input';
  var S = null, editRec = null, root = null;

  function loadDraft() { try { return JSON.parse(sessionStorage.getItem(DRAFT) || 'null'); } catch (e) { return null; } }
  function saveDraft() { if (!editRec) try { sessionStorage.setItem(DRAFT, JSON.stringify(S)); } catch (e) { } }

  function initState(params) {
    editRec = null;
    if (params[0] === 'edit' && params[1]) {
      var id = Api.resolveId(params[1]);
      editRec = Store.data.transactions.filter(function (t) { return t.qc_id === id; })[0] || null;
      if (editRec) {
        var en = Data.E()[editRec.energy_id] || {};
        S = Object.assign(MeasUI.fromRecord(editRec), { linac_id: en.linac_id, energy_id: editRec.energy_id, chamber_id: editRec.chamber_id, electrometer_id: editRec.electrometer_id,
          adj_datetime: String(editRec.adj_datetime || '').slice(0, 16), adj_category: editRec.adj_category, adj_action_desc: editRec.adj_action_desc, adj_performer: editRec.adj_performer, adj_ticket: editRec.adj_ticket });
        return;
      }
    }
    S = loadDraft();
    if (!S || !S.readings) {
      var L = Data.linacs()[0] || { energies: [] };
      var f = Data.fismeds()[0] || {};
      S = Object.assign(MeasUI.blankMeas(), { fismed_id: f.person_id, linac_id: L.linac_id, energy_id: '', chamber_id: '', electrometer_id: (Data.electrometers()[0] || {}).detector_id });
    }
    ensureSelections();
  }

  /* Pilih default yang masuk akal: energi belum diukur bulan ini, chamber dengan tabel kQ sesuai */
  function ensureSelections() {
    var L = Data.linacs();
    if (!L.some(function (l) { return l.linac_id === S.linac_id; })) S.linac_id = (L[0] || {}).linac_id;
    var linac = L.filter(function (l) { return l.linac_id === S.linac_id; })[0] || { energies: [] };
    var ens = linac.energies.filter(function (e) { return e.is_active; });
    if (!ens.some(function (e) { return e.energy_id === S.energy_id; })) {
      var ym = Data.today().slice(0, 7), done = measuredThisMonth(ym);
      var next = ens.filter(function (e) { return !done[e.energy_id]; })[0] || ens[0] || {};
      S.energy_id = next.energy_id;
      var en = Data.E()[S.energy_id] || {};
      S.k_pol = en.kpol_default || 1; S.k_s = en.ks_default || 1;
    }
    var en2 = Data.E()[S.energy_id] || {};
    var ch = Data.chambers(), good = ch.filter(function (c) { return hasKq(c.model_name, en2.beam_type); });
    if (!ch.some(function (c) { return c.detector_id === S.chamber_id; }) || (good.length && !hasKq((Data.DET()[S.chamber_id] || {}).model_name, en2.beam_type))) {
      var pref = good.filter(function (c) { return en2.beam_type === 'ELECTRON' ? c.chamber_type === 'PLANE_PARALLEL' : c.chamber_type !== 'PLANE_PARALLEL'; });
      S.chamber_id = ((pref[0] || good[0] || ch[0]) || {}).detector_id;
    }
    if (!Data.electrometers().some(function (e) { return e.detector_id === S.electrometer_id; })) S.electrometer_id = (Data.electrometers()[0] || {}).detector_id;
    if (!Data.fismeds().some(function (p) { return p.person_id === S.fismed_id; })) S.fismed_id = (Data.fismeds()[0] || {}).person_id;
  }
  function hasKq(model, bt) {
    return Store.data.kq.some(function (k) { return String(k.chamber_model).toLowerCase() === String(model || '').toLowerCase() && k.beam_type === bt; });
  }
  function measuredThisMonth(ym) {
    var done = {};
    Data.sessions().forEach(function (s) { if (String(s.datetime).slice(0, 7) === ym) done[s.energy_id] = s; });
    return done;
  }

  function compute() {
    var rec = MeasUI.toRecord(S);
    rec.energy_id = S.energy_id; rec.chamber_id = S.chamber_id; rec.electrometer_id = S.electrometer_id;
    return AppModel.recompute(rec, Store.data, editRec);
  }

  function telemetry(rc) {
    var en = Data.E()[S.energy_id] || {}, ch = Data.DET()[S.chamber_id] || {}, el = Data.DET()[S.electrometer_id] || {}, inp = rc.input, r = rc.result;
    var kqInfo = r.kqInfo && r.kqInfo.lo && !r.kqInfo.exact ? 'interpolasi ' + r.kqInfo.lo.x + '–' + r.kqInfo.hi.x : r.kqInfo && r.kqInfo.exact ? 'nilai tabel' : inp.snapshot ? 'snapshot record' : '';
    function t(k, v, sub) { return '<div><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div>'; }
    return '<div class="telemetry"><div class="row-between" style="margin-bottom:8px"><span class="label" style="color:var(--info-text)">' + UI.icon('lock', 'ic-xs', 2) + ' Parameter Referensi Terkunci</span><span class="label" style="color:var(--info-text)">' + (inp.snapshot ? 'Snapshot saat pengukuran' : 'Auto-filled dari Master Data') + '</span></div>' +
      '<div class="g g-4 g-gap-sm">' +
      t('N_D,w,Q0', OK(r.ndw) ? r.ndw.toFixed(3) + ' cGy/nC' : '—', inp.snapshot || ch.unit === 'cGy/nC' ? '' : esc(ch.cal_factor) + ' ' + esc(ch.unit)) +
      t('k_Q,Q0', OK(r.kq) ? r.kq.toFixed(4) : '<span class="t-fail">—</span>', kqInfo) +
      t(en.beam_type === 'ELECTRON' ? 'R50 (cm)' : 'TPR20,10', UI.f(inp.qualityIndex, en.beam_type === 'ELECTRON' ? 2 : 3)) +
      t('Baseline', UI.f(inp.baseline, 3) + ' cGy/MU') +
      t('Setup', esc(inp.setup) + ' ' + UI.f(en.ssd_sad_cm, 0) + ' cm') +
      t('z_ref / z_max', UI.f(en.z_ref_cm, 2) + ' / ' + UI.f(en.z_max_cm, 2) + ' cm') +
      t(inp.setup === 'SAD' ? 'TMR(z_ref)' : 'PDD(z_ref)', inp.setup === 'SAD' ? UI.f(inp.tmr, 4) : UI.f(inp.pdd, 2) + '%') +
      t('k_elec', UI.f(r.kelec, 4), esc(el.model_name)) + '</div></div>';
  }

  function panel(rc) {
    var r = rc.result, st = r.valid ? r.status : '', cls = MeasUI.stCls(st);
    var en = Data.E()[S.energy_id] || {};
    var instr = MeasUI.instrumentIssues(Data.DET()[S.chamber_id], Data.DET()[S.electrometer_id], S.qc_datetime);
    var showErr = (S.readings || []).some(function (x) { return x !== ''; }) || S.temp_c !== '' || S.press !== '';
    var btnLabel = editRec ? 'Simpan Koreksi' : st === 'FAIL' ? 'Simpan & Lanjut ke Adjustment' : 'Simpan Hasil QC';
    return '<div class="calc-hd ' + cls + '"><div class="st">' + UI.icon(st === 'FAIL' ? 'alertC' : st === 'WARNING' ? 'alert' : st === 'PASS' ? 'checkC' : 'gauge', '', 2) + '<span>' + MeasUI.statusLabel(st) + '</span></div><span class="mono small" style="font-weight:600">IAEA TRS-398</span></div>' +
      '<div style="padding:20px" class="stack">' +
      '<div class="dev-box ' + cls + '" style="border-color:' + (st ? '' : 'var(--outline-subtle)') + '"><div class="label caps muted" style="margin-bottom:4px">Deviasi Output vs Baseline</div><div class="metric-xl">' + (r.valid ? UI.dev(r.deviation) : '—') + '</div>' +
      '<div class="small" style="margin-top:4px">' + (st === 'FAIL' ? 'Melebihi Action Level (±' + r.action.toFixed(2) + '%)' : st === 'WARNING' ? 'Di antara Warning (±' + r.warn.toFixed(2) + '%) dan Action (±' + r.action.toFixed(2) + '%)' : st === 'PASS' ? 'Dalam batas Warning (±' + r.warn.toFixed(2) + '%)' : 'Isi suhu, tekanan & bacaan elektrometer') + '</div></div>' +
      '<div class="kv">' +
      '<div><span class="k">Faktor k_TP</span><span class="v" id="ktp-out">' + UI.f(r.ktp, 4) + '</span></div>' +
      '<div><span class="k">k_s × k_pol × k_elec</span><span class="v">' + UI.f(r.ks * r.kpol * r.kelec, 4) + '</span></div>' +
      '<div><span class="k">Bacaan Terkoreksi M_Q</span><span class="v">' + (OK(r.mq) ? r.mq.toFixed(3) + ' nC' : '—') + '</span></div>' +
      '<div><span class="k">Dosis D_w,Q (z_ref)</span><span class="v">' + (OK(r.dwZref) ? r.dwZref.toFixed(3) + ' cGy' : '—') + '</span></div>' +
      '<div><span class="k">Dosis D_w,Q (z_max)</span><span class="v">' + (OK(r.dwZmax) ? r.dwZmax.toFixed(3) + ' cGy' : '—') + '</span></div>' +
      '<div class="em"><span class="k">Output Terukur (z_max)</span><span class="v">' + (OK(r.output) && r.valid ? r.output.toFixed(3) + ' cGy/MU' : '—') + '</span></div></div>' +
      instr.map(function (i) { return '<div class="notice n-' + i.t + '">' + UI.icon('alert') + '<div>' + esc(i.m) + '</div></div>'; }).join('') +
      (showErr ? MeasUI.issues(r) : MeasUI.issues({ errors: (r.errors || []).filter(function (e) { return /kQ|Master|N_D,w|Baseline/.test(e); }), warnings: [] })) +
      (st === 'FAIL' && !editRec ? '<div class="notice n-warning">' + UI.icon('alert') + '<div>Data <b>As-Found</b> akan dikunci permanen, notifikasi email terkirim ke tim Fismed, dan alur dilanjutkan ke pengisian <b>Adjustment (As-Left)</b>.</div></div>' : '') +
      (editRec ? '<div class="notice n-info">' + UI.icon('history') + '<div>Mode koreksi <span class="mono">' + esc(editRec.qc_id) + '</span>. Parameter detektor & berkas memakai snapshot saat pengukuran. Alasan koreksi wajib dicatat.</div></div>' : '') +
      '<div class="stack-sm"><button type="button" id="btn-save" class="btn btn-primary btn-block btn-lg"' + (r.valid && !instr.some(function (i) { return i.t === 'fail'; }) ? '' : ' disabled') + '>' + btnLabel + ' ' + UI.icon('arrowR', '', 2) + '</button>' +
      '<button type="button" id="btn-reset" class="btn btn-ghost btn-block">' + (editRec ? 'Batal Koreksi' : 'Reset Form') + '</button></div>' +
      '<p class="small muted center" style="margin:0">' + esc(Data.energyLabel(en)) + ' · ' + esc(en.linac_name || '') + '</p></div>';
  }

  function form(rc) {
    var L = Data.linacs(), linac = L.filter(function (l) { return l.linac_id === S.linac_id; })[0] || { energies: [] };
    var done = measuredThisMonth(Data.today().slice(0, 7));
    var lock = !!editRec, isAdj = editRec && editRec.record_type === 'ADJUSTMENT';
    var fis = Data.fismeds();
    if (editRec && !fis.some(function (p) { return p.person_id === S.fismed_id; }) && Data.PER()[S.fismed_id]) fis = fis.concat([Data.PER()[S.fismed_id]]);
    var ens = linac.energies.filter(function (e) { return e.is_active || (editRec && e.energy_id === S.energy_id); });
    return '<div class="stack">' +
      '<section class="card"><div class="sec-hd"><span class="step">1</span><h2 class="h-sm">Identitas Pengukuran &amp; Pesawat</h2></div><div class="g g-2">' +
      '<label class="field"><span>Tanggal &amp; Jam Pengukuran</span><input name="qc_datetime" type="datetime-local" value="' + esc(S.qc_datetime) + '"></label>' +
      '<label class="field"><span>Fisikawan Medis Pelaksana</span><select name="fismed_id" data-struct>' + UI.options(fis, 'person_id', function (p) { return p.full_name + (p.nip_str ? ' (' + p.nip_str + ')' : ''); }, S.fismed_id) + '</select></label>' +
      '<label class="field"><span>Pesawat Linac</span><select name="linac_id" data-struct' + (lock ? ' disabled' : '') + '>' + UI.options(L, 'linac_id', function (l) { return l.linac_name + ' (' + l.serial_no + ')'; }, S.linac_id) + '</select></label>' +
      '<label class="field"><span>Energi Berkas</span><select name="energy_id" data-struct' + (lock ? ' disabled' : '') + '>' + UI.options(ens, 'energy_id', function (e) { return Data.energyLabel(e) + (done[e.energy_id] && !lock ? '  ✓ sudah diukur bulan ini' : ''); }, S.energy_id) + '</select></label>' +
      '</div></section>' +
      '<section class="card"><div class="sec-hd"><span class="step">2</span><h2 class="h-sm">Alat Ukur &amp; Parameter Otomatis</h2></div><div class="g g-2 mb">' +
      '<label class="field"><span>Ion Chamber</span><select name="chamber_id" data-struct' + (lock ? ' disabled' : '') + '>' + UI.options(Data.chambers().concat(lock && !Data.chambers().some(function (c) { return c.detector_id === S.chamber_id; }) ? [Data.DET()[S.chamber_id]] : []).filter(Boolean), 'detector_id', function (d) { return d.model_name + ' (#' + d.serial_no + ')' + (d.chamber_type === 'PLANE_PARALLEL' ? ' · plan-paralel' : ''); }, S.chamber_id) + '</select></label>' +
      '<label class="field"><span>Electrometer</span><select name="electrometer_id" data-struct' + (lock ? ' disabled' : '') + '>' + UI.options(Data.electrometers().concat(lock && !Data.electrometers().some(function (c) { return c.detector_id === S.electrometer_id; }) ? [Data.DET()[S.electrometer_id]] : []).filter(Boolean), 'detector_id', function (d) { return d.model_name + ' (#' + d.serial_no + ')'; }, S.electrometer_id) + '</select></label>' +
      '</div>' + telemetry(rc) + '</section>' +
      '<section class="card"><div class="sec-hd"><span class="step">3</span><h2 class="h-sm">Kondisi Lingkungan &amp; Pengaturan Berkas</h2></div><div class="g g-3">' + MeasUI.envFields(S) + '</div></section>' +
      '<section class="card"><div class="sec-hd"><span class="step">4</span><h2 class="h-sm">Pembacaan Elektrometer &amp; Faktor Koreksi</h2></div>' +
      MeasUI.readingsBlock(S) + '<div class="mt">' + MeasUI.factorsBlock(S) + '</div>' +
      '<label class="field mt"><span>Catatan Fisikawan Medis</span><textarea name="notes" rows="2" placeholder="Tambahkan catatan kondisi berkas atau lingkungan...">' + esc(S.notes) + '</textarea></label></section>' +
      (isAdj ? '<section class="card"><div class="sec-hd"><span class="step">5</span><h2 class="h-sm">Log Tindakan Adjustment</h2></div><div class="g g-2">' +
        '<label class="field"><span>Waktu Koreksi</span><input name="adj_datetime" type="datetime-local" value="' + esc(S.adj_datetime) + '"></label>' +
        '<label class="field"><span>Pelaksana</span><input name="adj_performer" value="' + esc(S.adj_performer) + '"></label>' +
        '<label class="field"><span>Kategori</span><input name="adj_category" value="' + esc(S.adj_category) + '"></label>' +
        '<label class="field"><span>Nomor Tiket</span><input name="adj_ticket" class="mono" value="' + esc(S.adj_ticket) + '"></label>' +
        '<label class="field span-2"><span>Uraian</span><textarea name="adj_action_desc" rows="2">' + esc(S.adj_action_desc) + '</textarea></label></div></section>' : '') +
      '</div>';
  }

  function full() {
    var rc = compute();
    return '<div class="split"><div id="in-form">' + form(rc) + '</div><aside class="card calc sticky-panel" id="in-panel">' + panel(rc) + '</aside></div>';
  }

  function live() {
    var rc = compute();
    MeasUI.updateLiveBits(root, rc.result);
    var p = root.querySelector('#in-panel');
    p.innerHTML = panel(rc);
    bindPanel();
    saveDraft();
  }
  function rerender(focusName) {
    root.innerHTML = full();
    mount(root);
    if (focusName) { var f = root.querySelector('[name="' + focusName + '"]'); if (f) f.focus(); }
    saveDraft();
  }

  function bindPanel() {
    root.querySelector('#btn-save').onclick = save;
    root.querySelector('#btn-reset').onclick = function () {
      if (editRec) { history.back(); return; }
      var keep = { fismed_id: S.fismed_id, linac_id: S.linac_id, energy_id: S.energy_id, chamber_id: S.chamber_id, electrometer_id: S.electrometer_id };
      S = Object.assign(MeasUI.blankMeas(Data.E()[S.energy_id]), keep);
      rerender();
    };
  }

  async function save() {
    var rc = compute(), r = rc.result;
    if (!r.valid) return UI.toast(r.errors.join(' '), 'error');
    var en = Data.E()[S.energy_id] || {};
    var summary = '<div class="kv" style="margin-bottom:12px"><div><span class="k">Pesawat / Energi</span><span class="v" style="font-family:var(--font)">' + esc(en.linac_name) + ' · ' + esc(Data.energyLabel(en)) + '</span></div>' +
      '<div><span class="k">Output</span><span class="v">' + r.output.toFixed(3) + ' cGy/MU</span></div><div class="em"><span class="k">Deviasi</span><span class="v ' + UI.devClass(r.status) + '">' + UI.dev(r.deviation) + '</span></div><div><span class="k">Status</span><span class="v">' + UI.badge(r.status) + '</span></div></div>';
    var rec = MeasUI.toRecord(S);
    if (editRec) {
      var reason = await UI.confirm({ title: 'Simpan koreksi ' + editRec.qc_id + '?', body: summary + (editRec.status !== r.status ? '<div class="notice n-warning">' + UI.icon('alert') + '<div>Status berubah dari <b>' + esc(editRec.status) + '</b> menjadi <b>' + esc(r.status) + '</b>.</div></div>' : ''), reason: 'Alasan koreksi (jejak audit)', ok: 'Simpan Koreksi' });
      if (!reason) return;
      rec.qc_id = editRec.qc_id;
      ['adj_datetime', 'adj_category', 'adj_action_desc', 'adj_performer', 'adj_ticket'].forEach(function (k) { if (editRec.record_type === 'ADJUSTMENT') rec[k] = S[k]; });
      var u = await Api.mutate('updateQC', { record: rec, reason: reason });
      if (!u.success) return UI.toast(esc(u.message), 'error');
      UI.toast(u.unchanged ? 'Tidak ada perubahan.' : 'Koreksi disimpan — seluruh rumus dihitung ulang. Status: ' + esc(r.status), 'success');
      App.go('#/riwayat');
      return;
    }
    var ok = await UI.confirm({ title: r.status === 'FAIL' ? 'Simpan As-Found berstatus FAIL?' : 'Simpan hasil QC?', body: summary, ok: r.status === 'FAIL' ? 'Kunci As-Found & Lanjut' : 'Simpan', danger: r.status === 'FAIL' });
    if (!ok) return;
    rec.energy_id = S.energy_id; rec.chamber_id = S.chamber_id; rec.electrometer_id = S.electrometer_id;
    try { sessionStorage.setItem('edose_last_submit', JSON.stringify(S)); } catch (e) { }
    var res = await Api.mutate('saveQC', { record: rec });
    if (!res.success) return UI.toast(esc(res.message), 'error');
    sessionStorage.removeItem(DRAFT);
    var id = res.record.qc_id;
    if (res.record.status === 'FAIL') {
      UI.toast('As-Found terkunci. ' + (Api.isDemo() ? '' : 'Email alert akan dikirim server ke tim. ') + 'Lanjutkan pengisian Adjustment.', 'warning');
      S = null; App.go('#/adjustment/' + encodeURIComponent(id));
      return;
    }
    UI.toast('<b>' + esc(Data.energyLabel(en)) + '</b> tersimpan: ' + UI.dev(res.record.deviation_pct) + ' ' + esc(res.record.status), 'success', { action: 'Lihat', onAction: function () { openSessionDetail(Api.resolveId(id)); } });
    /* lanjut ke energi berikutnya pada pesawat yang sama */
    var keep = { fismed_id: S.fismed_id, linac_id: S.linac_id, chamber_id: S.chamber_id, electrometer_id: S.electrometer_id, temp_c: S.temp_c, press: S.press, pUnit: S.pUnit, mu_set: S.mu_set };
    S = Object.assign(MeasUI.blankMeas(), keep, { energy_id: '' });
    ensureSelections();
    rerender('r0');
  }

  function mount(el) {
    root = el;
    var form = el.querySelector('#in-form');
    MeasUI.bind(form, S, live, rerender);
    form.querySelectorAll('select[data-struct]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        S[sel.name] = sel.value;
        if (sel.name === 'linac_id') S.energy_id = '';
        if (sel.name === 'energy_id' || sel.name === 'linac_id') { S.chamber_id = S.chamber_id; var en = Data.E()[S.energy_id]; if (en) { S.k_pol = en.kpol_default || 1; S.k_s = en.ks_default || 1; } }
        ensureSelections(); rerender();
      });
    });
    MeasUI.updateLiveBits(el, compute().result);
    bindPanel();
  }

  Pages.input = {
    title: function (p) { return p[0] === 'edit' ? 'Koreksi Data QC — IAEA TRS-398' : 'Input QC Absolut — IAEA TRS-398'; },
    live: false,
    actions: function (p) {
      return '<button class="btn btn-ghost btn-sm" data-href="#/dashboard">' + UI.icon('chevL', '', 2) + 'Dashboard</button> ' +
        (p[0] === 'edit' ? '<span class="badge b-warning" style="padding:6px 12px">Mode Koreksi</span>' : '<span class="badge b-info" style="padding:6px 12px">Sesi Baru (As-Found)</span>');
    },
    render: function (p) {
      initState(p);
      if (p[0] === 'edit' && !editRec) return '<div class="empty card">' + UI.icon('alertC') + '<div>Data tidak ditemukan.</div></div>';
      if (!Data.linacs().length) return '<div class="empty card">' + UI.icon('atom') + '<div>Belum ada pesawat Linac aktif. Tambahkan di <a href="#/linac">Master Pesawat Linac</a>.</div></div>';
      return full();
    },
    mount: function (el, p) { if (!S || (p[0] === 'edit' && !editRec) || !el.querySelector('#in-form')) return; mount(el); },
    onData: function (reason) {
      /* master berubah (mis. dari tab lain) → hitung ulang panel tanpa menghapus isian */
      if (root && root.querySelector('#in-panel') && (reason === 'sync' || reason === 'confirmed')) live();
    }
  };
})();
