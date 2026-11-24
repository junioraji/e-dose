/* =====================================================================
 * W-07 · Master Pesawat Linac & Fisika Berkas
 * W-08 · Master Detektor, Kalibrasi & Tabel kQ TRS-398
 * ===================================================================== */
/* Modal form generik — fields: [{name,label,type,options,step,req,hint,span,ph}] */
window.FormModal = function (o) {
  var esc = UI.esc, row = o.row || {};
  function field(f) {
    var v = row[f.name] !== undefined && row[f.name] !== null ? row[f.name] : (f.def !== undefined ? f.def : '');
    var lbl = '<span>' + esc(f.label) + (f.req ? ' <b class="req">*</b>' : '') + (f.hint ? ' <span class="hint">· ' + esc(f.hint) + '</span>' : '') + '</span>';
    var inner;
    if (f.type === 'select') inner = '<select name="' + f.name + '">' + f.options.map(function (op) { var val = Array.isArray(op) ? op[0] : op, lab = Array.isArray(op) ? op[1] : op; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'textarea') inner = '<textarea name="' + f.name + '" rows="3" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
    else if (f.type === 'checkbox') return '<label class="check ' + (f.span ? 'span-2' : '') + '" style="grid-column:' + (f.span ? '1/-1' : 'auto') + '"><input type="checkbox" name="' + f.name + '"' + (v === true || v === 'true' ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
    else inner = '<input name="' + f.name + '" type="' + (f.type || 'text') + '"' + (f.step ? ' step="' + f.step + '"' : '') + ' value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '"' + (f.type === 'number' || f.mono ? ' class="mono"' : '') + '>';
    return '<label class="field" data-f="' + f.name + '" style="' + (f.span ? 'grid-column:1/-1' : '') + '">' + lbl + inner + '</label>';
  }
  var m = UI.modal({
    title: o.title, size: o.size || '',
    body: (o.intro || '') + '<form class="g g-2" novalidate>' + o.fields.map(function (f) { return f.section ? '<div style="grid-column:1/-1" class="label caps muted mt">' + esc(f.section) + '</div>' : field(f); }).join('') + '</form>' + (o.extra || ''),
    footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" data-save>' + esc(o.okLabel || 'Simpan') + '</button>',
    onMount: function (el, close) {
      var form = el.querySelector('form');
      if (o.onMount) o.onMount(el, form);
      function submit(e) {
        if (e) e.preventDefault();
        var data = UI.formData(form), bad = false;
        o.fields.forEach(function (f) {
          if (f.section) return;
          var inp = form.querySelector('[name="' + f.name + '"]');
          if (f.type === 'number') data[f.name] = data[f.name] === '' ? '' : Number(data[f.name]);
          var hidden = inp && inp.closest('.field') && inp.closest('.field').classList.contains('hidden');
          if (f.req && !hidden && (data[f.name] === '' || data[f.name] === undefined || (f.type === 'number' && !isFinite(data[f.name])))) { bad = true; if (inp) inp.classList.add('invalid'); }
          else if (inp) inp.classList.remove('invalid');
        });
        if (bad) return UI.toast('Lengkapi kolom bertanda *.', 'warning');
        Promise.resolve(o.onSave(Object.assign({}, row, data))).then(function (res) {
          if (res && res.success === false) return UI.toast(UI.esc(res.message), 'error');
          close();
          UI.toast(o.okToast || 'Tersimpan.', 'success');
        });
      }
      el.querySelector('[data-save]').onclick = submit;
      form.addEventListener('submit', submit);
    }
  });
  return m;
};

(function () {
  var esc = UI.esc, N = TRS398.num;
  var sel = '';

  var ENERGY_FIELDS = [
    { name: 'beam_type', label: 'Modalitas', type: 'select', options: [['PHOTON', 'Photon'], ['ELECTRON', 'Electron']], req: true },
    { name: 'energy_label', label: 'Label Energi', req: true, ph: '6 MV / 6 FFF / 9 MeV' },
    { name: 'setup_type', label: 'Setup Referensi', type: 'select', options: [['SSD', 'SSD (pakai PDD)'], ['SAD', 'SAD (pakai TMR)']], req: true },
    { name: 'ssd_sad_cm', label: 'Jarak SSD/SAD', type: 'number', step: '0.1', def: 100, hint: 'cm' },
    { name: 'quality_index', label: 'Kualitas Berkas', type: 'number', step: '0.001', req: true, hint: 'TPR20,10 (foton) / R50 cm (elektron)' },
    { name: 'z_ref_cm', label: 'z_ref', type: 'number', step: '0.01', req: true, hint: 'cm' },
    { name: 'z_max_cm', label: 'z_max', type: 'number', step: '0.01', hint: 'cm' },
    { name: 'pdd_zref', label: 'PDD(z_ref)', type: 'number', step: '0.01', hint: '% — untuk setup SSD' },
    { name: 'tmr_zref', label: 'TMR(z_ref)', type: 'number', step: '0.0001', hint: 'untuk setup SAD' },
    { name: 'baseline_cgy_mu', label: 'Baseline Output', type: 'number', step: '0.001', req: true, def: 1.000, hint: 'cGy/MU di z_max' },
    { name: 'kpol_default', label: 'k_pol tersimpan', type: 'number', step: '0.0001', def: 1.000 },
    { name: 'ks_default', label: 'k_s tersimpan', type: 'number', step: '0.0001', def: 1.000 }
  ];
  var LINAC_FIELDS = [
    { name: 'linac_name', label: 'Nama Pesawat', req: true, ph: 'Varian TrueBeam #3' }, { name: 'linac_model', label: 'Merk / Model', ph: 'Varian TrueBeam STx' },
    { name: 'serial_no', label: 'Serial Number', mono: true, ph: 'SN-0000' }, { name: 'bunker', label: 'Lokasi / Bunker', ph: 'Bunker 3' }
  ];
  function energyMount(el, form) {
    function sync() {
      var bt = form.querySelector('[name=beam_type]').value, setup = form.querySelector('[name=setup_type]').value;
      form.querySelector('[data-f=pdd_zref]').classList.toggle('hidden', setup !== 'SSD');
      form.querySelector('[data-f=tmr_zref]').classList.toggle('hidden', setup !== 'SAD');
      form.querySelector('[data-f=quality_index] > span').innerHTML = (bt === 'ELECTRON' ? 'R50 (cm)' : 'TPR20,10') + ' <b class="req">*</b>';
      var hint = form.querySelector('#zref-hint');
      if (hint) hint.remove();
      var q = N(form.querySelector('[name=quality_index]').value);
      var zr = form.querySelector('[data-f=z_ref_cm]');
      var txt = bt === 'ELECTRON' ? (TRS398.ok(q) ? 'TRS-398: z_ref = 0.6·R50 − 0.1 = <b class="mono">' + (0.6 * q - 0.1).toFixed(2) + ' cm</b> <button type="button" class="btn-text label" id="zref-apply">Pakai</button>' : 'TRS-398: z_ref = 0.6·R50 − 0.1 cm') : 'TRS-398 foton: z_ref = 10 g/cm² (5 cm bila TPR < 0.7 boleh)';
      zr.insertAdjacentHTML('beforeend', '<span class="hint" id="zref-hint">' + txt + '</span>');
    }
    /* delegasi: tombol "Pakai" dibuat ulang saat input kehilangan fokus */
    form.addEventListener('mousedown', function (e) { if (e.target.closest('#zref-apply')) e.preventDefault(); });
    form.addEventListener('click', function (e) {
      if (!e.target.closest('#zref-apply')) return;
      var q = N(form.querySelector('[name=quality_index]').value);
      if (TRS398.ok(q)) form.querySelector('[name=z_ref_cm]').value = (0.6 * q - 0.1).toFixed(2);
    });
    form.addEventListener('change', sync); form.querySelector('[name=quality_index]').addEventListener('input', sync); sync();
  }

  function energyModal(linac, row) {
    FormModal({
      title: (row ? 'Edit Energi — ' : 'Tambah Energi — ') + linac.linac_name, row: row || { beam_type: 'PHOTON', setup_type: 'SSD' }, fields: ENERGY_FIELDS, onMount: energyMount,
      intro: row ? '<div class="notice n-info mb">' + UI.icon('lock') + '<div>Perubahan parameter berlaku untuk pengukuran <b>baru</b>. Record lama tetap memakai snapshot saat diukur (valid audit).</div></div>' : '',
      onSave: function (d) {
        d.linac_id = linac.linac_id; d.linac_name = linac.linac_name; d.linac_model = linac.linac_model; d.serial_no = linac.serial_no; d.bunker = linac.bunker;
        if (d.is_active === undefined) d.is_active = true;
        return Api.mutate('saveMaster', { entity: 'energies', row: d });
      }, okToast: 'Data energi disimpan.'
    });
  }

  function linacList(L) {
    return '<section class="stack-sm">' + L.map(function (l) {
      var act = l.energies.filter(function (e) { return e.is_active; });
      return '<article class="card linac-card ' + (l.linac_id === sel ? 'on' : '') + (l.is_active ? '' : ' row-off') + '" data-sel="' + esc(l.linac_id) + '"><div class="row-between" style="align-items:flex-start"><div><h2 class="h-sm">' + esc(l.linac_name) + '</h2><p class="mono small muted" style="margin:0">' + esc(l.serial_no) + ' · ' + esc(l.bunker) + '</p></div>' +
        (l.is_active ? '<span class="badge ' + (l.linac_id === sel ? 'b-info' : 'b-muted') + ' b-sm">' + act.length + ' Energi</span>' : '<span class="badge b-muted b-sm">Nonaktif</span>') + '</div>' +
        '<p class="small muted" style="margin:6px 0 0">' + act.map(function (e) { return esc(e.energy_label); }).join(', ') + '</p>' +
        (l.linac_id === sel ? '<div class="row mt" style="justify-content:flex-end;border-top:1px solid var(--info-surface-border);padding-top:8px"><button class="btn-text label" data-edit-linac>Edit</button><button class="btn-text label" data-toggle-linac style="color:' + (l.is_active ? 'var(--fail-accent)' : 'var(--pass-text)') + '">' + (l.is_active ? 'Nonaktifkan' : 'Aktifkan') + '</button></div>' : '') + '</article>';
    }).join('') + '</section>';
  }

  function energyTable(l) {
    var ens = l.energies;
    return '<section class="card card-flush"><div class="card-hd"><div><h2 class="h-sm">Daftar Energi &amp; Parameter Fisika — ' + esc(l.linac_name) + '</h2><p class="small muted" style="margin:0">Parameter ini ditarik otomatis saat Input QC Absolut</p></div>' +
      '<button class="btn btn-secondary btn-sm" id="add-energy">' + UI.icon('plus') + 'Tambah Energi</button></div>' +
      (ens.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Modalitas</th><th>Energi</th><th>Setup</th><th class="r">Baseline</th><th class="r">TPR20,10 / R50</th><th class="r">PDD / TMR</th><th class="r">z_ref</th><th class="r">k_pol · k_s</th><th class="r">Aksi</th></tr></thead><tbody>' +
        ens.map(function (e) {
          return '<tr class="' + (e.is_active ? '' : 'row-off') + '"><td><span class="badge ' + (e.beam_type === 'ELECTRON' ? 'b-cleared' : 'b-info') + ' b-sm">' + (e.beam_type === 'ELECTRON' ? 'Electron' : 'Photon') + '</span></td>' +
            '<td style="font-weight:700;color:var(--primary)">' + esc(e.energy_label) + (e.is_active ? '' : ' <span class="small muted">(nonaktif)</span>') + '</td><td class="mono">' + esc(e.setup_type) + ' ' + UI.f(e.ssd_sad_cm, 0) + '</td>' +
            '<td class="r mono">' + UI.f(e.baseline_cgy_mu, 3) + '</td><td class="r mono">' + (e.beam_type === 'ELECTRON' ? UI.f(e.quality_index, 2) + ' cm' : UI.f(e.quality_index, 3)) + '</td>' +
            '<td class="r mono">' + (e.setup_type === 'SAD' ? UI.f(e.tmr_zref, 4) : UI.f(e.pdd_zref, 2) + '%') + '</td><td class="r mono">' + UI.f(e.z_ref_cm, 2) + '</td><td class="r mono small">' + UI.f(e.kpol_default, 4) + ' · ' + UI.f(e.ks_default, 4) + '</td>' +
            '<td class="r"><span class="acts"><button class="icon-btn" data-edit-e="' + esc(e.energy_id) + '" aria-label="Edit">' + UI.icon('pen') + '</button><button class="icon-btn ' + (e.is_active ? 'danger' : '') + '" data-toggle-e="' + esc(e.energy_id) + '" aria-label="' + (e.is_active ? 'Nonaktifkan' : 'Aktifkan') + '" title="' + (e.is_active ? 'Nonaktifkan' : 'Aktifkan') + '">' + UI.icon('power') + '</button></span></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Belum ada energi.</div>') + '</section>';
  }

  Pages.linac = {
    title: 'Master Pesawat Linac & Fisika Berkas', live: true,
    actions: function () { return '<button class="btn btn-primary" id="add-linac">' + UI.icon('plus') + 'Tambah Pesawat Linac</button>'; },
    render: function () {
      var L = Data.linacs(true);
      if (!L.some(function (l) { return l.linac_id === sel; })) sel = (L[0] || {}).linac_id;
      var l = L.filter(function (x) { return x.linac_id === sel; })[0];
      return '<div class="split-4-8">' + linacList(L) + (l ? energyTable(l) : '<div class="card empty">Belum ada pesawat Linac. Klik <b>Tambah Pesawat Linac</b>.</div>') + '</div>';
    },
    mount: function (el) {
      var L = Data.linacs(true), l = L.filter(function (x) { return x.linac_id === sel; })[0];
      el.querySelectorAll('[data-sel]').forEach(function (c) { c.onclick = function (e) { if (e.target.closest('button')) return; sel = c.dataset.sel; App.render({ keepScroll: true }); }; });
      document.getElementById('add-linac').onclick = function () {
        FormModal({
          title: 'Tambah Pesawat Linac', size: 'lg', row: { beam_type: 'PHOTON', setup_type: 'SSD' }, fields: LINAC_FIELDS.concat([{ section: 'Energi pertama' }]).concat(ENERGY_FIELDS), onMount: energyMount,
          onSave: function (d) { d.is_active = true; return Api.mutate('saveMaster', { entity: 'energies', row: d }).then(function (r) { if (r.success) sel = r.row.linac_id; return r; }); }, okToast: 'Pesawat Linac ditambahkan.'
        });
      };
      if (!l) return;
      var add = el.querySelector('#add-energy'); if (add) add.onclick = function () { energyModal(l); };
      el.querySelectorAll('[data-edit-e]').forEach(function (b) { b.onclick = function () { energyModal(l, Data.E()[b.dataset.editE]); }; });
      el.querySelectorAll('[data-toggle-e]').forEach(function (b) {
        b.onclick = async function () {
          var e = Data.E()[b.dataset.toggleE];
          if (e.is_active && !(await UI.confirm({ title: 'Nonaktifkan ' + e.energy_label + '?', body: '<p>Energi tidak muncul lagi di Input QC & dashboard. Riwayat pengukuran tetap tersimpan.</p>', ok: 'Nonaktifkan', danger: true }))) return;
          var r = await Api.mutate('deleteMaster', { entity: 'energies', id: e.energy_id, active: !e.is_active });
          if (!r.success) UI.toast(esc(r.message), 'error');
        };
      });
      var ed = el.querySelector('[data-edit-linac]');
      if (ed) ed.onclick = function () {
        FormModal({ title: 'Edit Pesawat Linac', row: l, fields: LINAC_FIELDS, onSave: function (d) { return Api.mutate('renameLinac', { linac_id: l.linac_id, linac_name: d.linac_name, linac_model: d.linac_model, serial_no: d.serial_no, bunker: d.bunker }); }, okToast: 'Data pesawat diperbarui.' });
      };
      var tg = el.querySelector('[data-toggle-linac]');
      if (tg) tg.onclick = async function () {
        if (l.is_active && !(await UI.confirm({ title: 'Nonaktifkan ' + l.linac_name + '?', body: '<p>Seluruh energi pesawat ini akan dinonaktifkan. Riwayat tetap tersimpan.</p>', ok: 'Nonaktifkan', danger: true }))) return;
        var r = await Api.mutate('renameLinac', { linac_id: l.linac_id, is_active: !l.is_active });
        if (!r.success) UI.toast(esc(r.message), 'error');
      };
    }
  };

  /* -------------------- W-08 DETEKTOR & kQ -------------------- */
  var T = { tab: 1, q: '', status: '', cat: '', model: '', beam: 'PHOTON', test: '' };
  var DET_FIELDS = [
    { name: 'category', label: 'Kategori', type: 'select', options: [['CHAMBER', 'Ion Chamber'], ['ELECTROMETER', 'Electrometer']], req: true },
    { name: 'chamber_type', label: 'Tipe Chamber', type: 'select', options: [['CYLINDRICAL', 'Silindris (Farmer)'], ['PLANE_PARALLEL', 'Plan-paralel'], ['', '— (elektrometer)']] },
    { name: 'model_name', label: 'Model', req: true, ph: 'PTW 30013 Farmer', hint: 'harus sama dengan nama di tabel kQ' },
    { name: 'serial_no', label: 'Serial Number', req: true, mono: true },
    { name: 'cal_factor', label: 'Faktor Kalibrasi', type: 'number', step: '0.0001', req: true, hint: 'N_D,w (chamber) / k_elec (elektrometer)' },
    { name: 'unit', label: 'Satuan', type: 'select', options: [['cGy/nC', 'cGy/nC'], ['Gy/C', 'Gy/C'], ['mGy/nC', 'mGy/nC'], ['k_elec', 'k_elec (tanpa satuan)']] },
    { name: 'cal_lab', label: 'Lembaga Kalibrasi', ph: 'PTKMR BRIN' }, { name: 'cert_no', label: 'Nomor Sertifikat', mono: true },
    { name: 'cal_date', label: 'Tanggal Kalibrasi', type: 'date' }, { name: 'expiry_date', label: 'Tanggal Kedaluwarsa', type: 'date', req: true }
  ];
  function detMount(el, form) {
    function sync() {
      var c = form.querySelector('[name=category]').value;
      form.querySelector('[data-f=chamber_type]').classList.toggle('hidden', c !== 'CHAMBER');
      var u = form.querySelector('[name=unit]');
      if (c === 'ELECTROMETER') u.value = 'k_elec'; else if (u.value === 'k_elec') u.value = 'cGy/nC';
    }
    form.querySelector('[name=category]').addEventListener('change', sync); sync();
  }
  function detModal(row) {
    FormModal({
      title: row ? 'Edit Alat Ukur — ' + row.model_name : 'Tambah Detektor / Elektrometer', row: row || { category: 'CHAMBER', chamber_type: 'CYLINDRICAL', unit: 'cGy/nC' }, fields: DET_FIELDS, onMount: detMount,
      intro: row ? '<div class="notice n-info mb">' + UI.icon('lock') + '<div>Setelah kalibrasi ulang, perbarui faktor & tanggal di sini. Pengukuran lama tetap memakai faktor saat diukur.</div></div>' : '',
      onSave: function (d) { if (d.category === 'ELECTROMETER') d.chamber_type = ''; return Api.mutate('saveMaster', { entity: 'detectors', row: d }); }, okToast: 'Data alat ukur disimpan.'
    });
  }

  function detTab() {
    var today = Data.today(), w = Data.reminderMax(), q = T.q.toLowerCase();
    var list = Store.data.detectors.map(function (d) { return { d: d, cs: AppModel.calStatus(d, today, w) }; }).filter(function (x) {
      var st = x.d.is_active ? x.cs.status : 'OFF';
      return (!q || (x.d.model_name + ' ' + x.d.serial_no + ' ' + x.d.cert_no).toLowerCase().indexOf(q) >= 0) && (!T.status || st === T.status) && (!T.cat || x.d.category === T.cat);
    }).sort(function (a, b) { return (a.d.category + a.d.model_name).localeCompare(b.d.category + b.d.model_name); });
    return '<div class="stack"><div class="card row-between" style="padding:16px"><div class="row wrap">' +
      '<div class="inp-icon" style="width:260px;max-width:100%">' + UI.icon('search') + '<input class="inp" type="search" id="d-q" placeholder="Cari model, seri, sertifikat..." value="' + esc(T.q) + '"></div>' +
      '<select class="sel" style="width:auto" id="d-cat">' + UI.options([['CHAMBER', 'Ion Chamber'], ['ELECTROMETER', 'Electrometer']], function (x) { return x[0]; }, function (x) { return x[1]; }, T.cat, 'Semua Kategori') + '</select>' +
      '<select class="sel" style="width:auto" id="d-st">' + UI.options([['VALID', 'VALID'], ['EXPIRING', 'EXPIRING'], ['EXPIRED', 'EXPIRED'], ['OFF', 'Nonaktif']], function (x) { return x[0]; }, function (x) { return x[1]; }, T.status, 'Semua Status Kalibrasi') + '</select></div>' +
      '<button class="btn btn-primary" id="d-add">' + UI.icon('plus') + 'Tambah Detektor / Elektrometer</button></div>' +
      '<section class="card card-flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kategori</th><th>Model &amp; Serial No</th><th class="r">Faktor Kalibrasi</th><th>Lembaga &amp; Sertifikat</th><th>Kalibrasi</th><th>Kedaluwarsa</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' +
      (list.length ? list.map(function (x) {
        var d = x.d, st = !d.is_active ? 'OFF' : x.cs.status;
        var b = st === 'VALID' ? '<span class="badge b-pass">' + UI.icon('check', 'ic-xs', 2.2) + 'VALID</span>' : st === 'EXPIRING' ? '<span class="badge b-warning">' + UI.icon('alert', 'ic-xs', 2.2) + 'EXPIRING (' + x.cs.days + 'h)</span>' : st === 'EXPIRED' ? '<span class="badge b-fail">' + UI.icon('alertC', 'ic-xs', 2.2) + 'EXPIRED</span>' : '<span class="badge b-muted">Nonaktif</span>';
        return '<tr class="' + (st === 'EXPIRING' ? 'row-warn' : '') + (st === 'OFF' ? ' row-off' : '') + '"><td class="label" style="color:' + (d.category === 'CHAMBER' ? 'var(--primary)' : 'var(--secondary)') + '">' + (d.category === 'CHAMBER' ? 'Ion Chamber' + (d.chamber_type === 'PLANE_PARALLEL' ? '<div class="small muted" style="font-weight:400">plan-paralel</div>' : '') : 'Electrometer') + '</td>' +
          '<td><div class="t1">' + esc(d.model_name) + '</div><div class="mono small muted">#' + esc(d.serial_no) + '</div></td>' +
          '<td class="r mono" style="font-weight:600">' + (d.category === 'CHAMBER' ? UI.f(d.cal_factor, 3) + ' ' + esc(d.unit) : 'k_elec = ' + UI.f(d.cal_factor, 4)) + '</td>' +
          '<td style="font-size:13px">' + esc(d.cal_lab) + ' · <span class="mono">' + esc(d.cert_no) + '</span></td><td class="mono small">' + UI.date(d.cal_date) + '</td>' +
          '<td class="mono small ' + (st === 'EXPIRING' ? 't-warning' : st === 'EXPIRED' ? 't-fail' : '') + '" style="font-weight:600">' + UI.date(d.expiry_date) + '</td><td>' + b + '</td>' +
          '<td class="r"><span class="acts"><button class="icon-btn" data-edit-d="' + esc(d.detector_id) + '" aria-label="Edit">' + UI.icon('pen') + '</button><button class="icon-btn ' + (d.is_active ? 'danger' : '') + '" data-toggle-d="' + esc(d.detector_id) + '" aria-label="' + (d.is_active ? 'Nonaktifkan' : 'Aktifkan') + '" title="' + (d.is_active ? 'Nonaktifkan' : 'Aktifkan') + '">' + UI.icon('power') + '</button></span></td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">Tidak ada alat ukur.</td></tr>') + '</tbody></table></div></section></div>';
  }

  function kqModels() {
    var m = {};
    Store.data.detectors.forEach(function (d) { if (d.category === 'CHAMBER') m[d.model_name] = 1; });
    Store.data.kq.forEach(function (k) { m[k.chamber_model] = 1; });
    return Object.keys(m).sort();
  }
  function kqTab() {
    var models = kqModels();
    if (models.indexOf(T.model) < 0) T.model = models[0] || '';
    var rows = Store.data.kq.filter(function (k) { return k.chamber_model === T.model && k.beam_type === T.beam; }).sort(function (a, b) { return a.quality_index_val - b.quality_index_val; });
    var qlabel = T.beam === 'PHOTON' ? 'TPR20,10' : 'R50 (cm)';
    var test = TRS398.lookupKq(Store.data.kq, T.model, T.beam, T.test);
    return '<div class="stack"><div class="card row-between" style="padding:16px"><div class="row wrap">' +
      '<select class="sel" style="width:auto;font-weight:600;color:var(--primary)" id="k-model">' + UI.options(models, function (x) { return x; }, function (x) { return x; }, T.model) + '</select>' +
      '<div class="seg"><button data-beam="PHOTON" class="' + (T.beam === 'PHOTON' ? 'on' : '') + '">Photon TPR20,10</button><button data-beam="ELECTRON" class="' + (T.beam === 'ELECTRON' ? 'on' : '') + '">Electron R50</button></div>' +
      '<span class="badge b-info">Auto-interpolasi linier aktif di Input QC</span></div><div class="row"><button class="btn btn-ghost" id="k-paste">' + UI.icon('clipboard') + 'Tempel Tabel</button><button class="btn btn-secondary" id="k-add">' + UI.icon('plus') + 'Tambah Baris kQ</button></div></div>' +
      '<div class="notice n-warning">' + UI.icon('alert') + '<div>Nilai awal di tabel ini adalah <b>CONTOH</b>. Sebelum Go-Live, ganti dengan nilai resmi IAEA TRS-398 (Tabel 14 foton / Tabel 18 elektron) atau sertifikat SSDL untuk chamber Anda. Interpolasi tidak mengekstrapolasi di luar rentang tabel.</div></div>' +
      '<div class="split-4-8" style="grid-template-columns:minmax(0,8fr) minmax(0,4fr)"><section class="card card-flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + qlabel + '</th><th class="r">k_Q,Q0</th><th>Sumber</th><th class="r">Aksi</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (k) {
        return '<tr><td class="mono" style="font-weight:600">' + UI.f(k.quality_index_val, T.beam === 'PHOTON' ? 3 : 2) + '</td><td class="r mono">' + UI.f(k.kq_value, 4) + '</td><td class="small muted">' + esc(k.source) + '</td>' +
          '<td class="r"><span class="acts"><button class="icon-btn" data-edit-k="' + esc(k.kq_id) + '" aria-label="Edit">' + UI.icon('pen') + '</button><button class="icon-btn danger" data-del-k="' + esc(k.kq_id) + '" aria-label="Hapus">' + UI.icon('trash') + '</button></span></td></tr>';
      }).join('') : '<tr><td colspan="4" class="empty">Belum ada data kQ untuk ' + esc(T.model) + ' (' + T.beam + ').</td></tr>') + '</tbody></table></div></section>' +
      '<section class="card stack-sm"><h3 class="h-sm">Uji Interpolasi</h3><label class="field"><span>' + qlabel + '</span><input id="k-test" type="number" step="0.001" value="' + esc(T.test) + '" placeholder="' + (T.beam === 'PHOTON' ? '0.734' : '3.61') + '"></label>' +
      '<div class="calc-out" id="k-test-out" style="height:auto;min-height:40px;white-space:normal;padding:8px 12px">' + testOut(test) + '</div></section></div></div>';
  }
  function testOut(t) {
    if (!T.test) return '<span class="muted" style="font-weight:400">Masukkan nilai kualitas berkas</span>';
    return t.error ? '<span class="t-fail small" style="font-family:var(--font);font-weight:500">' + esc(t.error) + '</span>' : 'k_Q = ' + t.value.toFixed(4) + (t.exact ? '' : '<div class="small muted" style="font-weight:400">antara ' + t.lo.x + ' (' + t.lo.y + ') dan ' + t.hi.x + ' (' + t.hi.y + ')</div>');
  }
  function kqModal(row) {
    FormModal({
      title: row ? 'Edit Baris kQ' : 'Tambah Baris kQ — ' + T.model, size: 'sm', row: row || { chamber_model: T.model, beam_type: T.beam, source: 'IAEA TRS-398' },
      fields: [{ name: 'chamber_model', label: 'Model Chamber', req: true, span: true }, { name: 'beam_type', label: 'Jenis Berkas', type: 'select', options: [['PHOTON', 'Photon'], ['ELECTRON', 'Electron']], req: true },
        { name: 'quality_index_val', label: 'TPR20,10 / R50', type: 'number', step: '0.001', req: true }, { name: 'kq_value', label: 'k_Q,Q0', type: 'number', step: '0.0001', req: true }, { name: 'source', label: 'Sumber', ph: 'IAEA TRS-398 Tabel 14' }],
      onSave: function (d) { return Api.mutate('saveMaster', { entity: 'kq', row: d }); }, okToast: 'Baris kQ disimpan.'
    });
  }
  /* "0.62<tab>0.997", "0,62;0,997", "0.62, 0.997", "0,62 0,997" */
  function parseLine(l) {
    l = l.trim(); if (!l) return [];
    var parts = /[\t;]/.test(l) ? l.split(/[\t;]+/) : /^\s*[\d.]+\s*,\s*[\d.]+\s*$/.test(l) ? l.split(',') : l.split(/\s+/);
    return parts.map(function (x) { return Number(String(x).trim().replace(',', '.')); });
  }
  function pasteModal() {
    UI.modal({
      title: 'Tempel Tabel kQ — ' + T.model + ' (' + T.beam + ')',
      body: '<p class="small muted" style="margin-top:0">Salin dua kolom dari Excel/PDF (kualitas berkas lalu kQ), satu baris per titik. Pemisah tab, spasi, titik koma atau koma (desimal titik). <b>Seluruh baris lama untuk model & jenis berkas ini akan diganti.</b></p>' +
        '<label class="field"><span>Data</span><textarea id="p-data" rows="10" class="mono" placeholder="0.62\t0.997\n0.65\t0.994\n0.68\t0.990"></textarea></label>' +
        '<label class="field mt"><span>Sumber</span><input id="p-src" value="IAEA TRS-398 ' + (T.beam === 'PHOTON' ? 'Tabel 14' : 'Tabel 18') + '"></label><div id="p-prev" class="small muted mt"></div>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="p-save" disabled>Ganti Tabel</button>',
      onMount: function (el, close) {
        var rows = [];
        el.querySelector('#p-data').oninput = function () {
          rows = this.value.split(/\n/).map(parseLine).filter(function (r) { return r.length >= 2 && isFinite(r[0]) && isFinite(r[1]); }).map(function (r) { return [r[0], r[1]]; });
          el.querySelector('#p-prev').innerHTML = rows.length ? 'Terbaca <b>' + rows.length + '</b> baris: ' + rows.slice(0, 4).map(function (r) { return '<span class="mono">' + r[0] + '→' + r[1] + '</span>'; }).join(', ') + (rows.length > 4 ? ' …' : '') : '';
          el.querySelector('#p-save').disabled = !rows.length;
        };
        el.querySelector('#p-save').onclick = async function () {
          var r = await Api.mutate('saveKqBulk', { chamber_model: T.model, beam_type: T.beam, rows: rows, source: el.querySelector('#p-src').value });
          if (!r.success) return UI.toast(esc(r.message), 'error');
          close(); UI.toast(rows.length + ' baris kQ disimpan.', 'success');
        };
      }
    });
  }

  Pages.detektor = {
    title: 'Master Detektor, Kalibrasi & Tabel kQ TRS-398', live: true,
    actions: function () { var a = Data.calAlerts(); return a.length ? '<span class="badge b-warning" style="padding:6px 12px">' + UI.icon('alert', 'ic-xs', 2) + a.length + ' Kalibrasi Perlu Perhatian</span>' : ''; },
    render: function () {
      return '<div class="tabs" role="tablist"><button data-tab="1" class="' + (T.tab === 1 ? 'on' : '') + '" role="tab">Daftar Detektor &amp; Elektrometer</button><button data-tab="2" class="' + (T.tab === 2 ? 'on' : '') + '" role="tab">Tabel Referensi kQ TRS-398</button></div>' +
        (T.tab === 1 ? detTab() : kqTab());
    },
    mount: function (el) {
      var q = function (s) { return el.querySelector(s); };
      el.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { T.tab = +b.dataset.tab; App.render({ keepScroll: true }); }; });
      if (T.tab === 1) {
        var deb = UI.debounce(function () { App.render({ keepScroll: true }); var i = document.getElementById('d-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200);
        q('#d-q').oninput = function () { T.q = this.value; deb(); };
        q('#d-cat').onchange = function () { T.cat = this.value; App.render({ keepScroll: true }); };
        q('#d-st').onchange = function () { T.status = this.value; App.render({ keepScroll: true }); };
        q('#d-add').onclick = function () { detModal(); };
        el.querySelectorAll('[data-edit-d]').forEach(function (b) { b.onclick = function () { detModal(Data.DET()[b.dataset.editD]); }; });
        el.querySelectorAll('[data-toggle-d]').forEach(function (b) {
          b.onclick = async function () {
            var d = Data.DET()[b.dataset.toggleD];
            if (d.is_active && !(await UI.confirm({ title: 'Nonaktifkan ' + d.model_name + ' ' + d.serial_no + '?', body: '<p>Alat tidak bisa dipilih di Input QC. Riwayat tetap utuh.</p>', ok: 'Nonaktifkan', danger: true }))) return;
            var r = await Api.mutate('deleteMaster', { entity: 'detectors', id: d.detector_id, active: !d.is_active });
            if (!r.success) UI.toast(esc(r.message), 'error');
          };
        });
      } else {
        q('#k-model').onchange = function () { T.model = this.value; App.render({ keepScroll: true }); };
        el.querySelectorAll('[data-beam]').forEach(function (b) { b.onclick = function () { T.beam = b.dataset.beam; T.test = ''; App.render({ keepScroll: true }); }; });
        q('#k-add').onclick = function () { kqModal(); };
        q('#k-paste').onclick = pasteModal;
        q('#k-test').oninput = function () { T.test = this.value; q('#k-test-out').innerHTML = testOut(TRS398.lookupKq(Store.data.kq, T.model, T.beam, T.test)); };
        el.querySelectorAll('[data-edit-k]').forEach(function (b) { b.onclick = function () { kqModal(Store.data.kq.filter(function (k) { return k.kq_id === b.dataset.editK; })[0]); }; });
        el.querySelectorAll('[data-del-k]').forEach(function (b) {
          b.onclick = async function () {
            if (!(await UI.confirm({ title: 'Hapus baris kQ?', body: '<p>Baris referensi akan dihapus permanen dari Master Tabel kQ.</p>', ok: 'Hapus', danger: true }))) return;
            var r = await Api.mutate('deleteMaster', { entity: 'kq', id: b.dataset.delK });
            if (!r.success) UI.toast(esc(r.message), 'error');
          };
        });
      }
    }
  };
})();
