/* =====================================================================
 * e-Dose Agora — Lapisan Data: Store (cache lokal), API GAS, antrean
 * simpan optimistis, dan backend lokal (mode demo & pratinjau optimistis)
 * ---------------------------------------------------------------------
 * Prinsip kecepatan:
 *  1. Semua data dimuat SEKALI (login/sync) lalu disimpan di localStorage.
 *     Pindah halaman = render dari memori, 0 panggilan server.
 *  2. Buka ulang aplikasi = tampil instan dari cache, sinkron di latar.
 *     Server cukup menjawab "unchanged" bila versi data sama.
 *  3. Simpan = UI berubah seketika (optimistis), server menyusul via antrean.
 * ===================================================================== */
var Store = (function () {
  var KEY_DATA = 'edose_data_v1', KEY_AUTH = 'edose_auth_v1', KEY_QUEUE = 'edose_queue_v1';
  var listeners = [];
  var S = { data: null, version: 0, auth: null, syncing: false, lastSync: 0, demo: false, online: true };

  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('localStorage penuh', e); } }

  S.loadCache = function () {
    var c = read(KEY_DATA); if (c && c.data) { S.data = c.data; S.version = c.version || 0; }
    S.auth = read(KEY_AUTH);
    if (S.auth && S.auth.expiresAt && S.auth.expiresAt < Date.now()) S.auth = null;
  };
  S.persist = function () { write(KEY_DATA, { version: S.version, data: S.data, savedAt: Date.now() }); };
  S.setAuth = function (a) { S.auth = a; if (a) write(KEY_AUTH, a); else localStorage.removeItem(KEY_AUTH); };
  S.clearAll = function () { [KEY_DATA, KEY_AUTH, KEY_QUEUE].forEach(function (k) { localStorage.removeItem(k); }); S.data = null; S.version = 0; S.auth = null; };
  S.readQueue = function () { return read(KEY_QUEUE) || []; };
  S.writeQueue = function (q) { write(KEY_QUEUE, q); };

  S.on = function (fn) { listeners.push(fn); };
  S.emit = function (reason) { listeners.forEach(function (fn) { try { fn(reason); } catch (e) { console.error(e); } }); };

  /* Tambal data lokal dengan baris yang berubah (hasil tulis server/lokal) */
  var KEYS = { config: 'config_key', personnel: 'person_id', energies: 'energy_id', detectors: 'detector_id', kq: 'kq_id', transactions: 'qc_id', notifications: 'log_id' };
  S.patch = function (changes, removed) {
    if (!S.data) return;
    Object.keys(changes || {}).forEach(function (ent) {
      (changes[ent] || []).forEach(function (row) {
        if (ent === 'config') { S.data.config[row.config_key] = row.config_value; return; }
        var list = S.data[ent] = S.data[ent] || [], k = KEYS[ent];
        var i = list.findIndex(function (x) { return x[k] === row[k]; });
        if (ent === 'notifications') { if (i < 0) list.unshift(row); return; }
        if (i >= 0) list[i] = row; else list.push(row);
      });
    });
    Object.keys(removed || {}).forEach(function (ent) {
      var k = KEYS[ent], ids = removed[ent];
      S.data[ent] = (S.data[ent] || []).filter(function (x) { return ids.indexOf(x[k]) < 0; });
    });
  };
  return S;
})();

/* =====================================================================
 * BACKEND LOKAL — logika sama dengan Kode.gs, berjalan di memori.
 * Dipakai: (a) mode demo tanpa GAS, (b) pratinjau optimistis sebelum
 * server menjawab (ID sementara berawalan TMP-).
 * ===================================================================== */
var LocalBackend = (function () {
  var tmpSeq = 0;
  function nowIso() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function today() { return nowIso().slice(0, 10); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pick(src, fields) { var o = {}; fields.forEach(function (f) { if (src[f] !== undefined) o[f] = src[f]; }); return o; }
  var MEAS = ['qc_datetime', 'fismed_id', 'temp_c', 'press_kpa', 'mu_set', 'm_raw_list', 'kpol_mode', 'k_pol', 'm_plus', 'm_minus', 'm_minus_list', 'ks_mode', 'k_s', 'm_v1', 'm_v2', 'm_v2_list', 'v1', 'v2', 'notes'];
  var ADJ = ['adj_datetime', 'adj_category', 'adj_action_desc', 'adj_performer', 'adj_ticket'];
  var ENT_ID = { personnel: ['person_id', 'P', 3], energies: ['energy_id', 'E', 2], detectors: ['detector_id', 'D', 2], kq: ['kq_id', 'KQ', 3] };
  var REQ = {
    personnel: ['full_name', 'role'], energies: ['linac_name', 'beam_type', 'energy_label', 'setup_type', 'z_ref_cm', 'quality_index', 'baseline_cgy_mu'],
    detectors: ['category', 'model_name', 'serial_no', 'cal_factor', 'expiry_date'], kq: ['chamber_model', 'beam_type', 'quality_index_val', 'kq_value']
  };
  function cleanLists(r) { ['m_raw_list', 'm_minus_list', 'm_v2_list'].forEach(function (k) { if (r[k] !== undefined) r[k] = cleanReadings(r[k]); }); return r; }
  function cleanReadings(l) { return (l || []).map(Number).filter(function (x) { return isFinite(x) && x !== 0; }).slice(0, 10); }
  function fail(m) { return { success: false, message: m }; }

  function checkInstruments(rec, db) {
    var D = AppModel.idx(db.detectors, 'detector_id'), ch = D[rec.chamber_id], el = D[rec.electrometer_id];
    if (!ch || ch.category !== 'CHAMBER') return 'Ion chamber tidak ditemukan.';
    if (!el || el.category !== 'ELECTROMETER') return 'Elektrometer tidak ditemukan.';
    var day = String(rec.qc_datetime || today()).slice(0, 10);
    if (ch.expiry_date && ch.expiry_date < day) return 'Sertifikat kalibrasi ' + ch.model_name + ' ' + ch.serial_no + ' kedaluwarsa (' + ch.expiry_date + ').';
    if (el.expiry_date && el.expiry_date < day) return 'Sertifikat kalibrasi ' + el.model_name + ' ' + el.serial_no + ' kedaluwarsa (' + el.expiry_date + ').';
    return '';
  }
  function nextQcId(tx, iso) {
    var y = String(iso || today()).slice(0, 4), max = 1000;
    tx.forEach(function (t) { var m = /^QC-(\d{4})-(\d+)$/.exec(t.qc_id); if (m && m[1] === y) max = Math.max(max, +m[2]); });
    return 'QC-' + y + '-' + (max + 1);
  }
  function nextId(list, key, prefix, w) {
    var max = 0; list.forEach(function (x) { var m = new RegExp('^' + prefix + '(\\d+)$').exec(x[key]); if (m) max = Math.max(max, +m[1]); });
    return prefix + String(max + 1).padStart(w, '0');
  }
  function tmp(p) { return 'TMP-' + p + '-' + Date.now().toString(36) + (++tmpSeq); }

  /* temp=true → ID sementara (optimistis), temp=false → ID final (demo) */
  function run(action, d, db, temp) {
    d = d || {};
    switch (action) {
      case 'saveQC': {
        var src = d.record || {}, rec = pick(src, MEAS);
        rec.energy_id = src.energy_id; rec.chamber_id = src.chamber_id; rec.electrometer_id = src.electrometer_id;
        if (!AppModel.idx(db.energies, 'energy_id')[rec.energy_id]) return fail('Energi berkas tidak ditemukan.');
        if (!rec.fismed_id) return fail('Pilih Fisikawan Medis pelaksana.');
        cleanLists(rec);
        var bad = checkInstruments(rec, db); if (bad) return fail(bad);
        var rc = AppModel.recompute(rec, db);
        if (!rc.result.valid) return fail(rc.result.errors.join(' '));
        rec.qc_id = temp ? tmp('QC') : nextQcId(db.transactions, rec.qc_datetime);
        rec.session_group_id = rec.qc_id; rec.record_type = 'AS_FOUND'; rec.iteration_no = 0;
        rec.created_at = rec.updated_at = nowIso(); rec.edit_log = [];
        var notif = null;
        if (!temp && rec.status === 'FAIL') notif = { log_id: 'N' + Date.now(), notif_type: 'TOLERANCE_ALERT', ref_id: rec.qc_id, recipient_emails: db.config.ALERT_EMAILS || '', sent_at: nowIso(), status: 'DEMO', detail: 'Mode demo — email tidak dikirim' };
        return { success: true, changes: { transactions: [rec], notifications: notif ? [notif] : [] }, record: rec, warnings: rc.result.warnings };
      }
      case 'updateQC': {
        var s2 = d.record || {};
        if (!String(d.reason || '').trim()) return fail('Alasan koreksi wajib diisi (jejak audit).');
        var old = db.transactions.filter(function (t) { return t.qc_id === s2.qc_id; })[0];
        if (!old) return fail('Data tidak ditemukan.');
        var r2 = clone(old), upd = pick(s2, MEAS.concat(old.record_type === 'ADJUSTMENT' ? ADJ : [])), ch = [];
        cleanLists(upd);
        Object.keys(upd).forEach(function (k) { if (JSON.stringify(upd[k]) !== JSON.stringify(old[k])) { ch.push({ f: k, o: old[k], n: upd[k] }); r2[k] = upd[k]; } });
        if (!ch.length) return { success: true, unchanged: true, record: old, changes: {} };
        var b2 = checkInstruments(r2, db); if (b2) return fail(b2);
        var rc2 = AppModel.recompute(r2, db, old);
        if (!rc2.result.valid) return fail(rc2.result.errors.join(' '));
        r2.edit_log = (old.edit_log || []).concat([{ at: nowIso(), reason: String(d.reason).slice(0, 300), changes: ch, oldStatus: old.status, oldDev: old.deviation_pct }]);
        r2.updated_at = nowIso();
        return { success: true, changes: { transactions: [r2] }, record: r2 };
      }
      case 'saveAdjustment': {
        var s3 = d.record || {};
        var grp = db.transactions.filter(function (t) { return t.session_group_id === s3.session_group_id; });
        var sum = TRS398.sessionSummary(grp);
        if (!sum.asFound) return fail('Sesi As-Found tidak ditemukan.');
        if (sum.status === 'CLEARED') return fail('Sesi ini sudah dinyatakan PASS (Cleared).');
        if (sum.asFound.status === 'PASS') return fail('As-Found berstatus PASS — tidak memerlukan adjustment.');
        if (!String(s3.adj_action_desc || '').trim()) return fail('Uraian tindakan perbaikan wajib diisi.');
        if (!String(s3.adj_performer || '').trim()) return fail('Nama pelaksana perbaikan wajib diisi.');
        var af = sum.asFound, r3 = pick(s3, MEAS.concat(ADJ));
        r3.energy_id = af.energy_id; r3.chamber_id = af.chamber_id; r3.electrometer_id = af.electrometer_id; r3.fismed_id = r3.fismed_id || af.fismed_id;
        cleanLists(r3);
        var b3 = checkInstruments(r3, db); if (b3) return fail(b3);
        var rc3 = AppModel.recompute(r3, db, af);
        if (!rc3.result.valid) return fail(rc3.result.errors.join(' '));
        var it = sum.adjustments.reduce(function (m, a) { return Math.max(m, +a.iteration_no || 0); }, 0) + 1;
        r3.qc_id = af.session_group_id + '-ADJ' + it; r3.session_group_id = af.session_group_id; r3.record_type = 'ADJUSTMENT'; r3.iteration_no = it;
        r3.created_at = r3.updated_at = nowIso(); r3.edit_log = [];
        return { success: true, changes: { transactions: [r3] }, record: r3, cleared: r3.status === 'PASS' };
      }
      case 'saveMaster': {
        var ent = d.entity, meta = ENT_ID[ent], list = db[ent] || [], row = d.row || {};
        if (!meta) return fail('Entitas tidak valid.');
        var miss = (REQ[ent] || []).filter(function (k) { return row[k] === '' || row[k] === undefined || row[k] === null; });
        if (miss.length) return fail('Kolom wajib belum diisi: ' + miss.join(', '));
        var cleanRow = clone(row);
        if (!cleanRow[meta[0]]) { cleanRow[meta[0]] = temp ? tmp(meta[1]) : nextId(list, meta[0], meta[1], meta[2]); if (cleanRow.is_active === undefined && ent !== 'kq') cleanRow.is_active = true; }
        else { var o2 = list.filter(function (x) { return x[meta[0]] === cleanRow[meta[0]]; })[0]; if (!o2) return fail('Data tidak ditemukan.'); cleanRow = Object.assign(clone(o2), cleanRow); }
        if (ent === 'energies' && !cleanRow.linac_id) {
          var same = list.filter(function (x) { return x.linac_name === cleanRow.linac_name; })[0];
          cleanRow.linac_id = same ? same.linac_id : (temp ? tmp('L') : nextId(list, 'linac_id', 'L', 2));
        }
        var c = {}; c[ent] = [cleanRow];
        return { success: true, changes: c, row: cleanRow };
      }
      case 'deleteMaster': {
        var e2 = d.entity, m2 = ENT_ID[e2];
        if (e2 === 'kq') return { success: true, changes: {}, removed: { kq: [d.id] } };
        var rw = (db[e2] || []).filter(function (x) { return x[m2[0]] === d.id; })[0];
        if (!rw) return fail('Data tidak ditemukan.');
        rw = clone(rw); rw.is_active = d.active === true;
        var c2 = {}; c2[e2] = [rw];
        return { success: true, changes: c2 };
      }
      case 'hardDelete': {
        var used = AppModel.usage(db, d.entity, d.id);
        if (used) return fail('Tidak bisa dihapus: sudah dipakai di ' + used + ' data/pengaturan. Gunakan Nonaktifkan agar riwayat tetap utuh.');
        if (d.entity === 'linac') return { success: true, changes: {}, removed: { energies: db.energies.filter(function (e) { return e.linac_id === d.id; }).map(function (e) { return e.energy_id; }) } };
        var rm = {}; rm[d.entity] = [d.id];
        return { success: true, changes: {}, removed: rm };
      }
      case 'saveKqBulk': {
        var model = String(d.chamber_model || '').trim(), bt = String(d.beam_type || '').toUpperCase();
        var pts = (d.rows || []).map(function (r) { return [Number(r[0]), Number(r[1])]; }).filter(function (r) { return isFinite(r[0]) && isFinite(r[1]) && r[1] > 0.5 && r[1] < 1.2; });
        if (!model || !pts.length) return fail('Data kQ tidak valid.');
        var rem = db.kq.filter(function (r) { return r.chamber_model.toLowerCase() === model.toLowerCase() && r.beam_type === bt; }).map(function (r) { return r.kq_id; });
        var n = db.kq.reduce(function (m, r) { var x = /^KQ(\d+)$/.exec(r.kq_id); return x ? Math.max(m, +x[1]) : m; }, 0);
        var added = pts.map(function (p) { return { kq_id: temp ? tmp('KQ') : 'KQ' + String(++n).padStart(3, '0'), chamber_model: model, beam_type: bt, quality_index_val: p[0], kq_value: p[1], source: d.source || 'Input manual' }; });
        return { success: true, changes: { kq: added }, removed: { kq: rem } };
      }
      case 'renameLinac': {
        var rows = db.energies.filter(function (x) { return x.linac_id === d.linac_id; }).map(clone);
        if (!rows.length) return fail('Pesawat tidak ditemukan.');
        rows.forEach(function (r) { ['linac_name', 'linac_model', 'serial_no', 'bunker'].forEach(function (k) { if (d[k] !== undefined) r[k] = d[k]; }); if (d.is_active !== undefined) r.is_active = d.is_active; });
        return { success: true, changes: { energies: rows } };
      }
      case 'saveConfig': {
        var v = d.values || {};
        if (v.WARNING_LIMIT !== undefined && +v.WARNING_LIMIT >= +(v.ACTION_LIMIT || 0)) return fail('Batas Warning harus lebih kecil dari Action Level.');
        return { success: true, changes: { config: Object.keys(v).map(function (k) { return { config_key: k, config_value: String(v[k]) }; }) } };
      }
      case 'changePassword':
        if (String(d.newPassword || '').length < 8) return fail('Password baru minimal 8 karakter.');
        return { success: true, message: 'Mode demo — password tidak disimpan.', token: 'demo', expiresAt: Date.now() + 30 * 864e5, user: d.newUsername || 'admin' };
      case 'testEmail': return { success: true, message: 'Mode demo — email tidak benar-benar dikirim.' };
      case 'emailPdf': return { success: true, message: 'Mode demo — email tidak benar-benar dikirim.' };
      default: return fail('Action ' + action + ' tidak tersedia di mode demo.');
    }
  }
  return { run: run, nowIso: nowIso, today: today };
})();

/* =====================================================================
 * API — panggilan ke GAS + antrean simpan optimistis
 * ===================================================================== */
var Api = (function () {
  var OPTIMISTIC = { hardDelete: 1, saveQC: 1, updateQC: 1, saveAdjustment: 1, saveMaster: 1, deleteMaster: 1, saveKqBulk: 1, renameLinac: 1, saveConfig: 1 };
  var queue = [], running = false, tempMap = {}, pendingFullSync = false, wake = null;
  function isDemo() { return !window.APP_CONFIG || !APP_CONFIG.GAS_URL || /XXXX/.test(APP_CONFIG.GAS_URL); }

  async function raw(action, data, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 45000) : null;
    try {
      var res = await fetch(APP_CONFIG.GAS_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, /* text/plain = tanpa CORS preflight */
        body: JSON.stringify({ action: action, token: Store.auth && Store.auth.token, data: data || {} }),
        signal: ctrl ? ctrl.signal : undefined
      });
      var json = await res.json();
      Store.online = true;
      if (json.code === 'AUTH') { App.onAuthExpired(); }
      return json;
    } catch (err) {
      Store.online = false;
      return { success: false, network: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Tidak dapat terhubung ke server (' + err.message + ').' };
    } finally { if (timer) clearTimeout(timer); }
  }

  /* LOGIN — balasan sudah memuat seluruh data (1 kali round-trip) */
  async function login(username, password, remember) {
    if (isDemo()) {
      if (!password) return { success: false, message: 'Mode demo: isi password apa saja.' };
      Store.demo = true;
      if (!Store.data) { Store.data = AppModel.buildSeed(); Store.data.today = LocalBackend.today(); Store.version = 1; Store.persist(); }
      Store.setAuth({ token: 'demo', user: username || 'admin', expiresAt: Date.now() + (remember ? 30 : 1) * 864e5, demo: true });
      return { success: true };
    }
    var r = await raw('login', { username: username, password: password, remember: remember });
    if (r.success) {
      Store.setAuth({ token: r.token, user: r.user, expiresAt: r.expiresAt });
      Store.data = r.data; Store.version = r.version; Store.lastSync = Date.now(); Store.persist();
    }
    return r;
  }

  /* SYNC latar — murah: server membalas "unchanged" bila versi sama */
  async function sync(force) {
    if (isDemo() || !Store.auth || Store.syncing) return;
    if (queue.length) { pendingFullSync = true; return; }
    Store.syncing = true; Store.emit('syncstate');
    var r = await raw('sync', { version: force ? -1 : Store.version }, 30000);
    Store.syncing = false;
    if (r.success) {
      Store.lastSync = Date.now();
      if (r.today && Store.data) Store.data.today = r.today;
      if (!r.unchanged && r.data) { Store.data = r.data; Store.version = r.version; Store.persist(); Store.emit('sync'); }
      else Store.emit('syncstate');
    } else Store.emit('syncstate');
    return r;
  }

  /* Ganti ID sementara dengan ID final di payload antrean */
  function mapTemp(obj) {
    var s = JSON.stringify(obj);
    Object.keys(tempMap).forEach(function (t) { s = s.split(t).join(tempMap[t]); });
    return JSON.parse(s);
  }

  /* MUTASI — optimistis: terapkan lokal, kembalikan hasil, kirim di latar */
  function mutate(action, data) {
    if (isDemo()) {
      var r = LocalBackend.run(action, data, Store.data, false);
      if (r.success) { Store.patch(r.changes, r.removed); Store.version++; Store.persist(); Store.emit('write'); }
      return Promise.resolve(r);
    }
    if (!OPTIMISTIC[action]) return raw(action, data);
    var local = LocalBackend.run(action, mapTemp(data), Store.data, true);
    if (!local.success) return Promise.resolve(local);
    /* simpan baris sebelum perubahan untuk rollback */
    var undo = snapshot(local);
    Store.patch(local.changes, local.removed); Store.persist(); Store.emit('write');
    var op = { id: Date.now() + Math.random(), action: action, data: data, local: local, undo: undo, tries: 0 };
    queue.push(op); persistQueue(); pump();
    local.optimistic = true;
    return Promise.resolve(local);
  }

  function snapshot(local) {
    var keys = { personnel: 'person_id', energies: 'energy_id', detectors: 'detector_id', kq: 'kq_id', transactions: 'qc_id' }, undo = {};
    Object.keys(local.changes || {}).concat(Object.keys(local.removed || {})).forEach(function (ent) {
      if (ent === 'config') { undo.config = Object.assign({}, Store.data.config); return; }
      var k = keys[ent]; if (!k) return;
      var ids = (local.changes[ent] || []).map(function (r) { return r[k]; }).concat((local.removed || {})[ent] || []);
      undo[ent] = { k: k, ids: ids, rows: (Store.data[ent] || []).filter(function (r) { return ids.indexOf(r[k]) >= 0; }).map(function (r) { return JSON.parse(JSON.stringify(r)); }) };
    });
    return undo;
  }
  function rollback(op) {
    Object.keys(op.undo).forEach(function (ent) {
      if (ent === 'config') { Store.data.config = op.undo.config; return; }
      var u = op.undo[ent];
      Store.data[ent] = (Store.data[ent] || []).filter(function (r) { return u.ids.indexOf(r[u.k]) < 0; }).concat(u.rows);
    });
  }
  function dropTemps(op) {
    Object.keys(op.local.changes || {}).forEach(function (ent) {
      var k = { personnel: 'person_id', energies: 'energy_id', detectors: 'detector_id', kq: 'kq_id', transactions: 'qc_id' }[ent];
      if (!k) return;
      Store.data[ent] = (Store.data[ent] || []).filter(function (r) { return String(r[k]).indexOf('TMP-') !== 0 || !(op.local.changes[ent] || []).some(function (x) { return x[k] === r[k]; }); });
    });
  }
  function persistQueue() { Store.writeQueue(queue.map(function (o) { return { action: o.action, data: o.data }; })); }

  async function pump() {
    if (running) return;
    running = true; Store.emit('syncstate');
    while (queue.length) {
      var op = queue[0];
      var res = await raw(op.action, mapTemp(op.data));
      if (res.network) {
        /* gangguan jaringan: JANGAN batalkan — tunggu & coba lagi (maks. jeda 30 dtk) */
        op.tries++; Store.emit('syncstate');
        await new Promise(function (r) { wake = r; setTimeout(r, Math.min(30000, 1500 * op.tries)); });
        wake = null; continue;
      }
      queue.shift(); persistQueue();
      if (res.success) {
        /* petakan ID sementara → ID final */
        var lr = op.local.record || op.local.row, sr = res.record || res.row;
        if (lr && sr) {
          ['qc_id', 'session_group_id', 'person_id', 'energy_id', 'detector_id', 'kq_id', 'linac_id'].forEach(function (k) {
            if (lr[k] && String(lr[k]).indexOf('TMP-') === 0 && sr[k]) tempMap[lr[k]] = sr[k];
          });
        }
        dropTemps(op);
        if (res.token) Store.setAuth({ token: res.token, user: res.user, expiresAt: res.expiresAt });
        Store.patch(res.changes, res.removed);
        if (res.prevVersion !== undefined && res.prevVersion !== Store.version) pendingFullSync = true;
        if (res.version) Store.version = res.version;
        Store.persist(); Store.emit('confirmed', { op: op, res: res });
      } else {
        rollback(op); Store.persist();
        Store.emit('rejected', { op: op, res: res });
      }
    }
    running = false; Store.emit('syncstate');
    if (pendingFullSync) { pendingFullSync = false; sync(true); }
  }

  /* Antrean tersisa dari sesi sebelumnya (tab ditutup sebelum terkirim) */
  function resumeQueue() {
    if (isDemo()) return;
    var q = Store.readQueue();
    if (!q.length) return;
    Store.writeQueue([]);
    /* buang baris sementara lama, jalankan ulang, lalu sinkron penuh */
    ['personnel', 'energies', 'detectors', 'kq', 'transactions'].forEach(function (ent) {
      Store.data[ent] = (Store.data[ent] || []).filter(function (r) { return !JSON.stringify(r).match(/"(qc_id|person_id|energy_id|detector_id|kq_id)":"TMP-/); });
    });
    pendingFullSync = true;
    q.forEach(function (o) { mutate(o.action, o.data); });
  }

  /* koneksi kembali → coba kirim antrean segera */
  window.addEventListener('online', function () { if (wake) wake(); });
  return { isDemo: isDemo, raw: raw, login: login, sync: sync, mutate: mutate, resumeQueue: resumeQueue, retryNow: function () { if (wake) wake(); },
    pending: function () { return queue.length; }, resolveId: function (id) { return tempMap[id] || id; } };
})();
