/* =====================================================================
 * W-04 · Adjustment & CAPA (As-Found → As-Left, multi-iterasi)
 * ===================================================================== */
(function () {
  var esc = UI.esc, N = TRS398.num, OK = TRS398.ok;
  var S = null, sid = null, view = 'new', root = null, lastS = null;
  var CATS = ['Monitor Chamber Gain Adjustment', 'Beam Steering / Servo Tuning', 'Dose Rate Calibration', 'Penggantian Komponen (Magnetron/Klystron/Gun)', 'Verifikasi Ulang Setup / Alat Ukur', 'Lainnya'];

  function listView() {
    var all = Data.sessions(), E = Data.E();
    var hold = all.filter(function (s) { return s.status === 'HOLD'; });
    var warn = all.filter(function (s) { return s.status === 'WARNING' && !s.hasAdjustment; }).slice(0, 8);
    var done = all.filter(function (s) { return s.status === 'CLEARED'; }).slice(0, 6);
    function card(s, kind) {
      var e = E[s.energy_id] || {}, af = s.asFound;
      return '<article class="card card-hover ' + (kind === 'hold' ? 'top-fail' : kind === 'warn' ? 'top-warn' : 'top-ok') + '"><div class="row-between"><div><div class="h-sm">' + esc(e.linac_name) + ' — ' + esc(Data.energyLabel(e)) + '</div>' +
        '<div class="mono small muted">' + esc(s.id) + ' · ' + UI.date(s.datetime, true) + '</div></div>' + UI.badge(s.status) + '</div>' +
        '<div class="row mt wrap" style="gap:16px"><span class="small muted">As-Found <b class="mono ' + UI.devClass(af.status) + '">' + UI.dev(af.deviation_pct) + '</b></span>' +
        (s.adjustments.length ? '<span class="small muted">Iterasi terakhir <b class="mono ' + UI.devClass(s.final.status) + '">' + UI.dev(s.final.deviation_pct) + '</b> (' + s.adjustments.length + 'x)</span>' : '') + '</div>' +
        '<div class="row mt" style="justify-content:flex-end">' + (kind === 'done' ? '<button class="btn btn-ghost btn-sm" data-go="#/adjustment/' + encodeURIComponent(s.id) + '">Lihat Rekam Jejak</button>' :
          '<button class="btn ' + (kind === 'hold' ? 'btn-danger' : 'btn-outline') + ' btn-sm" data-go="#/adjustment/' + encodeURIComponent(s.id) + '">' + UI.icon('wrench') + (s.adjustments.length ? 'Lanjutkan Adjustment #' + (s.adjustments.length + 1) : 'Mulai Adjustment') + '</button>') + '</div></article>';
    }
    return '<div class="stack"><section><div class="row-between mb"><h2 class="h-md">Menunggu Adjustment (HOLD)</h2><span class="badge b-fail">' + hold.length + ' sesi</span></div>' +
      (hold.length ? '<div class="cards-3">' + hold.map(function (s) { return card(s, 'hold'); }).join('') + '</div>' : '<div class="card empty">' + UI.icon('checkC') + '<div>Tidak ada berkas berstatus HOLD. Semua energi laik klinis.</div></div>') + '</section>' +
      (warn.length ? '<section><div class="row-between mb"><h2 class="h-md">Status WARNING (adjustment opsional)</h2></div><div class="cards-3">' + warn.map(function (s) { return card(s, 'warn'); }).join('') + '</div></section>' : '') +
      (done.length ? '<section><div class="row-between mb"><h2 class="h-md">Selesai (PASS Cleared) Terbaru</h2></div><div class="cards-3">' + done.map(function (s) { return card(s, 'done'); }).join('') + '</div></section>' : '') + '</div>';
  }

  function initState(s) {
    var af = s.asFound, en = Data.E()[af.energy_id] || {};
    var last = s.adjustments[s.adjustments.length - 1];
    var base = MeasUI.blankMeas(en);
    S = Object.assign(base, {
      fismed_id: af.fismed_id, mu_set: af.mu_set, kpol_mode: 'stored', k_pol: af.k_pol, ks_mode: 'stored', k_s: af.k_s,
      temp_c: '', press: '', adj_datetime: UI.nowLocalInput(), adj_category: last ? last.adj_category : CATS[0], adj_action_desc: '', adj_performer: last ? last.adj_performer : '', adj_ticket: last ? last.adj_ticket : ''
    });
  }

  function compute(s) {
    var rec = MeasUI.toRecord(S);
    rec.energy_id = s.asFound.energy_id; rec.chamber_id = s.asFound.chamber_id; rec.electrometer_id = s.asFound.electrometer_id;
    return AppModel.recompute(rec, Store.data, s.asFound);
  }

  function lockedBanner(s) {
    var af = s.asFound, E = Data.E(), D = Data.DET(), P = Data.PER(), en = E[af.energy_id] || {}, ch = D[af.chamber_id] || {};
    return '<section class="locked"><div class="row-between mb"><div class="row wrap"><span class="badge b-muted" style="background:#fff;border-color:var(--outline);color:var(--on-surface)">' + UI.icon('lock', 'ic-xs', 2) + 'Immutable As-Found Record</span>' +
      '<span class="mono small muted">' + UI.date(af.qc_datetime, true) + ' WIB</span></div><span class="mono t-fail" style="font-weight:700">' + UI.f(af.output_cgy_mu, 3) + ' cGy/MU (' + UI.dev(af.deviation_pct) + ' ' + esc(af.status) + ')</span></div>' +
      '<div class="g g-4 g-gap-sm" style="font-size:13px"><div><span class="muted" style="display:block">Pesawat Linac</span><b class="t1" style="color:var(--primary)">' + esc(en.linac_name) + '</b></div>' +
      '<div><span class="muted" style="display:block">Energi Berkas</span><b style="color:var(--primary)">' + esc(Data.energyLabel(en)) + '</b></div>' +
      '<div><span class="muted" style="display:block">Detektor</span><b style="color:var(--primary)">' + esc(ch.model_name) + ' #' + esc(ch.serial_no) + '</b></div>' +
      '<div><span class="muted" style="display:block">Fisikawan Awal</span><b style="color:var(--primary)">' + esc((P[af.fismed_id] || {}).full_name) + '</b></div></div></section>';
  }

  function iterBar(s) {
    var cleared = s.status === 'CLEARED';
    return '<div class="iter">' + s.adjustments.map(function (a) {
      return '<button type="button" data-view="' + esc(a.qc_id) + '" class="' + (view === a.qc_id ? 'on' : '') + '">' + (a.status === 'PASS' ? UI.icon('check', 'ic-xs', 2.5) : UI.icon('x', 'ic-xs', 2.5)) + 'Adjustment #' + a.iteration_no + '</button>';
    }).join('') + (cleared ? '' : '<button type="button" data-view="new" class="new ' + (view === 'new' ? 'on' : '') + '">' + UI.icon('plus', 'ic-xs', 2.5) + (s.adjustments.length ? 'Iterasi Adjustment #' + (s.adjustments.length + 1) : 'Adjustment #1') + '</button>') + '</div>';
  }

  function resultCard(status, dev, out, lim) {
    var cls = MeasUI.stCls(status);
    return '<div class="result-card ' + cls + ' stack-sm"><span class="badge ' + (status === 'PASS' ? 'b-cleared' : status === 'WARNING' ? 'b-warning' : status === 'FAIL' ? 'b-fail' : 'b-muted') + '">' +
      (status === 'PASS' ? UI.icon('check', 'ic-xs', 2.5) : status ? UI.icon('alert', 'ic-xs', 2.5) : '') + MeasUI.statusLabel(status, true) + '</span>' +
      '<div class="metric-xl ' + (status === 'PASS' ? 't-cleared' : status === 'WARNING' ? 't-warning' : status === 'FAIL' ? 't-fail' : 't-muted') + '">' + (OK(dev) ? UI.dev(dev) : '—') + '</div>' +
      '<div class="mono" style="font-weight:600;color:var(--primary)">Output As-Left: ' + (OK(out) ? out.toFixed(3) + ' cGy/MU' : '—') + '</div>' +
      '<p class="small ' + (status === 'PASS' ? 't-cleared' : 'muted') + '" style="margin:0">' + (status === 'PASS' ? 'Dalam batas toleransi PASS (±' + lim.warn.toFixed(2) + '%)' : status ? 'Belum memenuhi PASS (±' + lim.warn.toFixed(2) + '%) — lanjutkan iterasi berikutnya' : 'Isi T, P & bacaan ulang') + '</p></div>';
  }

  function compare(af, alDev, alOut, alStatus) {
    return '<section class="card"><h2 class="h-sm mb">3. Ringkasan Transformasi As-Found → As-Left</h2><div class="compare">' +
      '<div class="side" style="background:var(--fail-banner);border-color:var(--fail-border)"><div><div class="label caps t-fail">As-Found (Terkunci)</div><div class="big t-fail">' + UI.f(af.output_cgy_mu, 3) + ' cGy/MU</div></div><span class="badge b-fail mono">' + UI.dev(af.deviation_pct) + ' ' + esc(af.status) + '</span></div>' +
      '<div class="arrow center" style="color:var(--primary)">' + UI.icon('arrowR', '', 2) + '</div>' +
      '<div class="side" style="background:' + (alStatus === 'PASS' ? 'rgba(220,252,231,.6)' : 'var(--subtle)') + ';border-color:' + (alStatus === 'PASS' ? 'var(--pass-border)' : 'var(--outline-subtle)') + '"><div><div class="label caps ' + (alStatus === 'PASS' ? 't-cleared' : 'muted') + '">As-Left (Pasca-Koreksi)</div><div class="big ' + UI.devClass(alStatus === 'PASS' ? 'CLEARED' : alStatus) + '">' + (OK(alOut) ? alOut.toFixed(3) + ' cGy/MU' : '—') + '</div></div>' +
      (alStatus ? '<span class="badge ' + (alStatus === 'PASS' ? 'b-cleared' : alStatus === 'WARNING' ? 'b-warning' : 'b-fail') + ' mono">' + UI.dev(alDev) + ' ' + esc(alStatus) + '</span>' : '') + '</div></div></section>';
  }

  function readOnlyIter(s, a) {
    var lim = { warn: N(a.warning_limit_used), action: N(a.action_limit_used) };
    return '<section class="card"><div class="row-between mb"><h2 class="h-sm">Adjustment #' + a.iteration_no + ' — <span class="mono small">' + esc(a.qc_id) + '</span></h2><button class="btn btn-ghost btn-sm" data-href="#/input/edit/' + encodeURIComponent(a.qc_id) + '">' + UI.icon('pen') + 'Koreksi</button></div>' +
      '<div class="split"><div class="stack-sm"><div class="notice n-info">' + UI.icon('wrench') + '<div><b>' + esc(a.adj_category) + '</b> · ' + UI.date(a.adj_datetime, true) + '<br>' + esc(a.adj_action_desc) + '<br><span class="small">Pelaksana: ' + esc(a.adj_performer) + (a.adj_ticket ? ' · Tiket <span class="mono">' + esc(a.adj_ticket) + '</span>' : '') + '</span></div></div>' +
      '<div class="kv"><div><span class="k">Waktu ukur ulang</span><span class="v">' + UI.date(a.qc_datetime, true) + '</span></div><div><span class="k">T / P</span><span class="v">' + UI.f(a.temp_c, 1) + ' °C / ' + UI.f(a.press_kpa, 2) + ' kPa</span></div>' +
      '<div><span class="k">k_TP</span><span class="v">' + UI.f(a.k_tp, 4) + '</span></div><div><span class="k">M_raw (nC)</span><span class="v">' + (a.m_raw_list || []).map(function (x) { return UI.f(x, 3); }).join(' · ') + '</span></div>' +
      '<div><span class="k">Rata-rata</span><span class="v">' + UI.f(a.m_raw_avg, 3) + ' nC</span></div></div></div>' + resultCard(a.status, N(a.deviation_pct), N(a.output_cgy_mu), lim) + '</div></section>' + compare(s.asFound, N(a.deviation_pct), N(a.output_cgy_mu), a.status);
  }

  function newIter(s, rc) {
    var r = rc.result, af = s.asFound, D = Data.DET(), ch = D[af.chamber_id] || {};
    var lim = { warn: r.warn, action: r.action };
    var instr = MeasUI.instrumentIssues(D[af.chamber_id], D[af.electrometer_id], S.qc_datetime);
    return '<section class="card"><h2 class="h-sm mb">1. Log Intervensi &amp; Tindakan Perbaikan (CAPA)</h2><div class="g g-2">' +
      '<label class="field"><span>Waktu Pelaksanaan Koreksi</span><input name="adj_datetime" type="datetime-local" value="' + esc(S.adj_datetime) + '"></label>' +
      '<label class="field"><span>Teknisi / FSE / Fisikawan Pelaksana <b class="req">*</b></span><input name="adj_performer" value="' + esc(S.adj_performer) + '" placeholder="Nama pelaksana perbaikan"></label>' +
      '<label class="field"><span>Kategori Tindakan</span><select name="adj_category">' + UI.options(CATS, function (x) { return x; }, function (x) { return x; }, S.adj_category) + '</select></label>' +
      '<label class="field"><span>Nomor Tiket Servis (Opsional)</span><input name="adj_ticket" class="mono" value="' + esc(S.adj_ticket) + '" placeholder="SR-XXXX-2026-000"></label>' +
      '<label class="field span-2"><span>Uraian Tindakan Perbaikan <b class="req">*</b></span><textarea name="adj_action_desc" rows="2" placeholder="Contoh: kalibrasi gain monitor chamber channel 1 & 2 sebesar -2.5% pada service mode...">' + esc(S.adj_action_desc) + '</textarea></label></div></section>' +
      '<section class="card"><div class="row-between mb"><h2 class="h-sm">2. Pengukuran Ulang Pasca-Adjustment (As-Left)</h2></div>' +
      '<div class="split"><div class="stack-sm"><div class="row wrap"><span class="chip">Inherited N_D,w = ' + UI.f(af.n_dw, 3) + ' cGy/nC</span><span class="chip">Inherited k_Q = ' + UI.f(af.k_q, 4) + '</span><span class="chip">' + esc(ch.model_name) + '</span></div>' +
      '<div class="g g-2 g-gap-sm"><label class="field"><span>Waktu Ukur Ulang</span><input name="qc_datetime" type="datetime-local" value="' + esc(S.qc_datetime) + '"></label>' +
      '<label class="field"><span>Fismed Pengukur</span><select name="fismed_id">' + UI.options(Data.fismeds(), 'person_id', function (p) { return p.full_name; }, S.fismed_id) + '</select></label></div>' +
      '<div class="g g-3 g-gap-sm">' + MeasUI.envFields(S, { tLabel: 'Suhu T Baru (°C)', pLabel: 'Tekanan P Baru', noMu: true }) + '<div class="field"><span style="color:var(--info-text)">k_TP Baru</span><div class="calc-out" id="ktp-out">' + UI.f(r.ktp, 4) + '</div></div>' +
      '<label class="field"><span>MU</span><input name="mu_set" type="number" value="' + esc(S.mu_set) + '"></label></div>' +
      '<div class="sub-lbl">Bacaan ulang rutin</div>' + MeasUI.readingsBlock(S) +
      '<details class="mt"' + (S.kpol_mode === 'measured' || S.ks_mode === 'measured' ? ' open' : '') + '><summary class="label" style="cursor:pointer;color:var(--secondary)">Faktor k_pol &amp; k_s (default: nilai As-Found)</summary><div class="mt">' + MeasUI.factorsBlock(S) + '</div></details>' +
      '<label class="field"><span>Catatan</span><textarea name="notes" rows="2" placeholder="Opsional">' + esc(S.notes) + '</textarea></label></div>' +
      '<div class="stack-sm" id="adj-result">' + resultCard(r.valid ? r.status : '', r.deviation, r.output, lim) + instr.map(function (i) { return '<div class="notice n-' + i.t + '">' + UI.icon('alert') + '<div>' + esc(i.m) + '</div></div>'; }).join('') +
      ((S.readings || []).some(function (x) { return x !== ''; }) ? MeasUI.issues(r) : '') + '</div></div></section>' +
      '<div id="adj-compare">' + compare(af, r.deviation, r.output, r.valid ? r.status : '') + '</div>';
  }

  function actionBar(s, rc) {
    if (s.status === 'CLEARED' || view !== 'new') {
      return '<footer class="action-bar"><button class="btn btn-ghost" data-href="#/adjustment">' + UI.icon('chevL', '', 2) + 'Daftar Adjustment</button><div class="row">' +
        '<button class="btn btn-outline" data-href="#/laporan/' + encodeURIComponent(s.id) + '">' + UI.icon('printer') + 'Laporan PDF Sesi</button>' +
        (s.status !== 'CLEARED' ? '<button class="btn btn-primary" data-view="new">' + UI.icon('plus') + 'Iterasi Berikutnya</button>' : '') + '</div></footer>';
    }
    var r = rc.result, pass = r.valid && r.status === 'PASS';
    var dis = !r.valid || !String(S.adj_action_desc || '').trim() || !String(S.adj_performer || '').trim();
    return '<footer class="action-bar"><button class="btn btn-ghost hide-sm" data-href="#/adjustment">Batal</button><div class="row wrap act-btns">' +
      '<span class="small muted hide-sm" id="adj-hint">' + (dis ? 'Lengkapi uraian tindakan, pelaksana & bacaan ulang' : '') + '</span>' +
      (pass ? '' : '<button class="btn btn-ghost" id="btn-hold"' + (dis ? ' disabled' : '') + '>Simpan sebagai Hold (Iterasi #' + (s.adjustments.length + 1) + ')</button>') +
      '<button class="btn btn-success" id="btn-clear"' + (dis || !pass ? ' disabled' : '') + '>' + UI.icon('checkC', '', 2) + 'Selesaikan Adjustment &amp; Nyatakan Laik Klinis</button></div></footer>';
  }

  function detailView(s) {
    view = Api.resolveId(view);
    if (s.status === 'CLEARED' && (view === 'new' || !s.adjustments.some(function (a) { return a.qc_id === view; }))) view = s.adjustments[s.adjustments.length - 1].qc_id;
    var rc = view === 'new' ? compute(s) : null;
    var body = lockedBanner(s) + iterBar(s);
    if (view !== 'new') {
      var a = s.adjustments.filter(function (x) { return x.qc_id === view; })[0];
      body += a ? readOnlyIter(s, a) : '';
    } else body += '<div id="adj-new">' + newIter(s, rc) + '</div>';
    return '<div class="stack">' + body + '</div>' + actionBar(s, rc || compute(s));
  }

  function live(s) {
    var rc = compute(s), r = rc.result;
    MeasUI.updateLiveBits(root, r, S);
    var D = Data.DET(), instr = MeasUI.instrumentIssues(D[s.asFound.chamber_id], D[s.asFound.electrometer_id], S.qc_datetime);
    root.querySelector('#adj-result').innerHTML = resultCard(r.valid ? r.status : '', r.deviation, r.output, { warn: r.warn, action: r.action }) +
      instr.map(function (i) { return '<div class="notice n-' + i.t + '">' + UI.icon('alert') + '<div>' + esc(i.m) + '</div></div>'; }).join('') + ((S.readings || []).some(function (x) { return x !== ''; }) ? MeasUI.issues(r) : '');
    root.querySelector('#adj-compare').innerHTML = compare(s.asFound, r.deviation, r.output, r.valid ? r.status : '');
    var bar = root.querySelector('.action-bar'), tmp = document.createElement('div');
    tmp.innerHTML = actionBar(s, rc); bar.replaceWith(tmp.firstChild);
    bindBar(s);
  }

  function bindBar(s) {
    root.querySelectorAll('.action-bar [data-href]').forEach(function (b) { b.onclick = function () { App.go(b.dataset.href); }; });
    root.querySelectorAll('.action-bar [data-view]').forEach(function (b) { b.onclick = function () { view = b.dataset.view; App.render({ keepScroll: true }); }; });
    var h = root.querySelector('#btn-hold'), c = root.querySelector('#btn-clear');
    if (h) h.onclick = function () { save(s, false); };
    if (c) c.onclick = function () { save(s, true); };
  }

  async function save(s, clear) {
    var rc = compute(s), r = rc.result;
    if (!r.valid) return UI.toast(r.errors.join(' '), 'error');
    var ok = await UI.confirm({
      title: clear ? 'Nyatakan berkas Laik Klinis?' : 'Simpan iterasi sebagai HOLD?',
      body: '<p>Adjustment #' + (s.adjustments.length + 1) + ' — deviasi As-Left <b class="mono ' + UI.devClass(r.status) + '">' + UI.dev(r.deviation) + '</b> (' + r.output.toFixed(3) + ' cGy/MU).</p>' +
        (clear ? '<div class="notice n-pass">' + UI.icon('checkC') + '<div>Status sesi berubah menjadi <b>PASS (Cleared)</b>. As-Found tetap tersimpan utuh untuk audit.</div></div>' : '<div class="notice n-warning">' + UI.icon('alert') + '<div>Berkas tetap <b>HOLD</b> dan tidak boleh dipakai klinis sampai iterasi berikutnya PASS.</div></div>'),
      ok: clear ? 'Ya, Laik Klinis' : 'Simpan Hold', success: clear
    });
    if (!ok) return;
    var rec = MeasUI.toRecord(S);
    rec.session_group_id = s.id;
    ['adj_datetime', 'adj_category', 'adj_action_desc', 'adj_performer', 'adj_ticket'].forEach(function (k) { rec[k] = S[k]; });
    var res = await Api.mutate('saveAdjustment', { record: rec });
    if (!res.success) return UI.toast(esc(res.message), 'error');
    UI.toast(clear ? '<b>PASS (Cleared)</b> — ' + esc(s.id) + ' laik klinis.' : 'Iterasi #' + res.record.iteration_no + ' disimpan. Berkas masih HOLD.', clear ? 'success' : 'warning');
    view = clear ? res.record.qc_id : 'new';
    lastS = { sid: s.id, state: S }; S = null;
    App.render();
  }

  Pages.adjustment = {
    title: function (p) { return p[0] ? 'Adjustment & CAPA — ' + Api.resolveId(p[0]) : 'Adjustment & CAPA'; },
    live: false,
    actions: function (p) {
      if (!p[0]) return '';
      var s = Data.session(Api.resolveId(p[0]));
      return s ? (s.status === 'HOLD' ? '<span class="badge b-fail" style="padding:6px 12px">NEED ADJUSTMENT / HOLD</span>' : UI.badge(s.status)) : '';
    },
    render: function (p) {
      if (!p[0]) { sid = null; return listView(); }
      var id = Api.resolveId(p[0]);
      if (id !== p[0]) { history.replaceState(null, '', '#/adjustment/' + encodeURIComponent(id)); }
      var s = Data.session(id);
      if (!s || !s.asFound) return '<div class="card empty">' + UI.icon('alertC') + '<div>Sesi ' + esc(id) + ' tidak ditemukan.</div></div>';
      if (sid !== id) { sid = id; view = s.status === 'CLEARED' ? s.adjustments[s.adjustments.length - 1].qc_id : 'new'; S = null; }
      if (s.asFound.status === 'PASS') return lockedBanner(s) + '<div class="card empty mt">' + UI.icon('checkC') + '<div>As-Found berstatus PASS — tidak memerlukan adjustment.</div></div>';
      if (!S) initState(s);
      return detailView(s);
    },
    mount: function (el, p) {
      root = el;
      el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { App.go(b.dataset.go); }; });
      el.querySelectorAll('[data-href]').forEach(function (b) { b.onclick = function () { App.go(b.dataset.href); }; });
      if (!p[0]) return;
      var s = Data.session(Api.resolveId(p[0])); if (!s || !s.asFound) return;
      el.querySelectorAll('.iter [data-view]').forEach(function (b) { b.onclick = function () { view = b.dataset.view; App.render({ keepScroll: true }); }; });
      var nw = el.querySelector('#adj-new');
      if (nw) {
        MeasUI.bind(nw, S, function () { live(s); }, function (focus) { App.render({ keepScroll: true }); if (focus) { var f = root.querySelector('[name="' + focus + '"]'); if (f) f.focus(); } });
        nw.querySelectorAll('select').forEach(function (sel) { sel.addEventListener('change', function () { S[sel.name] = sel.value; live(s); }); });
        MeasUI.updateLiveBits(el, compute(s).result, S);
      }
      bindBar(s);
    },
    onData: function (reason) {
      var p = App.current().params;
      if (!p[0]) { App.render({ keepScroll: true }); return; }
      if (reason === 'rejected' && lastS && lastS.sid === Api.resolveId(p[0])) { S = lastS.state; view = 'new'; lastS = null; App.render({ keepScroll: true }); return; }
      if (reason === 'confirmed' || reason === 'sync' || reason === 'rejected') {
        var id = Api.resolveId(p[0]);
        if (id !== p[0] || view !== 'new') App.render({ keepScroll: true });
      }
    }
  };
})();
