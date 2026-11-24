/* =====================================================================
 * W-09 · Pengaturan Aplikasi & Kebijakan Mutu
 * ===================================================================== */
(function () {
  var esc = UI.esc, tab = 1, sepDraft = null;
  var TABS = [[1, 'Kebijakan Batas Toleransi', 'gauge'], [2, 'Profil Rumah Sakit', 'file'], [3, 'Profil Fismed & Kadep', 'user'], [4, 'Notifikasi Email Otomatis', 'mail'], [5, 'Akun Admin & Data', 'lock']];

  function c(k) { var v = Data.cfg()[k]; return v === undefined ? '' : v; }
  async function saveCfg(btn, values, okMsg) {
    UI.busy(btn, true, 'Menyimpan...');
    var r = await Api.mutate('saveConfig', { values: values });
    UI.busy(btn, false);
    if (!r.success) return UI.toast(esc(r.message), 'error');
    UI.toast(okMsg || 'Pengaturan disimpan.', 'success');
  }

  function pTol() {
    var sep = sepDraft !== null ? sepDraft : String(c('SEPARATE_LIMITS')) === 'true';
    return '<section class="card stack"><h2 class="h-sm">Kebijakan Batas Toleransi QC Absolut</h2>' +
      '<div class="notice n-info">' + UI.icon('gauge') + '<div>Perubahan ambang batas langsung berlaku untuk indikator Traffic-Light di Input QC dan garis batas Control Chart. Pengukuran lama tetap memakai batas saat diukur (snapshot audit).</div></div>' +
      '<div class="label caps muted">' + (sep ? 'Berkas Foton' : 'Semua Berkas') + '</div>' + limRow('', c('WARNING_LIMIT'), c('ACTION_LIMIT')) +
      '<label class="check"><input type="checkbox" id="t-sep"' + (sep ? ' checked' : '') + '><span>Aktifkan batas toleransi terpisah untuk Photon vs Electron</span></label>' +
      (sep ? '<div class="label caps muted">Berkas Elektron</div>' + limRow('_ELECTRON', c('WARNING_LIMIT_ELECTRON'), c('ACTION_LIMIT_ELECTRON')) : '') +
      '<div class="label caps muted mt">Kondisi Referensi Standar (k_TP)</div><div class="g g-3"><label class="field"><span>T₀ (°C)</span><input id="t-T0" type="number" step="0.1" value="' + esc(c('T0')) + '"></label>' +
      '<label class="field"><span>P₀ (kPa)</span><input id="t-P0" type="number" step="0.001" value="' + esc(c('P0')) + '"></label><div class="field"><span>Rumus</span><div class="calc-out small" style="font-weight:500">k_TP = (273.2+T)/(273.2+T₀)·P₀/P</div></div></div>' +
      '<div class="row" style="justify-content:flex-end;border-top:1px solid var(--outline-subtle);padding-top:16px"><button class="btn btn-primary" id="t-save">Simpan Kebijakan Toleransi</button></div></section>';
  }
  function limRow(sfx, w, a) {
    return '<div class="g g-3"><div class="lim-card pass stack-sm"><div class="label">PASS Limit (±%)</div><input class="inp mono" id="t-w' + sfx + '" type="number" step="0.1" min="0.1" value="' + esc(w) + '" style="border-color:var(--pass-border);color:var(--pass-text)"><p class="small" style="margin:0">Laik klinis (≤ ±<span data-w>' + esc(w) + '</span>%)</p></div>' +
      '<div class="lim-card warn stack-sm"><div class="label">WARNING Range (±%)</div><div class="box"><span data-w>' + esc(w) + '</span>% – <span data-a>' + esc(a) + '</span>%</div><p class="small" style="margin:0">Pantau ketat &amp; evaluasi tren</p></div>' +
      '<div class="lim-card fail stack-sm"><div class="label">ACTION Level (±%)</div><input class="inp mono" id="t-a' + sfx + '" type="number" step="0.1" min="0.2" value="' + esc(a) + '" style="border-color:var(--fail-border);color:var(--fail-text)"><p class="small" style="margin:0">Wajib Adjustment (&gt; ±<span data-a>' + esc(a) + '</span>%)</p></div></div>';
  }

  function pRS() {
    var logo = c('HOSPITAL_LOGO'), kadeps = Store.data.personnel.filter(function (p) { return p.role === 'KADEP' && p.is_active; });
    return '<section class="card stack"><h2 class="h-sm">Profil Rumah Sakit (Kop Laporan PDF)</h2><div class="g g-2">' +
      '<label class="field"><span>Nama Rumah Sakit</span><input id="h-name" value="' + esc(c('HOSPITAL_NAME')) + '"></label>' +
      '<label class="field"><span>Nama Instalasi / Departemen</span><input id="h-unit" value="' + esc(c('HOSPITAL_UNIT')) + '"></label>' +
      '<label class="field span-2"><span>Alamat Lengkap</span><input id="h-addr" value="' + esc(c('HOSPITAL_ADDRESS')) + '"></label>' +
      '<label class="field span-2"><span>Kepala Departemen (penanda tangan "Mengetahui")</span><select id="h-kadep">' + UI.options(kadeps, 'person_id', function (p) { return p.full_name + ' — ' + (p.position || 'Kepala Departemen'); }, c('KADEP_ID'), kadeps.length ? '' : 'Tambahkan personel ber-role KADEP dulu') + '</select></label></div>' +
      '<div class="row" style="gap:16px;align-items:flex-start"><div class="logo-prev" id="h-logo-prev">' + (logo ? '<img src="' + esc(logo) + '" alt="Logo">' : UI.LOGO) + '</div><div class="grow stack-sm"><label class="field"><span>Logo Kop (URL gambar atau unggah file — otomatis dikecilkan)</span><input id="h-logo" value="' + esc(logo.indexOf('data:') === 0 ? '' : logo) + '" placeholder="https://.../logo.png"></label>' +
      '<div class="row"><label class="btn btn-ghost btn-sm" style="cursor:pointer">' + UI.icon('download') + 'Pilih File<input type="file" id="h-file" accept="image/png,image/jpeg,image/svg+xml" hidden></label>' + (logo ? '<button class="btn btn-text label" id="h-clear" style="color:var(--fail-accent)">Hapus logo</button>' : '') + '</div></div></div>' +
      '<div class="row" style="justify-content:flex-end;border-top:1px solid var(--outline-subtle);padding-top:16px"><button class="btn btn-primary" id="h-save">Simpan Profil</button></div></section>';
  }

  var PER_FIELDS = [
    { name: 'full_name', label: 'Nama Lengkap & Gelar', req: true, span: true, ph: 'Dr. Nama, M.Si' },
    { name: 'role', label: 'Peran', type: 'select', options: [['FISMED', 'Fisikawan Medis'], ['KADEP', 'Kepala Departemen / Instalasi']], req: true },
    { name: 'position', label: 'Jabatan (untuk blok tanda tangan)', ph: 'Fisikawan Medis' },
    { name: 'nip_str', label: 'NIP / STR', mono: true }, { name: 'email', label: 'Email', type: 'email' }
  ];
  function pPer() {
    var list = Store.data.personnel.slice().sort(function (a, b) { return (b.is_active - a.is_active) || a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name); });
    return '<section class="card card-flush"><div class="card-hd"><h2 class="h-sm">Direktori Fisikawan Medis &amp; Kepala Departemen</h2><button class="btn btn-primary btn-sm" id="p-add">' + UI.icon('plus') + 'Tambah Personel</button></div>' +
      '<p class="small muted" style="margin:0;padding:10px 20px 0">Ikon ' + UI.icon('trash', 'ic-xs') + ' menghapus permanen personel yang belum pernah tercatat di pengukuran. Yang sudah tercatat hanya bisa dinonaktifkan agar laporan lama tetap utuh.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Peran</th><th>NIP / STR</th><th class="hide-sm">Email</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr class="' + (p.is_active ? '' : 'row-off') + '"><td><div class="t1">' + esc(p.full_name) + '</div><div class="t2">' + esc(p.position || '') + '</div></td><td>' + (p.role === 'KADEP' ? '<span class="badge b-navy b-sm">KADEP</span>' : '<span class="badge b-info b-sm">FISMED</span>') + '</td>' +
          '<td class="mono small">' + esc(p.nip_str) + '</td><td class="hide-sm small">' + esc(p.email) + '</td><td>' + (p.is_active ? '<span class="badge b-pass b-sm">Aktif</span>' : '<span class="badge b-muted b-sm">Nonaktif</span>') + '</td>' +
          '<td class="r"><span class="acts"><button class="icon-btn" data-edit-p="' + esc(p.person_id) + '" aria-label="Edit">' + UI.icon('pen') + '</button><button class="icon-btn" data-toggle-p="' + esc(p.person_id) + '" title="' + (p.is_active ? 'Nonaktifkan' : 'Aktifkan') + '" aria-label="' + (p.is_active ? 'Nonaktifkan' : 'Aktifkan') + '">' + UI.icon('power') + '</button>' +
          UI.delBtn('data-del-p="' + esc(p.person_id) + '"', AppModel.usage(Store.data, 'personnel', p.person_id)) + '</span></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function pMail() {
    var logs = (Store.data.notifications || []).slice(0, 15);
    var appUrl = c('APP_URL');
    return '<section class="card stack"><h2 class="h-sm">Notifikasi Email Otomatis</h2>' +
      '<label class="check"><input type="checkbox" id="m-alert"' + (String(c('ALERT_ENABLED')) === 'true' ? ' checked' : '') + '><span><b>Alert instan</b> saat output melebihi Action Level (subjek <span class="mono">[ALERT QC ABSOLUT]</span>)</span></label>' +
      '<label class="check"><input type="checkbox" id="m-cal"' + (String(c('CAL_REMINDER_ENABLED')) === 'true' ? ' checked' : '') + '><span><b>Pengingat kalibrasi detektor</b> — trigger harian 07:00 WIB, tanpa duplikasi</span></label>' +
      '<div class="g g-2"><label class="field"><span>Ambang hari pengingat (pisahkan koma)</span><input id="m-days" class="mono" value="' + esc(c('CAL_REMINDER_DAYS')) + '" placeholder="60,30,7"></label>' +
      '<label class="field"><span>Penerima email (pisahkan koma)</span><input id="m-to" value="' + esc(c('ALERT_EMAILS')) + '" placeholder="fismed@rs.co.id, kadep@rs.co.id"></label>' +
      '<label class="field span-2"><span>URL aplikasi (untuk tautan di email) <span class="hint">· URL GitHub Pages Anda</span></span><div class="row"><input id="m-url" class="grow" value="' + esc(appUrl) + '" placeholder="https://username.github.io/e-dose-agora/"><button class="btn btn-ghost btn-sm" id="m-url-here">Pakai URL ini</button></div></label></div>' +
      '<div class="row-between" style="border-top:1px solid var(--outline-subtle);padding-top:16px"><button class="btn btn-outline" id="m-test">' + UI.icon('mail') + 'Kirim Email Uji</button><button class="btn btn-primary" id="m-save">Simpan Notifikasi</button></div></section>' +
      '<section class="card card-flush mt"><div class="card-hd"><h3 class="h-sm">Log Notifikasi Terakhir</h3><span class="small muted">Log_Notifications</span></div>' +
      (logs.length ? '<div class="tbl-wrap"><table class="tbl tbl-compact"><thead><tr><th>Waktu</th><th>Jenis</th><th>Referensi</th><th>Penerima</th><th>Status</th></tr></thead><tbody>' + logs.map(function (l) {
        return '<tr><td class="mono small">' + esc(String(l.sent_at).replace('T', ' ').slice(0, 16)) + '</td><td class="small">' + (l.notif_type === 'CAL_REMINDER' ? 'Pengingat Kalibrasi' : 'Alert Toleransi') + '</td><td class="mono small">' + esc(String(l.ref_id).split('|')[0]) + '</td><td class="small">' + esc(l.recipient_emails || '—') + '</td>' +
          '<td><span class="badge b-sm ' + (l.status === 'SENT' ? 'b-pass' : l.status === 'ERROR' ? 'b-fail' : 'b-muted') + '" title="' + esc(l.detail) + '">' + esc(l.status) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty small">Belum ada notifikasi terkirim.</div>') + '</section>';
  }

  function pAdmin() {
    return '<section class="card stack"><h2 class="h-sm">Akun Admin &amp; Keamanan</h2>' +
      '<div class="kv"><div><span class="k">Username aktif</span><span class="v">' + esc((Store.auth || {}).user || 'admin') + '</span></div><div><span class="k">Sesi berlaku sampai</span><span class="v">' + (Store.auth && Store.auth.expiresAt ? new Date(Store.auth.expiresAt).toLocaleString('id-ID') : '—') + '</span></div>' +
      '<div><span class="k">Versi data lokal</span><span class="v">v' + Store.version + (Store.lastSync ? ' · sinkron ' + new Date(Store.lastSync).toLocaleTimeString('id-ID') : '') + '</span></div></div>' +
      '<form class="g g-2" id="pw-form"><label class="field"><span>Password lama</span><input type="password" name="old" autocomplete="current-password"></label><label class="field"><span>Username baru (opsional)</span><input name="user" autocomplete="username" placeholder="' + esc((Store.auth || {}).user || 'admin') + '"></label>' +
      '<label class="field"><span>Password baru (min. 8 karakter)</span><input type="password" name="new1" autocomplete="new-password"></label><label class="field"><span>Ulangi password baru</span><input type="password" name="new2" autocomplete="new-password"></label></form>' +
      '<p class="small muted" style="margin:0">Password disimpan sebagai hash SHA-256 + salt di Script Properties. Setelah diganti, sesi di perangkat lain otomatis keluar.</p>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="pw-save">Perbarui Password Admin</button></div></section>' +
      '<section class="card stack mt"><h2 class="h-sm">Data &amp; Cache Perangkat</h2><p class="small muted" style="margin:0">Aplikasi menyimpan salinan data di perangkat ini agar setiap halaman terbuka instan. Data asli tetap di Google Sheets.</p><div class="row wrap">' +
      (Api.isDemo() ? '<button class="btn btn-danger-outline" id="a-reset-demo">' + UI.icon('refresh') + 'Reset Data Demo</button>' : '<button class="btn btn-outline" id="a-resync">' + UI.icon('refresh') + 'Muat Ulang Data dari Server</button>') +
      '<button class="btn btn-ghost" id="a-clear">' + UI.icon('trash') + 'Hapus Cache &amp; Keluar</button></div></section>';
  }

  function bindTol(el) {
    var q = function (s) { return el.querySelector(s); };
    el.querySelectorAll('.lim-card input').forEach(function (i) {
      i.oninput = function () {
        var row = i.closest('.g'), w = row.querySelector('[id^=t-w]').value, a = row.querySelector('[id^=t-a]').value;
        row.querySelectorAll('[data-w]').forEach(function (s) { s.textContent = w; }); row.querySelectorAll('[data-a]').forEach(function (s) { s.textContent = a; });
      };
    });
    q('#t-sep').onchange = function () { sepDraft = this.checked; App.render({ keepScroll: true }); };
    q('#t-save').onclick = function () {
      var v = { WARNING_LIMIT: q('#t-w').value, ACTION_LIMIT: q('#t-a').value, SEPARATE_LIMITS: String(q('#t-sep').checked), T0: q('#t-T0').value, P0: q('#t-P0').value };
      if (q('#t-w_ELECTRON')) { v.WARNING_LIMIT_ELECTRON = q('#t-w_ELECTRON').value; v.ACTION_LIMIT_ELECTRON = q('#t-a_ELECTRON').value; if (+v.WARNING_LIMIT_ELECTRON >= +v.ACTION_LIMIT_ELECTRON) return UI.toast('Batas Warning elektron harus lebih kecil dari Action Level.', 'error'); }
      if (!(+v.WARNING_LIMIT > 0) || !(+v.ACTION_LIMIT > 0)) return UI.toast('Isi batas toleransi dengan angka > 0.', 'error');
      if (!(+v.P0 > 50) || !TRS398.ok(TRS398.num(v.T0))) return UI.toast('T₀ / P₀ tidak valid.', 'error');
      UI.confirm({ title: 'Ubah kebijakan toleransi?', body: '<p>PASS ≤ ±' + esc(v.WARNING_LIMIT) + '%, Action > ±' + esc(v.ACTION_LIMIT) + '%. Berlaku untuk pengukuran baru dan garis Control Chart.</p>', ok: 'Simpan' })
        .then(function (y) { if (y) { sepDraft = null; saveCfg(q('#t-save'), v, 'Kebijakan toleransi diperbarui.'); } });
    };
  }

  function resizeImage(file) {
    return new Promise(function (resolve) {
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, 160 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
          cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/png'));
        };
        img.onerror = function () { resolve(''); };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

  function bindRS(el) {
    var q = function (s) { return el.querySelector(s); }, logo = c('HOSPITAL_LOGO');
    function prev() { q('#h-logo-prev').innerHTML = logo ? '<img src="' + esc(logo) + '" alt="Logo">' : UI.LOGO; }
    q('#h-logo').oninput = function () { logo = this.value.trim(); prev(); };
    q('#h-file').onchange = async function () { if (!this.files[0]) return; logo = await resizeImage(this.files[0]); q('#h-logo').value = ''; prev(); if (!logo) UI.toast('File gambar tidak dapat dibaca.', 'error'); };
    if (q('#h-clear')) q('#h-clear').onclick = function () { logo = ''; q('#h-logo').value = ''; prev(); };
    q('#h-save').onclick = function () {
      saveCfg(this, { HOSPITAL_NAME: q('#h-name').value, HOSPITAL_UNIT: q('#h-unit').value, HOSPITAL_ADDRESS: q('#h-addr').value, HOSPITAL_LOGO: logo, KADEP_ID: q('#h-kadep').value }, 'Profil rumah sakit disimpan — kop laporan diperbarui.');
    };
  }

  function bindPer(el) {
    function modal(row) {
      FormModal({ title: row ? 'Edit Personel' : 'Tambah Personel', row: row || { role: 'FISMED', position: 'Fisikawan Medis' }, fields: PER_FIELDS,
        onSave: function (d) { return Api.mutate('saveMaster', { entity: 'personnel', row: d }); }, okToast: 'Data personel disimpan.' });
    }
    el.querySelector('#p-add').onclick = function () { modal(); };
    el.querySelectorAll('[data-edit-p]').forEach(function (b) { b.onclick = function () { modal(Data.PER()[b.dataset.editP]); }; });
    el.querySelectorAll('[data-del-p]').forEach(function (b) { b.onclick = function () { var p = Data.PER()[b.dataset.delP]; UI.hardDelete('personnel', p.person_id, p.full_name); }; });
    el.querySelectorAll('[data-toggle-p]').forEach(function (b) {
      b.onclick = async function () {
        var p = Data.PER()[b.dataset.toggleP];
        if (p.is_active && !(await UI.confirm({ title: 'Nonaktifkan ' + p.full_name + '?', body: '<p>Tidak muncul lagi di pilihan pelaksana. Nama tetap tercatat di riwayat & laporan lama.</p>', ok: 'Nonaktifkan', danger: true }))) return;
        var r = await Api.mutate('deleteMaster', { entity: 'personnel', id: p.person_id, active: !p.is_active });
        if (!r.success) UI.toast(esc(r.message), 'error');
      };
    });
  }

  function bindMail(el) {
    var q = function (s) { return el.querySelector(s); };
    q('#m-url-here').onclick = function () { q('#m-url').value = location.origin + location.pathname; };
    q('#m-save').onclick = function () {
      var days = q('#m-days').value.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return /^\d+$/.test(x); }).join(',');
      var to = q('#m-to').value.split(/[,;\s]+/).filter(Boolean);
      var bad = to.filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
      if (bad.length) return UI.toast('Email tidak valid: ' + esc(bad.join(', ')), 'error');
      saveCfg(this, { ALERT_ENABLED: String(q('#m-alert').checked), CAL_REMINDER_ENABLED: String(q('#m-cal').checked), CAL_REMINDER_DAYS: days || '60,30,7', ALERT_EMAILS: to.join(', '), APP_URL: q('#m-url').value.trim() }, 'Pengaturan notifikasi disimpan.');
    };
    q('#m-test').onclick = async function () {
      var to = q('#m-to').value.trim();
      if (!to) return UI.toast('Isi alamat penerima terlebih dahulu.', 'warning');
      UI.busy(this, true, 'Mengirim...');
      var r = Api.isDemo() ? await Api.mutate('testEmail', {}) : await Api.raw('testEmail', { to: to });
      UI.busy(this, false);
      UI.toast(esc(r.message), r.success ? 'success' : 'error');
    };
  }

  function bindAdmin(el) {
    var q = function (s) { return el.querySelector(s); };
    q('#pw-save').onclick = async function () {
      var f = UI.formData(q('#pw-form'));
      if (!f.old) return UI.toast('Isi password lama.', 'warning');
      if (String(f.new1).length < 8) return UI.toast('Password baru minimal 8 karakter.', 'warning');
      if (f.new1 !== f.new2) return UI.toast('Konfirmasi password baru tidak sama.', 'warning');
      UI.busy(this, true, 'Memperbarui...');
      var r = Api.isDemo() ? await Api.mutate('changePassword', { newPassword: f.new1, newUsername: f.user }) : await Api.raw('changePassword', { oldPassword: f.old, newPassword: f.new1, newUsername: f.user });
      UI.busy(this, false);
      if (!r.success) return UI.toast(esc(r.message), 'error');
      if (r.token) Store.setAuth({ token: r.token, user: r.user, expiresAt: r.expiresAt, demo: Api.isDemo() });
      q('#pw-form').reset();
      UI.toast(esc(r.message || 'Password diperbarui.'), 'success');
      App.render({ keepScroll: true });
    };
    if (q('#a-reset-demo')) q('#a-reset-demo').onclick = function () {
      UI.confirm({ title: 'Reset data demo?', body: '<p>Semua perubahan di mode demo dihapus dan diganti data contoh awal.</p>', ok: 'Reset', danger: true }).then(function (y) {
        if (!y) return; Store.data = AppModel.buildSeed(); Store.version = 1; Store.persist(); Store.emit('sync'); UI.toast('Data demo direset.', 'success'); App.go('#/dashboard');
      });
    };
    if (q('#a-resync')) q('#a-resync').onclick = async function () { UI.busy(this, true, 'Memuat...'); var r = await Api.sync(true); UI.busy(this, false); if (r && r.success) UI.toast('Data dimuat ulang dari server.', 'success'); else UI.toast(esc((r && r.message) || 'Gagal memuat.'), 'error'); };
    q('#a-clear').onclick = function () {
      UI.confirm({ title: 'Hapus cache perangkat & keluar?', body: '<p>Data lokal di browser ini dihapus. Data di server tidak terpengaruh.</p>', ok: 'Hapus & Keluar', danger: true }).then(function (y) {
        if (!y) return; Store.clearAll(); try { sessionStorage.clear(); } catch (e) { } location.hash = ''; location.reload();
      });
    };
  }

  Pages.pengaturan = {
    title: 'Pengaturan Aplikasi & Kebijakan Mutu', live: false,
    render: function (p) {
      if (p[0] && +p[0]) tab = +p[0];
      var body = tab === 1 ? pTol() : tab === 2 ? pRS() : tab === 3 ? pPer() : tab === 4 ? pMail() : pAdmin();
      return '<div class="split-3-9"><nav class="card subnav" aria-label="Sub-navigasi Pengaturan">' + TABS.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + UI.icon(t[2]) + t[1] + '</button>'; }).join('') + '</nav><div>' + body + '</div></div>';
    },
    mount: function (el) {
      el.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { tab = +b.dataset.tab; sepDraft = null; history.replaceState(null, '', '#/pengaturan/' + tab); App.render({ keepScroll: true }); }; });
      [bindTol, bindRS, bindPer, bindMail, bindAdmin][tab - 1](el);
    },
    onData: function (reason) { if (tab === 3 || (tab === 4 && reason !== 'write')) App.render({ keepScroll: true }); }
  };
})();
