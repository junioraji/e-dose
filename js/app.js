/* =====================================================================
 * e-Dose Agora — Shell aplikasi: router hash, navigasi, selektor data
 * ===================================================================== */
var Pages = {};

/* Selektor data turunan (memo per revisi store → render tetap instan) */
var Data = (function () {
  var rev = 0, memo = {};
  Store.on(function (r) { if (r !== 'syncstate') { rev++; memo = {}; } });
  function m(key, fn) { if (!(key in memo)) memo[key] = fn(); return memo[key]; }
  var D = {
    db: function () { return Store.data; },
    cfg: function () { return Store.data.config || {}; },
    today: function () { return LocalBackend.today(); },
    E: function () { return m('E', function () { return AppModel.idx(Store.data.energies, 'energy_id'); }); },
    DET: function () { return m('DET', function () { return AppModel.idx(Store.data.detectors, 'detector_id'); }); },
    PER: function () { return m('PER', function () { return AppModel.idx(Store.data.personnel, 'person_id'); }); },
    sessions: function () { return m('S', function () { return AppModel.groupSessions(Store.data.transactions); }); },
    session: function (id) { return D.sessions().filter(function (s) { return s.id === id; })[0]; },
    linacs: function (includeInactive) {
      return m('L' + !!includeInactive, function () {
        var map = {}, order = [];
        Store.data.energies.forEach(function (e) {
          if (!map[e.linac_id]) { map[e.linac_id] = { linac_id: e.linac_id, linac_name: e.linac_name, linac_model: e.linac_model, serial_no: e.serial_no, bunker: e.bunker, energies: [], is_active: false }; order.push(e.linac_id); }
          map[e.linac_id].energies.push(e);
          if (e.is_active) map[e.linac_id].is_active = true;
        });
        return order.map(function (k) {
          var l = map[k];
          l.energies.sort(AppModel.energyOrder);
          return l;
        }).filter(function (l) { return includeInactive || l.is_active; });
      });
    },
    energyLabel: function (e) { return e ? e.energy_label + ' ' + (e.beam_type === 'ELECTRON' ? 'Electron' : 'Photon') : '—'; },
    fismeds: function () { return Store.data.personnel.filter(function (p) { return p.role === 'FISMED' && p.is_active; }); },
    chambers: function () { return Store.data.detectors.filter(function (d) { return d.category === 'CHAMBER' && d.is_active; }); },
    electrometers: function () { return Store.data.detectors.filter(function (d) { return d.category === 'ELECTROMETER' && d.is_active; }); },
    limits: function (bt) { return TRS398.limitsFor(D.cfg(), bt); },
    holds: function () { return m('H', function () { return D.sessions().filter(function (s) { return s.status === 'HOLD'; }); }); },
    reminderMax: function () { return Math.max.apply(null, String(D.cfg().CAL_REMINDER_DAYS || '60').split(',').map(Number).filter(isFinite).concat([7])); },
    calAlerts: function () {
      return m('CAL', function () {
        var t = D.today(), w = D.reminderMax();
        return Store.data.detectors.filter(function (d) { return d.is_active; }).map(function (d) { return { det: d, cs: AppModel.calStatus(d, t, w) }; })
          .filter(function (x) { return x.cs.status === 'EXPIRING' || x.cs.status === 'EXPIRED'; }).sort(function (a, b) { return a.cs.days - b.cs.days; });
      });
    },
    /* Status terakhir per energi suatu linac */
    linacStatus: function (linac) {
      var ss = D.sessions(), out = [];
      linac.energies.filter(function (e) { return e.is_active; }).forEach(function (e) {
        var s = ss.filter(function (x) { return x.energy_id === e.energy_id; })[0];
        out.push({ energy: e, session: s || null });
      });
      var rank = { HOLD: 4, FAIL: 4, WARNING: 2, CLEARED: 1, PASS: 1 }, worst = '', w = 0, last = '';
      out.forEach(function (o) { if (o.session) { var r = rank[o.session.status] || 0; if (r > w) { w = r; worst = o.session.status; } if (o.session.datetime > last) last = o.session.datetime; } });
      return { items: out, worst: worst === 'CLEARED' ? 'PASS' : worst, last: last };
    },
    isTemp: function (id) { return String(id || '').indexOf('TMP-') === 0; }
  };
  return D;
})();

/* =====================================================================
 * APP
 * ===================================================================== */
var App = (function () {
  var current = { name: '', params: [] }, syncTimer = null;
  var ROUTES = {
    dashboard: 'dashboard', input: 'input', adjustment: 'adjustment', riwayat: 'riwayat', laporan: 'laporan',
    linac: 'linac', detektor: 'detektor', pengaturan: 'pengaturan'
  };
  var NAV = [
    ['dashboard', 'Dashboard', 'dashboard'], ['input', 'Input QC Absolut', 'pen'], ['adjustment', 'Adjustment / CAPA', 'wrench'],
    ['riwayat', 'Riwayat & Data', 'history'], ['laporan', 'Laporan PDF', 'file'], ['-', 'Master Data'],
    ['linac', 'Pesawat Linac & Energi', 'atom'], ['detektor', 'Detektor & Tabel kQ', 'beaker'], ['pengaturan', 'Pengaturan', 'settings']
  ];

  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function parse() {
    var h = (location.hash || '#/dashboard').replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    var name = ROUTES[h[0]] ? h[0] : 'dashboard';
    return { name: name, params: h.slice(1) };
  }

  function renderNav() {
    var holds = Data.holds().length, cal = Data.calAlerts().length;
    document.getElementById('nav').innerHTML = NAV.map(function (n) {
      if (n[0] === '-') return '<div class="grp">' + n[1] + '</div>';
      var cnt = n[0] === 'adjustment' && holds ? '<span class="cnt">' + holds + '</span>' : n[0] === 'detektor' && cal ? '<span class="cnt w">!</span>' : '';
      return '<a href="#/' + n[0] + '" data-nav="' + n[0] + '" class="' + (current.name === n[0] ? 'active' : '') + '">' + UI.icon(n[2]) + '<span>' + n[1] + '</span>' + cnt + '</a>';
    }).join('');
    var bn = [['dashboard', 'Dashboard', 'dashboard'], ['riwayat', 'Riwayat', 'history'], ['input', 'Input', 'plus'], ['adjustment', 'Adjust', 'wrench'], ['menu', 'Menu', 'menu']];
    document.getElementById('bottom-nav').innerHTML = bn.map(function (b) {
      if (b[0] === 'menu') return '<button type="button" data-drawer>' + UI.icon('menu') + '<span>Menu</span></button>';
      if (b[0] === 'input') return '<a href="#/input" class="' + (current.name === 'input' ? 'active' : '') + '"><span class="fab">' + UI.icon('plus', '', 2) + '</span><span>Input QC</span></a>';
      return '<a href="#/' + b[0] + '" class="' + (current.name === b[0] ? 'active' : '') + '">' + UI.icon(b[2]) + '<span>' + b[1] + '</span>' + (b[0] === 'adjustment' && holds ? '<span class="cnt">' + holds + '</span>' : '') + '</a>';
    }).join('');
    document.querySelector('#bottom-nav [data-drawer]').onclick = toggleDrawer;
    var user = (Store.auth && Store.auth.user) || 'admin';
    document.getElementById('sb-name').textContent = user.charAt(0).toUpperCase() + user.slice(1);
    document.getElementById('sb-avatar').textContent = user.slice(0, 2).toUpperCase();
    renderBell();
  }

  function renderSync() {
    var el = document.getElementById('sync-ind'), q = Api.pending();
    if (Api.isDemo()) { el.className = 'sync demo-pill'; el.innerHTML = UI.icon('beaker') + '<span class="lbl">Mode Demo</span>'; el.title = 'Data lokal di browser — isi GAS_URL di js/config.js untuk terhubung ke server'; return; }
    if (!Store.online) { el.className = 'sync off'; el.innerHTML = UI.icon('cloudOff') + '<span class="lbl">Offline' + (q ? ' · ' + q + ' antre' : '') + '</span>'; el.title = 'Tidak terhubung ke server. Perubahan disimpan dan dikirim otomatis.'; return; }
    if (q || Store.syncing) { el.className = 'sync busy'; el.innerHTML = '<span class="spin" style="width:12px;height:12px"></span><span class="lbl">' + (q ? 'Menyimpan ' + q + '…' : 'Sinkron…') + '</span>'; el.title = ''; return; }
    el.className = 'sync ok'; el.innerHTML = UI.icon('cloud') + '<span class="lbl">Tersinkron</span>';
    el.title = Store.lastSync ? 'Sinkron terakhir ' + new Date(Store.lastSync).toLocaleTimeString('id-ID') : '';
  }

  function renderBell() {
    var holds = Data.holds(), cal = Data.calAlerts(), n = holds.length + cal.length, E = Data.E();
    var dot = document.getElementById('bell-dot');
    dot.textContent = n; dot.classList.toggle('hidden', !n);
    var items = holds.map(function (s) {
      var e = E[s.energy_id] || {};
      return '<div class="it" data-go="#/adjustment/' + encodeURIComponent(s.id) + '"><span class="t-fail">' + UI.icon('alertC') + '</span><div><b class="t-fail">HOLD</b> — ' + UI.esc(e.linac_name) + ' ' + UI.esc(Data.energyLabel(e)) +
        '<div class="small muted mono">' + UI.esc(s.id) + ' · ' + UI.dev(s.final.deviation_pct) + '</div></div></div>';
    }).concat(cal.map(function (c) {
      return '<div class="it" data-go="#/detektor"><span class="' + (c.cs.status === 'EXPIRED' ? 't-fail' : 't-warning') + '">' + UI.icon('alert') + '</span><div><b>' + (c.cs.status === 'EXPIRED' ? 'Kalibrasi kedaluwarsa' : 'Kalibrasi H-' + c.cs.days) + '</b> — ' + UI.esc(c.det.model_name) +
        '<div class="small muted mono">' + UI.esc(c.det.serial_no) + ' · ' + UI.date(c.det.expiry_date) + '</div></div></div>';
    }));
    document.getElementById('bell-pop').innerHTML = '<div class="card-hd" style="padding:12px 16px"><b class="h-sm">Notifikasi</b><span class="small muted">' + n + ' perlu perhatian</span></div>' +
      (items.length ? items.join('') : '<div class="empty small">' + UI.icon('checkC') + '<div>Semua pesawat & alat ukur dalam kondisi baik.</div></div>');
  }

  function toggleDrawer(force) { document.body.classList.toggle('drawer-open', typeof force === 'boolean' ? force : undefined); }

  /* Render halaman — sinkron & dari memori (tanpa menunggu server) */
  function render(opts) {
    opts = opts || {};
    if (!Store.data) return;
    var r = parse(), page = Pages[r.name];
    if (!page) return;
    var same = current.name === r.name && current.params.join('/') === r.params.join('/');
    if (current.name && Pages[current.name] && Pages[current.name].unmount && !same) Pages[current.name].unmount();
    current = r;
    var view = document.getElementById('view'), scroll = window.scrollY;
    document.getElementById('page-title').textContent = typeof page.title === 'function' ? page.title(r.params) : page.title;
    document.getElementById('page-actions').innerHTML = page.actions ? page.actions(r.params) : '';
    view.className = 'view' + (opts.keepScroll ? '' : ' view-enter');
    view.innerHTML = page.render(r.params);
    if (page.mount) page.mount(view, r.params);
    bindActions(document.getElementById('page-actions'));
    renderNav();
    toggleDrawer(false);
    if (opts.keepScroll) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
    document.title = document.getElementById('page-title').textContent + ' — e-Dose Agora';
  }
  function bindActions(root) {
    root.querySelectorAll('[data-href]').forEach(function (b) { b.onclick = function () { go(b.dataset.href); }; });
  }

  /* Event store: render ulang halaman "live" saat data berubah */
  Store.on(function (reason, info) {
    if (reason === 'syncstate') { renderSync(); return; }
    if (!Store.data) return;
    var page = Pages[current.name];
    if (reason === 'rejected') {
      var msg = (info && info.res && info.res.message) || 'Perubahan ditolak server.';
      var op = info && info.op, lr = op && op.local && op.local.record;
      var restore = op && op.action === 'saveQC';
      if (restore) { try { var last = sessionStorage.getItem('edose_last_submit'); if (last) sessionStorage.setItem('edose_draft_input', last); } catch (e) { } }
      UI.toast('<b>Gagal disimpan ke server:</b> ' + UI.esc(msg) + '<br><span class="small">Perubahan lokal dibatalkan' + (restore ? ' — isian form dipulihkan, periksa lalu simpan ulang.' : '.') + '</span>', 'error', { sticky: true, action: restore ? 'Buka Form' : '', onAction: function () { go('#/input'); } });
      if (lr && location.hash.indexOf(encodeURIComponent(lr.qc_id)) >= 0) { go(restore ? '#/input' : '#/adjustment'); return; }
    }
    if (reason === 'sync' && page && !page.live) UI.toast('Data terbaru dari server telah dimuat.', 'info', { ms: 2500 });
    if (page && page.live) render({ keepScroll: true }); else renderNav();
    if (page && page.onData) page.onData(reason, info);
    renderSync();
  });

  function startSyncLoop() {
    clearInterval(syncTimer);
    syncTimer = setInterval(function () { if (document.visibilityState === 'visible') Api.sync(); }, (window.APP_CONFIG && APP_CONFIG.SYNC_INTERVAL_MS) || 120000);
  }

  function enterApp() {
    document.documentElement.classList.add('has-auth');
    if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/dashboard');
    render();
    renderSync();
    Api.resumeQueue();
    Api.sync();
    startSyncLoop();
  }

  function logout() {
    if (Api.pending()) { UI.toast('Masih ada ' + Api.pending() + ' perubahan yang sedang disimpan. Tunggu sebentar.', 'warning'); return; }
    Store.setAuth(null);
    if (!Api.isDemo()) { Store.clearAll(); }
    document.documentElement.classList.remove('has-auth');
    document.getElementById('lg-pass').value = '';
    showLoginHints();
  }
  function onAuthExpired() {
    Store.setAuth(null);
    document.documentElement.classList.remove('has-auth');
    UI.toast('Sesi berakhir. Silakan login kembali — data lokal tetap aman.', 'warning');
  }

  function showLoginHints() {
    var demo = document.getElementById('lg-demo');
    if (Api.isDemo()) { demo.innerHTML = UI.icon('beaker') + '<div><b>Mode Demo aktif.</b> Isi password apa saja untuk mencoba dengan data contoh. Hubungkan ke server dengan mengisi <span class="mono">GAS_URL</span> di <span class="mono">js/config.js</span>.</div>'; demo.classList.remove('hidden'); }
  }

  function initLogin() {
    showLoginHints();
    document.getElementById('lg-eye').onclick = function () { var i = document.getElementById('lg-pass'); i.type = i.type === 'password' ? 'text' : 'password'; };
    document.getElementById('lg-help').onclick = function (e) {
      e.preventDefault();
      UI.modal({ title: 'Bantuan Login', size: 'sm', body: '<p>Akun Admin dibuat otomatis saat menjalankan <span class="mono">setupAppEnvironment()</span> di Apps Script — password awal tampil di Execution Log.</p><p>Lupa password? Jalankan fungsi <span class="mono">resetAdminPassword()</span> dari editor Apps Script; password baru akan tampil di log.</p>', footer: '<button class="btn btn-primary" data-close>Mengerti</button>' });
    };
    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = document.getElementById('lg-btn'), err = document.getElementById('lg-error');
      err.classList.add('hidden');
      UI.busy(btn, true, 'Memverifikasi...');
      var r = await Api.login(document.getElementById('lg-user').value.trim(), document.getElementById('lg-pass').value, document.getElementById('lg-remember').checked);
      UI.busy(btn, false);
      if (!r.success) { err.innerHTML = UI.icon('alertC') + '<div>' + UI.esc(r.message || 'Login gagal.') + '</div>'; err.classList.remove('hidden'); return; }
      enterApp();
    });
  }

  function init() {
    Store.loadCache();
    Store.demo = Api.isDemo();
    initLogin();
    document.getElementById('btn-logout').onclick = function () { UI.confirm({ title: 'Keluar dari aplikasi?', body: '<p>Anda perlu login kembali untuk mengakses data.</p>', ok: 'Keluar' }).then(function (y) { if (y) logout(); }); };
    document.getElementById('btn-menu').onclick = toggleDrawer;
    document.getElementById('drawer-mask').onclick = function () { toggleDrawer(false); };
    var pop = document.getElementById('bell-pop');
    document.getElementById('btn-bell').onclick = function (e) { e.stopPropagation(); pop.classList.toggle('hidden'); };
    pop.addEventListener('click', function (e) { var it = e.target.closest('[data-go]'); if (it) { pop.classList.add('hidden'); go(it.dataset.go); } });
    document.addEventListener('click', function (e) { if (!pop.contains(e.target)) pop.classList.add('hidden'); });
    window.addEventListener('hashchange', function () { if (Store.auth) render(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Store.auth && Date.now() - Store.lastSync > 30000) Api.sync(); });
    window.addEventListener('online', function () { Store.online = true; Api.retryNow(); Api.sync(); renderSync(); });
    window.addEventListener('beforeunload', function (e) { if (Api.pending()) { e.preventDefault(); e.returnValue = ''; } });
    if (Store.auth && Store.data) enterApp();
    else document.documentElement.classList.remove('has-auth');
  }

  return { init: init, go: go, render: render, current: function () { return current; }, onAuthExpired: onAuthExpired, logout: logout };
})();

/* Jalankan setelah SEMUA script defer termuat (halaman didaftarkan di file terpisah) */
document.addEventListener('DOMContentLoaded', function () { App.init(); });
