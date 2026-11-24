/* =====================================================================
 * W-02 · Dashboard Monitoring & Control Chart
 * ===================================================================== */
(function () {
  var st = { linac: '', energy: '', range: '6', from: '', to: '', mode: 'dev', showAdj: true };
  var esc = UI.esc;

  /* Kartu detail sesi (dipakai dashboard, riwayat, adjustment) */
  window.openSessionDetail = function (id) {
    var s = Data.session(id);
    if (!s) return UI.toast('Sesi tidak ditemukan.', 'error');
    var E = Data.E(), D = Data.DET(), P = Data.PER(), en = E[s.energy_id] || {};
    var recs = s.records.slice().sort(function (a, b) { return a.iteration_no - b.iteration_no; });
    function block(r) {
      var ch = D[r.chamber_id] || {}, el = D[r.electrometer_id] || {};
      var edits = (r.edit_log || []).map(function (l) {
        return '<li><span class="mono">' + esc(String(l.at).replace('T', ' ').slice(0, 16)) + '</span> — ' + esc(l.reason) + ' <span class="muted">(' + l.changes.map(function (c) { return esc(c.f); }).join(', ') + '; status sebelumnya ' + esc(l.oldStatus) + ' ' + UI.dev(l.oldDev) + ')</span></li>';
      }).join('');
      return '<div class="card" style="box-shadow:none;margin-bottom:12px"><div class="row-between mb"><div><b class="h-sm">' + (r.record_type === 'AS_FOUND' ? 'As-Found' : 'Adjustment #' + r.iteration_no) + '</b> <span class="mono small muted">' + esc(r.qc_id) + '</span>' +
        (r.record_type === 'AS_FOUND' ? ' <span class="badge b-muted b-sm">' + UI.icon('lock', 'ic-xs') + 'Terkunci</span>' : '') + '</div>' + UI.badge(r.status) + '</div>' +
        (r.record_type === 'ADJUSTMENT' ? '<div class="notice n-info mb"><div><b>' + esc(r.adj_category) + '</b> · ' + UI.date(r.adj_datetime, true) + '<br>' + esc(r.adj_action_desc) + '<br><span class="small">Pelaksana: ' + esc(r.adj_performer) + (r.adj_ticket ? ' · Tiket <span class="mono">' + esc(r.adj_ticket) + '</span>' : '') + '</span></div></div>' : '') +
        '<div class="g g-2 g-gap-sm"><div class="kv">' +
        kv('Tanggal ukur', UI.date(r.qc_datetime, true)) + kv('Fismed', (P[r.fismed_id] || {}).full_name || '—') + kv('Ion chamber', ch.model_name + ' ' + (ch.serial_no || '')) + kv('Elektrometer', el.model_name + ' ' + (el.serial_no || '')) +
        kv('T / P', UI.f(r.temp_c, 1) + ' °C / ' + UI.f(r.press_kpa, 2) + ' kPa') + kv('MU', UI.f(r.mu_set, 0)) + kv('M_raw (nC)', (r.m_raw_list || []).map(function (x) { return UI.f(x, 3); }).join(' · ')) +
        '</div><div class="kv">' + kv('k_TP', UI.f(r.k_tp, 4)) + kv('k_pol · k_s · k_elec', UI.f(r.k_pol, 4) + ' · ' + UI.f(r.k_s, 4) + ' · ' + UI.f(r.k_elec, 4)) +
        kv('N_D,w · k_Q', UI.f(r.n_dw, 4) + ' · ' + UI.f(r.k_q, 4)) + kv('M_Q', UI.f(r.m_q, 4) + ' nC') + kv('D_w(z_ref)', UI.f(r.dw_zref, 3) + ' cGy') + kv('D_w(z_max)', UI.f(r.dw_zmax, 3) + ' cGy') +
        '<div class="em"><span class="k">Output · Deviasi</span><span class="v ' + UI.devClass(r.status) + '">' + UI.f(r.output_cgy_mu, 3) + ' cGy/MU · ' + UI.dev(r.deviation_pct) + '</span></div></div></div>' +
        (r.notes ? '<p class="small mt"><b>Catatan:</b> ' + esc(r.notes) + '</p>' : '') +
        (edits ? '<div class="mt small"><b>Riwayat koreksi (audit):</b><ul style="margin:4px 0 0;padding-left:18px">' + edits + '</ul></div>' : '') +
        '<div class="row mt" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-edit="' + esc(r.qc_id) + '">' + UI.icon('pen') + 'Koreksi Data</button></div></div>';
    }
    function kv(k, v) { return '<div><span class="k">' + k + '</span><span class="v">' + esc(v) + '</span></div>'; }
    UI.modal({
      size: 'lg', titleHtml: 'Detail Sesi <span class="mono">' + esc(s.id) + '</span>',
      body: '<div class="row-between mb"><div><div class="h-sm">' + esc(en.linac_name) + ' — ' + esc(Data.energyLabel(en)) + '</div><div class="small muted">' + s.adjustments.length + ' iterasi adjustment</div></div>' + UI.badge(s.status) + '</div>' + recs.map(block).join(''),
      footer: (s.status === 'HOLD' || (s.status === 'WARNING' && !s.hasAdjustment) ? '<button class="btn btn-danger-outline" data-go="#/adjustment/' + encodeURIComponent(s.id) + '">' + UI.icon('wrench') + (s.hasAdjustment ? 'Lanjutkan Adjustment' : 'Input Adjustment') + '</button>' : '') +
        '<button class="btn btn-outline" data-go="#/laporan/' + encodeURIComponent(s.id) + '">' + UI.icon('printer') + 'Laporan PDF</button><button class="btn btn-primary" data-close>Tutup</button>',
      onMount: function (el, close) {
        el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { close(); App.go(b.dataset.go); }; });
        el.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { close(); App.go('#/input/edit/' + encodeURIComponent(b.dataset.edit)); }; });
      }
    });
  };

  function linacCard(l) {
    var ls = Data.linacStatus(l), holds = ls.items.filter(function (i) { return i.session && i.session.status === 'HOLD'; });
    var top = ls.worst === 'HOLD' || ls.worst === 'FAIL' ? 'top-fail' : ls.worst === 'WARNING' ? 'top-warn' : 'top-ok';
    var lastS = ls.items.filter(function (i) { return i.session; }).sort(function (a, b) { return a.session.datetime < b.session.datetime ? 1 : -1; })[0];
    var fm = lastS ? (Data.PER()[lastS.session.asFound.fismed_id] || {}).full_name : '';
    return '<article class="card card-hover lcard ' + top + '"><div><div class="hd"><div><h2 class="h-sm">' + esc(l.linac_name) + '</h2><p class="mono small muted" style="margin:0">' + esc(l.serial_no) + ' · ' + (ls.last ? UI.date(ls.last) : 'belum ada data') + '</p></div>' +
      (ls.worst ? UI.badge(ls.worst) : '<span class="badge b-muted">Belum diukur</span>') + '</div><div class="stack-sm">' +
      ls.items.map(function (i) {
        var s = i.session, cls = s && s.status === 'HOLD' ? 'tile fail' : 'tile';
        return '<div class="' + cls + '" ' + (s ? 'data-detail="' + esc(s.id) + '" style="cursor:pointer"' : '') + '><span style="font-size:13px;font-weight:' + (s && s.status === 'HOLD' ? 700 : 500) + '" class="' + (s && s.status === 'HOLD' ? 't-fail' : '') + '">' + esc(Data.energyLabel(i.energy)) + '</span>' +
          (s ? '<span class="mono ' + UI.devClass(s.status) + '" style="font-weight:600">' + UI.dev(s.final.deviation_pct) + (s.status === 'HOLD' ? ' HOLD' : s.status === 'CLEARED' ? ' ✓ADJ' : '') + '</span>' : '<span class="small muted">—</span>') + '</div>';
      }).join('') + '</div></div>' +
      '<div class="ft">' + (holds.length ? '<span class="t-fail" style="font-weight:600">' + holds.length + ' energi butuh koreksi</span><button class="btn btn-danger btn-sm" data-href="#/adjustment/' + encodeURIComponent(holds[0].session.id) + '">Input Adjustment</button>'
        : '<span class="muted">' + (fm ? 'Fismed: ' + esc(fm) : '') + '</span><button class="btn-text label" data-trend="' + esc(l.linac_id) + '">Lihat Tren</button>') + '</div></article>';
  }

  function calCard() {
    var dets = Data.chambers(), alerts = Data.calAlerts(), L = Data.linacs();
    var due = L.map(function (l) {
      var last = Data.linacStatus(l).last;
      if (!last) return { l: l, d: Data.today() };
      var dt = new Date(last.slice(0, 10) + 'T00:00:00'); dt.setMonth(dt.getMonth() + 1);
      return { l: l, d: dt.toISOString().slice(0, 10) };
    }).sort(function (a, b) { return a.d < b.d ? -1 : 1; })[0];
    var elOk = Data.electrometers().filter(function (e) { return AppModel.calStatus(e, Data.today(), Data.reminderMax()).status === 'VALID'; });
    return '<article class="card card-hover lcard top-info"><div><div class="hd"><div><h2 class="h-sm">Kalibrasi &amp; Jadwal QC</h2><p class="small muted" style="margin:0">Status sertifikat alat ukur</p></div>' +
      (alerts.length ? '<span class="badge b-warning">' + UI.icon('alert', 'ic-xs', 2) + alerts.length + ' Perlu Perhatian</span>' : '<span class="badge b-pass">' + UI.icon('check', 'ic-xs', 2) + 'Semua Valid</span>') + '</div><div class="stack-sm">' +
      '<div class="tile"><span class="small muted">Ion chamber aktif</span><span class="mono t1" style="font-weight:600">' + dets.length + ' unit</span></div>' +
      alerts.slice(0, 2).map(function (a) {
        return '<div class="tile ' + (a.cs.status === 'EXPIRED' ? 'fail' : 'warn') + '" data-href="#/detektor" style="cursor:pointer"><div><div style="font-size:13px;font-weight:600" class="' + (a.cs.status === 'EXPIRED' ? 't-fail' : 't-warning') + '">' + esc(a.det.model_name) + '</div><div class="mono small ' + (a.cs.status === 'EXPIRED' ? 't-fail' : 't-warning') + '">' + esc(a.det.serial_no) + ' · Exp: ' + UI.date(a.det.expiry_date) + '</div></div><span class="mono small ' + (a.cs.status === 'EXPIRED' ? 't-fail' : 't-warning') + '" style="font-weight:700">' + (a.cs.days < 0 ? 'EXP' : a.cs.days + 'h') + '</span></div>';
      }).join('') +
      (due ? '<div class="tile"><span class="small muted">QC rutin berikutnya</span><span class="mono" style="font-weight:500">' + UI.date(due.d) + '</span></div>' : '') + '</div></div>' +
      '<div class="ft"><span class="muted">Elektrometer valid: ' + elOk.length + '/' + Data.electrometers().length + '</span><button class="btn-text label" data-href="#/detektor">Kelola Detektor ' + UI.icon('arrowR', 'ic-xs', 2) + '</button></div></article>';
  }

  function chartData() {
    var L = Data.linacs();
    if (!st.linac || !L.some(function (l) { return l.linac_id === st.linac; })) {
      var hold = Data.holds()[0];
      st.linac = hold ? (Data.E()[hold.energy_id] || {}).linac_id : (L[0] || {}).linac_id;
      if (hold) st.energy = hold.energy_id;
    }
    var linac = L.filter(function (l) { return l.linac_id === st.linac; })[0] || { energies: [] };
    var ens = linac.energies.filter(function (e) { return e.is_active; });
    if (!ens.some(function (e) { return e.energy_id === st.energy; })) st.energy = (ens[0] || {}).energy_id;
    var en = Data.E()[st.energy] || {};
    var today = Data.today(), from = '', to = '';
    if (st.range === 'custom') { from = st.from; to = st.to; }
    else if (st.range !== 'all') { var d = new Date(today + 'T00:00:00'); d.setMonth(d.getMonth() - +st.range); from = d.toISOString().slice(0, 10); to = today; }
    var sessions = Data.sessions().filter(function (s) {
      var dd = String(s.datetime).slice(0, 10);
      return s.energy_id === st.energy && (!from || dd >= from) && (!to || dd <= to);
    });
    return { L: L, linac: linac, ens: ens, en: en, sessions: sessions, from: from, to: to, lim: Data.limits(en.beam_type) };
  }

  function chartCard() {
    var c = chartData();
    var pts = ReportKit.chartPoints(c.sessions);
    var svg = ReportKit.controlChartSVG(pts, { warn: c.lim.warn, action: c.lim.action, baseline: c.en.baseline_cgy_mu, mode: st.mode, showAdj: st.showAdj, from: c.from, to: c.to });
    var devs = c.sessions.map(function (s) { return TRS398.num(s.final.deviation_pct); }).filter(TRS398.ok);
    var mean = devs.length ? devs.reduce(function (a, b) { return a + b; }, 0) / devs.length : NaN;
    var sd = devs.length > 1 ? Math.sqrt(devs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (devs.length - 1)) : NaN;
    var last = c.sessions[0];
    return '<section class="card" id="control-chart"><div class="row-between mb"><div><h2 class="h-md">Control Chart — Output Drift</h2><p class="small muted" style="margin:0">Batas toleransi mengikuti Pengaturan (±' + c.lim.warn.toFixed(1) + '% / ±' + c.lim.action.toFixed(1) + '%)</p></div>' +
      '<div class="row wrap">' +
      '<select class="sel sel-pill" id="cc-linac" aria-label="Pesawat Linac">' + UI.options(c.L, 'linac_id', function (l) { return l.linac_name; }, st.linac) + '</select>' +
      '<select class="sel sel-pill" id="cc-energy" aria-label="Energi">' + UI.options(c.ens, 'energy_id', Data.energyLabel, st.energy) + '</select>' +
      '<select class="sel sel-pill" id="cc-range" aria-label="Rentang waktu">' + UI.options([['3', '3 Bulan Terakhir'], ['6', '6 Bulan Terakhir'], ['12', '1 Tahun Terakhir'], ['all', 'Semua Data'], ['custom', 'Rentang Khusus…']], function (x) { return x[0]; }, function (x) { return x[1]; }, st.range) + '</select>' +
      (st.range === 'custom' ? '<input type="date" class="sel sel-pill mono" id="cc-from" value="' + esc(st.from) + '" aria-label="Dari tanggal"><input type="date" class="sel sel-pill mono" id="cc-to" value="' + esc(st.to) + '" aria-label="Sampai tanggal">' : '') +
      '<div class="seg sm" role="group" aria-label="Satuan"><button data-mode="dev" class="' + (st.mode === 'dev' ? 'on' : '') + '">% Deviasi</button><button data-mode="output" class="' + (st.mode === 'output' ? 'on' : '') + '">cGy/MU</button></div>' +
      '<label class="check" style="height:36px;padding:0 12px;border:1px solid var(--outline-subtle);border-radius:9999px;background:var(--subtle)"><input type="checkbox" id="cc-adj"' + (st.showAdj ? ' checked' : '') + '><span class="label">As-Found &amp; As-Left</span></label>' +
      '</div></div><div class="chart-box" id="cc-box">' + svg + '</div>' +
      '<div class="legend"><span><i style="background:#0072CE"></i>Output klinis (final)</span><span><i style="border:2.5px solid #DC2626;background:#fff"></i>As-Found</span><span><i style="background:#2E9E5B"></i>As-Left</span><span><i style="background:#D97706;border-radius:2px;height:3px;width:14px"></i>Warning</span><span><i style="background:#DC2626;border-radius:2px;height:3px;width:14px"></i>Action</span><span class="muted">Klik titik untuk detail sesi</span></div>' +
      '<div class="stats"><div><div class="k">Jumlah Sesi</div><div class="v">' + c.sessions.length + '</div></div><div><div class="k">Rata-rata Deviasi</div><div class="v">' + UI.dev(mean) + '</div></div>' +
      '<div><div class="k">SD Deviasi</div><div class="v">' + (TRS398.ok(sd) ? sd.toFixed(2) + '%' : '—') + '</div></div><div><div class="k">Terakhir</div><div class="v ' + (last ? UI.devClass(last.status) : '') + '">' + (last ? UI.dev(last.final.deviation_pct) : '—') + '</div></div></div></section>';
  }

  function recentTable() {
    var E = Data.E(), P = Data.PER(), list = Data.sessions().slice(0, 6);
    return '<section class="card card-flush"><div class="card-hd"><div><h2 class="h-sm">Sesi Pengukuran QC Terbaru</h2><p class="small muted" style="margin:0">' + list.length + ' sesi terakhir lintas pesawat Linac</p></div><a href="#/riwayat" class="label">Lihat Semua Riwayat ' + UI.icon('arrowR', 'ic-xs', 2) + '</a></div>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal &amp; ID</th><th>Pesawat &amp; Energi</th><th class="hide-sm">Fisikawan Medis</th><th class="r">Output (cGy/MU)</th><th class="r">Deviasi</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' +
        list.map(function (s) {
          var e = E[s.energy_id] || {}, tmp = Data.isTemp(s.id);
          return '<tr class="' + (tmp ? 'pending' : '') + '"><td><div class="mono" style="font-size:12px">' + UI.date(s.datetime) + '</div><div class="mono small muted">' + (tmp ? 'menyinkron…' : esc(s.id)) + '</div></td>' +
            '<td><div class="t1">' + esc(e.linac_name) + '</div><div class="t2">' + esc(Data.energyLabel(e)) + '</div></td><td class="hide-sm" style="font-size:13px">' + esc((P[s.asFound.fismed_id] || {}).full_name || '—') + '</td>' +
            '<td class="r mono">' + UI.f(s.final.output_cgy_mu, 3) + '</td><td class="r mono ' + UI.devClass(s.status) + '" style="font-weight:600">' + UI.dev(s.final.deviation_pct) + '</td><td>' + UI.badge(s.status) + '</td>' +
            '<td class="r"><span class="acts"><button class="icon-btn" data-detail="' + esc(s.id) + '" aria-label="Lihat detail ' + esc(s.id) + '">' + UI.icon('eye') + '</button><button class="icon-btn" data-href="#/laporan/' + encodeURIComponent(s.id) + '" aria-label="Laporan PDF ' + esc(s.id) + '"' + (tmp ? ' disabled' : '') + '>' + UI.icon('printer') + '</button></span></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">' + UI.icon('clipboard') + '<div>Belum ada pengukuran. Mulai dengan <a href="#/input">Input QC Baru</a>.</div></div>') + '</section>';
  }

  function alerts() {
    var holds = Data.holds(), E = Data.E();
    return holds.slice(0, 3).map(function (s) {
      var e = E[s.energy_id] || {}, af = s.asFound;
      return '<section class="alert-strip"><div class="row" style="gap:12px;align-items:flex-start"><div class="ico">' + UI.icon('alert', '', 1.75) + '</div><div>' +
        '<p class="t">PERHATIAN KLINIS: ' + esc(e.linac_name) + ' — Berkas ' + esc(Data.energyLabel(e)) + ' berstatus HOLD (' + UI.dev(af.deviation_pct) + ' melebihi Action Level ±' + UI.f(af.action_limit_used, 2) + '%)</p>' +
        '<p>Data As-Found telah dikunci (' + esc(s.id) + ')' + (s.adjustments.length ? ', ' + s.adjustments.length + ' iterasi adjustment belum PASS' : '') + '. Segera lakukan Adjustment &amp; pengukuran ulang As-Left sebelum penggunaan klinis pasien.</p></div></div>' +
        '<button class="btn btn-danger-outline btn-sm" data-href="#/adjustment/' + encodeURIComponent(s.id) + '">Input Adjustment ' + UI.icon('arrowR') + '</button></section>';
    }).join('') + (holds.length > 3 ? '<p class="small t-fail">+' + (holds.length - 3) + ' sesi HOLD lainnya — lihat menu Adjustment.</p>' : '');
  }

  Pages.dashboard = {
    title: 'Dashboard Monitoring QC Absolut', live: true,
    actions: function () {
      var cal = Data.calAlerts()[0];
      return (cal ? '<span class="badge b-warning hide-sm" style="padding:6px 12px">' + UI.icon('alert', 'ic-xs', 2) + (cal.cs.status === 'EXPIRED' ? 'Kalibrasi detektor kedaluwarsa' : '1 Kalibrasi Detektor Habis dalam ' + cal.cs.days + ' Hari') + '</span> ' : '') +
        '<button class="btn btn-primary" data-href="#/input">' + UI.icon('plus', '', 1.75) + 'Input QC Baru</button>';
    },
    render: function () {
      var L = Data.linacs();
      return '<div class="stack">' + alerts() +
        '<section class="cards-3">' + L.map(linacCard).join('') + calCard() + '</section>' +
        chartCard() + recentTable() + '</div>';
    },
    mount: function (el) {
      el.querySelectorAll('[data-href]').forEach(function (b) { b.onclick = function () { App.go(b.dataset.href); }; });
      el.querySelectorAll('[data-detail]').forEach(function (b) { b.onclick = function () { openSessionDetail(b.dataset.detail); }; });
      el.querySelectorAll('[data-trend]').forEach(function (b) {
        b.onclick = function () { st.linac = b.dataset.trend; st.energy = ''; App.render({ keepScroll: true }); document.getElementById('control-chart').scrollIntoView({ behavior: 'smooth' }); };
      });
      function upd() { App.render({ keepScroll: true }); }
      var q = function (s) { return el.querySelector(s); };
      q('#cc-linac').onchange = function () { st.linac = this.value; st.energy = ''; upd(); };
      q('#cc-energy').onchange = function () { st.energy = this.value; upd(); };
      q('#cc-range').onchange = function () { st.range = this.value; if (st.range === 'custom' && !st.from) { st.to = Data.today(); st.from = st.to.slice(0, 4) - 1 + st.to.slice(4); } upd(); };
      if (q('#cc-from')) { q('#cc-from').onchange = function () { st.from = this.value; upd(); }; q('#cc-to').onchange = function () { st.to = this.value; upd(); }; }
      q('#cc-adj').onchange = function () { st.showAdj = this.checked; upd(); };
      el.querySelectorAll('[data-mode]').forEach(function (b) { b.onclick = function () { st.mode = b.dataset.mode; upd(); }; });
      UI.bindChartTips(q('#cc-box'), function (id) { openSessionDetail(id); });
    }
  };
})();
