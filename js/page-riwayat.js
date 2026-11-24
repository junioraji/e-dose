/* =====================================================================
 * W-05 · Riwayat & Pencarian Data QC Absolut
 * ===================================================================== */
(function () {
  var esc = UI.esc;
  var F = { q: '', linac: '', energy: '', status: '', from: '', to: '', adjOnly: false, page: 1, per: 15 };

  function filtered() {
    var E = Data.E(), P = Data.PER(), q = F.q.trim().toLowerCase();
    return Data.sessions().filter(function (s) {
      var e = E[s.energy_id] || {}, d = String(s.datetime).slice(0, 10);
      if (F.linac && e.linac_id !== F.linac) return false;
      if (F.energy && s.energy_id !== F.energy) return false;
      if (F.status && s.status !== F.status) return false;
      if (F.from && d < F.from) return false;
      if (F.to && d > F.to) return false;
      if (F.adjOnly && !s.hasAdjustment) return false;
      if (q) {
        var hay = [s.id, e.linac_name, e.energy_label, (P[s.asFound.fismed_id] || {}).full_name].concat(s.records.map(function (r) { return [r.notes, r.adj_action_desc, r.adj_performer, r.adj_ticket].join(' '); })).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function rows(list) {
    var E = Data.E(), P = Data.PER();
    return list.map(function (s) {
      var e = E[s.energy_id] || {}, tmp = Data.isTemp(s.id), n = s.adjustments.length;
      return '<tr class="' + (tmp ? 'pending' : '') + '"><td><div class="row" style="gap:8px"><span class="mono" style="font-weight:600;color:var(--primary);font-size:12px">' + (tmp ? 'menyinkron…' : esc(s.id)) + '</span>' +
        (n ? '<span class="badge b-info b-sm mono">' + n + 'x ADJ</span>' : '') + '</div><div class="mono small muted">' + UI.date(s.datetime, true) + '</div></td>' +
        '<td><div class="t1" style="color:var(--on-surface)">' + esc(e.linac_name) + '</div><div class="t2">' + esc(Data.energyLabel(e)) + '</div></td>' +
        '<td class="hide-sm" style="font-size:13px">' + esc((P[s.asFound.fismed_id] || {}).full_name || '—') + '</td>' +
        '<td class="r mono">' + UI.f(s.final.output_cgy_mu, 3) + (n ? '<div class="small muted">AF ' + UI.f(s.asFound.output_cgy_mu, 3) + '</div>' : '') + '</td>' +
        '<td class="r mono ' + UI.devClass(s.status) + '" style="font-weight:600">' + UI.dev(s.final.deviation_pct) + (n ? '<div class="small t-fail" style="font-weight:500">AF ' + UI.dev(s.asFound.deviation_pct) + '</div>' : '') + '</td>' +
        '<td>' + UI.badge(s.status) + '</td>' +
        '<td class="r"><span class="acts">' +
        '<button class="icon-btn" data-detail="' + esc(s.id) + '" aria-label="Lihat detail" title="Lihat detail kalkulasi">' + UI.icon('eye') + '</button>' +
        '<button class="icon-btn" data-edit="' + esc(s.id) + '" aria-label="Koreksi data" title="Koreksi data"' + (tmp ? ' disabled' : '') + '>' + UI.icon('pen') + '</button>' +
        (s.status === 'HOLD' ? '<button class="icon-btn danger" data-go="#/adjustment/' + encodeURIComponent(s.id) + '" aria-label="Lanjutkan adjustment" title="Lanjutkan Adjustment" style="color:var(--fail-accent)">' + UI.icon('wrench') + '</button>' : '') +
        '<button class="icon-btn" data-go="#/laporan/' + encodeURIComponent(s.id) + '" aria-label="Laporan PDF" title="Laporan PDF"' + (tmp ? ' disabled' : '') + '>' + UI.icon('printer') + '</button>' +
        '</span></td></tr>';
    }).join('');
  }

  function pager(total) {
    var pages = Math.max(1, Math.ceil(total / F.per));
    if (F.page > pages) F.page = pages;
    var a = (F.page - 1) * F.per + 1, b = Math.min(total, F.page * F.per), btns = [];
    var lo = Math.max(1, F.page - 2), hi = Math.min(pages, lo + 4); lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) btns.push('<button data-page="' + i + '" class="' + (i === F.page ? 'on' : '') + '">' + i + '</button>');
    return '<div class="card-ft"><span class="small muted mono">Menampilkan ' + (total ? a + '–' + b : 0) + ' dari ' + total + ' sesi</span><div class="pager"><button data-page="' + (F.page - 1) + '"' + (F.page <= 1 ? ' disabled' : '') + ' style="font-family:var(--font)">Prev</button>' + btns.join('') +
      '<button data-page="' + (F.page + 1) + '"' + (F.page >= pages ? ' disabled' : '') + ' style="font-family:var(--font)">Next</button></div></div>';
  }

  function tableCard() {
    var list = filtered(), slice = list.slice((F.page - 1) * F.per, F.page * F.per);
    return '<section class="card card-flush" id="rw-table">' + (list.length ?
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID Sesi &amp; Tanggal</th><th>Pesawat &amp; Energi</th><th class="hide-sm">Fismed</th><th class="r">Dosis (cGy/MU)</th><th class="r">Deviasi</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' + rows(slice) + '</tbody></table></div>' + pager(list.length)
      : '<div class="empty">' + UI.icon('search') + '<div>Tidak ada data yang cocok dengan filter.</div></div>') + '</section>';
  }

  function editSession(id) {
    var s = Data.session(id);
    if (!s) return;
    if (!s.adjustments.length) return App.go('#/input/edit/' + encodeURIComponent(s.asFound.qc_id));
    UI.modal({
      title: 'Pilih record yang akan dikoreksi', size: 'sm',
      body: '<div class="stack-sm">' + s.records.slice().sort(function (a, b) { return a.iteration_no - b.iteration_no; }).map(function (r) {
        return '<button class="btn btn-ghost btn-block" style="justify-content:space-between" data-edit="' + esc(r.qc_id) + '"><span>' + (r.record_type === 'AS_FOUND' ? 'As-Found' : 'Adjustment #' + r.iteration_no) + ' <span class="mono small">' + esc(r.qc_id) + '</span></span>' + UI.badge(r.status) + '</button>';
      }).join('') + '</div><p class="small muted mt">Koreksi hanya untuk kesalahan input. Setiap perubahan tercatat di jejak audit beserta alasannya.</p>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button>',
      onMount: function (el, close) { el.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { close(); App.go('#/input/edit/' + encodeURIComponent(b.dataset.edit)); }; }); }
    });
  }

  function bindTable(el) {
    el.querySelectorAll('[data-detail]').forEach(function (b) { b.onclick = function () { openSessionDetail(b.dataset.detail); }; });
    el.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editSession(b.dataset.edit); }; });
    el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { App.go(b.dataset.go); }; });
    el.querySelectorAll('[data-page]').forEach(function (b) { b.onclick = function () { F.page = +b.dataset.page; refresh(el); }; });
  }
  function refresh(el) {
    var host = el.querySelector('#rw-table'), tmp = document.createElement('div');
    tmp.innerHTML = tableCard(); host.replaceWith(tmp.firstChild);
    bindTable(el);
  }

  Pages.riwayat = {
    title: 'Riwayat & Pencarian Data QC Absolut', live: true,
    actions: function () {
      return '<button class="btn btn-outline" id="rw-export">' + UI.icon('download', '', 1.75) + 'Export Rekap Bulanan PDF</button> <button class="btn btn-primary" data-href="#/input">' + UI.icon('plus', '', 1.75) + 'Input QC Baru</button>';
    },
    render: function () {
      var L = Data.linacs(true), lin = L.filter(function (l) { return l.linac_id === F.linac; })[0];
      var ens = lin ? lin.energies : Store.data.energies;
      return '<div class="stack"><section class="card stack-sm"><div class="filters" id="rw-filters">' +
        '<div class="inp-icon">' + UI.icon('search') + '<input class="inp" type="search" id="f-q" placeholder="Cari ID sesi, nama Fismed, catatan, tiket..." value="' + esc(F.q) + '"></div>' +
        '<select class="sel" id="f-linac">' + UI.options(L, 'linac_id', function (l) { return l.linac_name; }, F.linac, 'Semua Pesawat') + '</select>' +
        '<select class="sel" id="f-energy">' + UI.options(ens, 'energy_id', function (e) { return (lin ? '' : e.linac_name.replace(/^(\S+).*?(#\d+)?$/, '$1 $2') + ' · ') + Data.energyLabel(e); }, F.energy, 'Semua Energi') + '</select>' +
        '<select class="sel" id="f-status">' + UI.options([['PASS', 'PASS'], ['CLEARED', 'PASS (Cleared)'], ['WARNING', 'WARNING'], ['HOLD', 'HOLD / Pending Adjustment']], function (x) { return x[0]; }, function (x) { return x[1]; }, F.status, 'Semua Status') + '</select>' +
        '<input type="date" class="sel mono" id="f-from" value="' + esc(F.from) + '" title="Dari tanggal" aria-label="Dari tanggal">' +
        '<input type="date" class="sel mono" id="f-to" value="' + esc(F.to) + '" title="Sampai tanggal" aria-label="Sampai tanggal"></div>' +
        '<div class="row-between"><label class="check"><input type="checkbox" id="f-adj"' + (F.adjOnly ? ' checked' : '') + '><span>Hanya yang ada Adjustment (As-Found → As-Left)</span></label><button class="btn-text label" id="f-reset">Reset Filter</button></div></section>' +
        tableCard() + '</div>';
    },
    mount: function (el) {
      var q = function (s) { return el.querySelector(s); };
      var deb = UI.debounce(function () { F.page = 1; refresh(el); }, 120);
      q('#f-q').oninput = function () { F.q = this.value; deb(); };
      q('#f-linac').onchange = function () { F.linac = this.value; F.energy = ''; F.page = 1; App.render({ keepScroll: true }); };
      [['#f-energy', 'energy'], ['#f-status', 'status'], ['#f-from', 'from'], ['#f-to', 'to']].forEach(function (p) { q(p[0]).onchange = function () { F[p[1]] = this.value; F.page = 1; refresh(el); }; });
      q('#f-adj').onchange = function () { F.adjOnly = this.checked; F.page = 1; refresh(el); };
      q('#f-reset').onclick = function () { F = { q: '', linac: '', energy: '', status: '', from: '', to: '', adjOnly: false, page: 1, per: 15 }; App.render(); };
      bindTable(el);
      var ex = document.getElementById('rw-export');
      if (ex) ex.onclick = function () {
        var month = (F.from || Data.today()).slice(0, 7), linac = F.linac || (Data.linacs()[0] || {}).linac_id;
        App.go('#/laporan/monthly/' + encodeURIComponent(linac) + '/' + month);
      };
    }
  };
})();
