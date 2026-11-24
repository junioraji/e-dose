/* =====================================================================
 * e-Dose Agora — Control Chart SVG & Template Laporan Resmi
 * ---------------------------------------------------------------------
 * FILE BERSAMA: isi file ini IDENTIK dengan Laporan.gs di Apps Script.
 * Pratinjau A4 di browser dan PDF dari server memakai template yang sama.
 * ===================================================================== */
var ReportKit = (function () {
  'use strict';
  var N = TRS398.num, OK = TRS398.ok;
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function f(v, d) { return OK(N(v)) ? N(v).toFixed(d) : '—'; }
  function dev(v) { return TRS398.fmtDev(N(v)); }
  function dateLabel(iso, withTime) {
    if (!iso) return '—';
    var s = String(iso), y = s.slice(0, 4), m = +s.slice(5, 7), d = s.slice(8, 10);
    var out = d + ' ' + BULAN[m - 1] + ' ' + y;
    if (withTime && s.length >= 16) out += ' ' + s.slice(11, 16);
    return out;
  }
  function monthLabel(ym) { return BULAN_PANJANG[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
  function toTime(iso) { var s = String(iso); return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +(s.slice(11, 13) || 0), +(s.slice(14, 16) || 0)); }

  /* ------------------------------------------------------------------
   * CONTROL CHART — points: [{t:iso, af:{dev,output,status,id}, al:{...}|null, id}]
   * opts: {warn, action, baseline, mode:'dev'|'output', width, height, showAdj, compact}
   * ------------------------------------------------------------------ */
  function controlChartSVG(points, opts) {
    opts = opts || {};
    var W = opts.width || 920, H = opts.height || 290, compact = !!opts.compact;
    var padL = compact ? 46 : 62, padR = compact ? 14 : 112, padT = compact ? 12 : 22, padB = compact ? 22 : 30;
    var mode = opts.mode || 'dev', base = N(opts.baseline) || 1;
    var warn = N(opts.warn) || 1, action = N(opts.action) || 2, showAdj = opts.showAdj !== false;
    function val(p) { return mode === 'dev' ? N(p.dev) : N(p.output); }
    function limitVal(x) { return mode === 'dev' ? x : base * (1 + x / 100); }

    var pts = (points || []).filter(function (p) { return p.af || p.al; }).sort(function (a, b) { return toTime(a.t) - toTime(b.t); });
    var vals = [];
    pts.forEach(function (p) { if (p.af) vals.push(val(p.af)); if (p.al) vals.push(val(p.al)); });
    var lim = action + Math.max(0.5, action * 0.5);
    var maxAbs = Math.max(lim, vals.reduce(function (a, v) { return Math.max(a, Math.abs(mode === 'dev' ? v : (v - base) / base * 100)); }, 0) + 0.3);
    var yMin = limitVal(-maxAbs), yMax = limitVal(maxAbs);
    function Y(v) { return padT + (yMax - v) / (yMax - yMin) * (H - padT - padB); }

    var t0, t1;
    if (pts.length) { t0 = toTime(pts[0].t); t1 = toTime(pts[pts.length - 1].t); }
    else { t1 = Date.now(); t0 = t1 - 180 * 864e5; }
    if (opts.from) t0 = Math.min(t0, toTime(opts.from));
    if (opts.to) t1 = Math.max(t1, toTime(opts.to));
    if (t1 - t0 < 20 * 864e5) { t0 -= 10 * 864e5; t1 += 10 * 864e5; }
    var span = t1 - t0, x0 = padL + 18, x1 = W - padR - (compact ? 10 : 16);
    function X(t) { return x0 + (toTime(t) - t0) / span * (x1 - x0); }

    var fs = compact ? 9 : 11, s = [];
    s.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Control chart output" font-family="JetBrains Mono, Consolas, monospace">');

    function hline(v, color, dash, label, bold) {
      var y = Y(limitVal(v)).toFixed(1);
      s.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR + (compact ? 0 : 6)) + '" y2="' + y + '" stroke="' + color + '" stroke-width="' + (bold ? 1.5 : 1.2) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>');
      var txt = mode === 'dev' ? (v > 0 ? '+' : v < 0 ? '' : '') + v.toFixed(1) + '%' : limitVal(v).toFixed(3);
      s.push('<text x="' + (padL - 6) + '" y="' + (+y + 4) + '" text-anchor="end" font-size="' + fs + '" fill="' + color + '" font-weight="600">' + txt + '</text>');
      if (label && !compact) s.push('<text x="' + (W - padR + 10) + '" y="' + (+y + 3.5) + '" text-anchor="start" font-size="10" fill="' + color + '">' + label + '</text>');
    }
    hline(action, '#DC2626', '5 4', 'Action (+' + action.toFixed(1) + '%)');
    hline(warn, '#D97706', '4 4', 'Warning (+' + warn.toFixed(1) + '%)');
    hline(0, '#94A3B8', '', '', true);
    hline(-warn, '#D97706', '4 4', '');
    hline(-action, '#DC2626', '5 4', 'Action (−' + action.toFixed(1) + '%)');

    /* label bulan pada sumbu-x */
    var d = new Date(t0), cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), ticks = [];
    while (cur <= t1) { if (cur >= t0 - 1) ticks.push(cur); var dd = new Date(cur); cur = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth() + 1, 1); }
    var step = Math.max(1, Math.ceil(ticks.length / (compact ? 6 : 8)));
    ticks.forEach(function (tk, i) {
      if (i % step) return;
      var x = x0 + (tk - t0) / span * (x1 - x0), dt = new Date(tk);
      s.push('<line x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + (H - padB) + '" stroke="#F1F5F9"/>');
      s.push('<text x="' + x.toFixed(1) + '" y="' + (H - padB + (compact ? 14 : 18)) + '" text-anchor="middle" font-size="' + fs + '" fill="#475569" font-family="Plus Jakarta Sans, Arial, sans-serif">' + BULAN[dt.getUTCMonth()] + ' ' + String(dt.getUTCFullYear()).slice(2) + '</text>');
    });

    if (!pts.length) {
      s.push('<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" font-size="13" fill="#475569" font-family="Plus Jakarta Sans, Arial, sans-serif">Belum ada data pengukuran pada rentang ini</text></svg>');
      return s.join('');
    }

    /* garis tren klinis: nilai final tiap sesi (As-Left bila ada) */
    var line = pts.map(function (p) { var q = p.al || p.af; return X(p.t).toFixed(1) + ',' + Y(val(q)).toFixed(1); });
    var zeroY = Y(limitVal(0)).toFixed(1);
    s.push('<path d="M' + line[0].split(',')[0] + ' ' + zeroY + ' L' + line.join(' L') + ' L' + line[line.length - 1].split(',')[0] + ' ' + zeroY + ' Z" fill="#0072CE" fill-opacity="0.07"/>');
    s.push('<polyline fill="none" stroke="#0072CE" stroke-width="' + (compact ? 2 : 2.5) + '" stroke-linecap="round" stroke-linejoin="round" points="' + line.join(' ') + '"/>');

    var r = compact ? 3.5 : 4.5, lastAdj = null;
    pts.forEach(function (p) { if (p.al && showAdj) lastAdj = p; });
    pts.forEach(function (p) {
      var x = X(p.t);
      if (p.al && showAdj) {
        var ya = Y(val(p.af)), yl = Y(val(p.al));
        s.push('<line x1="' + x.toFixed(1) + '" y1="' + ya.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + yl.toFixed(1) + '" stroke="#1B365D" stroke-width="1.6" stroke-dasharray="3 3"/>');
        var ym = (ya + yl) / 2;
        s.push('<rect x="' + (x - 17).toFixed(1) + '" y="' + (ym - 8).toFixed(1) + '" width="34" height="16" rx="8" fill="#1B365D"/>');
        s.push('<text x="' + x.toFixed(1) + '" y="' + (ym + 3.5).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#FFFFFF">ADJ</text>');
        s.push('<circle class="cc-pt" data-id="' + esc(p.id) + '" data-kind="AF" cx="' + x.toFixed(1) + '" cy="' + ya.toFixed(1) + '" r="' + (r + 1.5) + '" fill="#FFFFFF" stroke="#DC2626" stroke-width="3"><title>As-Found ' + dateLabel(p.t) + ': ' + dev(p.af.dev) + ' (' + f(p.af.output, 3) + ' cGy/MU)</title></circle>');
        s.push('<circle class="cc-pt" data-id="' + esc(p.id) + '" data-kind="AL" cx="' + x.toFixed(1) + '" cy="' + yl.toFixed(1) + '" r="' + (r + 1.5) + '" fill="#2E9E5B" stroke="#FFFFFF" stroke-width="2"><title>As-Left ' + dateLabel(p.t) + ': ' + dev(p.al.dev) + ' (' + f(p.al.output, 3) + ' cGy/MU)</title></circle>');
        if (p === lastAdj && !compact) {
          var lx = x > (W - padR) * 0.6 ? x - 140 : x + 14;
          s.push('<rect x="' + lx.toFixed(1) + '" y="' + (ya - 13).toFixed(1) + '" width="126" height="24" rx="6" fill="#FFFFFF" stroke="#FCA5A5"/>');
          s.push('<text x="' + (lx + 63).toFixed(1) + '" y="' + (ya + 3).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#991B1B">As-Found ' + dev(p.af.dev) + '</text>');
          s.push('<rect x="' + lx.toFixed(1) + '" y="' + (yl - 11).toFixed(1) + '" width="126" height="24" rx="6" fill="#FFFFFF" stroke="#86EFAC"/>');
          s.push('<text x="' + (lx + 63).toFixed(1) + '" y="' + (yl + 5).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#166534">As-Left ' + dev(p.al.dev) + '</text>');
        }
      } else {
        var q = p.al || p.af, y = Y(val(q));
        var color = q.status === 'FAIL' ? '#DC2626' : q.status === 'WARNING' ? '#D97706' : '#0072CE';
        s.push('<circle class="cc-pt" data-id="' + esc(p.id) + '" data-kind="' + (p.al ? 'AL' : 'AF') + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="#FFFFFF" stroke="' + color + '" stroke-width="2.5"><title>' + dateLabel(p.t) + ': ' + dev(q.dev) + ' (' + f(q.output, 3) + ' cGy/MU) ' + esc(q.status) + '</title></circle>');
      }
    });
    s.push('</svg>');
    return s.join('');
  }

  /* Titik chart dari sesi */
  function chartPoints(sessions) {
    return sessions.filter(function (s) { return s.asFound; }).map(function (s) {
      var al = s.adjustments.length ? s.adjustments[s.adjustments.length - 1] : null;
      return { id: s.id, t: s.asFound.qc_datetime,
        af: { dev: s.asFound.deviation_pct, output: s.asFound.output_cgy_mu, status: s.asFound.status },
        al: al ? { dev: al.deviation_pct, output: al.output_cgy_mu, status: al.status } : null };
    });
  }

  /* ------------------------------------------------------------------
   * KONTEKS LAPORAN dari data — params:
   *  {type:'session', sessionId} | {type:'monthly', linacId, month:'YYYY-MM'}
   *  options: {chart, adjustment, signature, worksheet}
   * ------------------------------------------------------------------ */
  function buildContext(db, params) {
    var E = AppModel.idx(db.energies, 'energy_id'), D = AppModel.idx(db.detectors, 'detector_id'), P = AppModel.idx(db.personnel, 'person_id');
    var all = AppModel.groupSessions(db.transactions), sessions, linacId, title, period, docId;
    if (params.type === 'session') {
      sessions = all.filter(function (s) { return s.id === params.sessionId; });
      if (!sessions.length) return { error: 'Sesi ' + params.sessionId + ' tidak ditemukan.' };
      linacId = (E[sessions[0].energy_id] || {}).linac_id;
      title = 'Laporan Hasil Quality Control Dosimetri Absolut Linac';
      period = dateLabel(sessions[0].datetime);
      docId = sessions[0].id;
    } else {
      linacId = params.linacId;
      sessions = all.filter(function (s) { return (E[s.energy_id] || {}).linac_id === linacId && String(s.datetime).slice(0, 7) === params.month; });
      title = 'Rekapitulasi Bulanan QC Dosimetri Absolut Linac';
      period = monthLabel(params.month);
      docId = 'REKAP-' + linacId + '-' + params.month;
    }
    sessions = sessions.slice().sort(function (a, b) {
      return AppModel.energyOrder(E[a.energy_id] || {}, E[b.energy_id] || {}) || (a.datetime < b.datetime ? -1 : 1);
    });
    var linac = db.energies.filter(function (e) { return e.linac_id === linacId; })[0] || {};
    var instr = {}, fis = {};
    sessions.forEach(function (s) {
      s.records.forEach(function (r) {
        [r.chamber_id, r.electrometer_id].forEach(function (id) { if (D[id]) instr[id] = D[id]; });
        if (P[r.fismed_id]) fis[r.fismed_id] = P[r.fismed_id];
      });
    });
    var lim = TRS398.limitsFor(db.config, 'PHOTON'), limE = TRS398.limitsFor(db.config, 'ELECTRON');
    var rows = sessions.map(function (s) {
      var en = E[s.energy_id] || {}, af = s.asFound || {}, al = s.adjustments.length ? s.adjustments[s.adjustments.length - 1] : null;
      return { id: s.id, energy: en.energy_label + ' ' + (en.beam_type === 'ELECTRON' ? 'Electron' : 'Photon'), date: af.qc_datetime,
        afOut: af.output_cgy_mu, afDev: af.deviation_pct, afStatus: af.status, alStatus: al ? al.status : '', action: al ? (al.adj_category || 'Adjustment') + ' (' + s.adjustments.length + 'x)' : '—',
        alOut: al ? al.output_cgy_mu : null, alDev: al ? al.deviation_pct : null, status: s.status };
    });
    var adjustments = [];
    sessions.forEach(function (s) {
      var en = E[s.energy_id] || {};
      s.adjustments.forEach(function (a) { adjustments.push({ energy: en.energy_label, session: s.id, rec: a }); });
    });
    var worksheets = [];
    sessions.forEach(function (s) {
      var en = E[s.energy_id] || {};
      s.records.slice().sort(function (a, b) { return N(a.iteration_no) - N(b.iteration_no); }).forEach(function (r) {
        worksheets.push({ energy: en.energy_label + ' ' + (en.beam_type === 'ELECTRON' ? 'Electron' : 'Photon'), en: en, rec: r, chamber: D[r.chamber_id] || {}, elec: D[r.electrometer_id] || {} });
      });
    });
    /* tren 6 bulan untuk energi utama (sesi laporan / energi pertama) */
    var trendEnergy = params.chartEnergyId || (sessions[0] || {}).energy_id;
    var endT = sessions.length ? sessions[sessions.length - 1].datetime : '';
    var lastT = sessions.reduce(function (m, s) { return s.datetime > m ? s.datetime : m; }, '');
    var fromIso = lastT ? new Date(toTime(lastT) - 183 * 864e5).toISOString().slice(0, 10) : '';
    var trend = all.filter(function (s) { return s.energy_id === trendEnergy && s.datetime <= lastT && s.datetime >= fromIso; });
    var ten = E[trendEnergy] || {};
    var tl = TRS398.limitsFor(db.config, ten.beam_type);
    return {
      type: params.type, title: title, docId: docId, period: period, linac: linac,
      hospital: { name: db.config.HOSPITAL_NAME, unit: db.config.HOSPITAL_UNIT, address: db.config.HOSPITAL_ADDRESS, logo: db.config.HOSPITAL_LOGO },
      instruments: Object.keys(instr).map(function (k) { return instr[k]; }),
      limits: { photon: lim, electron: limE, separate: String(db.config.SEPARATE_LIMITS) === 'true' },
      rows: rows, adjustments: adjustments, worksheets: worksheets, sessions: sessions,
      fismed: Object.keys(fis).map(function (k) { return fis[k]; }),
      kadep: P[db.config.KADEP_ID] || db.personnel.filter(function (p) { return p.role === 'KADEP'; })[0] || {},
      trend: { energy: ten.energy_label ? ten.energy_label + ' ' + (ten.beam_type === 'ELECTRON' ? 'Electron' : 'Photon') : '', points: chartPoints(trend), warn: tl.warn, action: tl.action, baseline: ten.baseline_cgy_mu },
      endT: endT
    };
  }

  var CSS = '.rp{font-family:"Plus Jakarta Sans",Arial,Helvetica,sans-serif;color:#0F172A;font-size:11px;line-height:1.45}' +
    '.rp .mono{font-family:"JetBrains Mono",Consolas,"Courier New",monospace}' +
    '.rp table{width:100%;border-collapse:collapse}' +
    '.rp th{background:#F8FAFC;color:#475569;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;text-align:left;padding:5px 6px;border:1px solid #E2E8F0}' +
    '.rp td{padding:5px 6px;border:1px solid #E2E8F0;vertical-align:top}' +
    '.rp .r{text-align:right}.rp .c{text-align:center}' +
    '.rp h1{font-size:14px;color:#1B365D;text-transform:uppercase;text-align:center;margin:12px 0 10px;letter-spacing:.3px}' +
    '.rp h2{font-size:11.5px;color:#1B365D;margin:14px 0 6px;padding-bottom:3px;border-bottom:1px solid #E2E8F0}' +
    '.rp .kop{border-bottom:2.5px solid #1B365D;padding-bottom:10px}' +
    '.rp .meta td{border:none;padding:2px 8px 2px 0;font-size:10.5px}.rp .meta .k{color:#475569;width:120px}' +
    '.rp .pass{color:#166534;font-weight:700}.rp .cleared{color:#065F46;font-weight:700}.rp .warning{color:#92400E;font-weight:700}.rp .fail{color:#991B1B;font-weight:700}' +
    '.rp .box{border:1px solid #BAE6FD;background:#F0F9FF;padding:8px 10px;margin-bottom:6px}' +
    '.rp .sign td{border:none;text-align:center;width:50%;padding-top:4px}' +
    '.rp .muted{color:#475569}.rp .small{font-size:9.5px}.rp .pb{page-break-before:always}';

  /* ------------------------------------------------------------------
   * HTML LAPORAN — opts: {chart, adjustment, signature, worksheet, chartImg, noSvg}
   * chartImg (data URI PNG) dipakai server karena konverter PDF GAS
   * tidak merender SVG inline.
   * ------------------------------------------------------------------ */
  function reportHTML(ctx, opts) {
    opts = opts || {};
    if (ctx.error) return '<div class="rp"><p>' + esc(ctx.error) + '</p></div>';
    var h = [], L = ctx.linac, H = ctx.hospital;
    h.push('<style>' + CSS + '</style><div class="rp">');
    h.push('<table class="kop"><tr><td style="border:none;width:62px;padding:0">' +
      (H.logo ? '<img src="' + esc(H.logo) + '" style="max-width:56px;max-height:56px">' : opts.noSvg ? '' :
        '<svg width="48" height="48" viewBox="0 0 32 32"><rect x="13" y="4" width="6" height="24" rx="2" fill="#1B365D"/><rect x="4" y="13" width="24" height="6" rx="2" fill="#0072CE"/><circle cx="16" cy="16" r="3.5" fill="#2E9E5B"/></svg>') +
      '</td><td style="border:none;padding:0 8px"><div style="font-size:13px;font-weight:700;color:#1B365D">' + esc(String(H.name || '').toUpperCase()) + '</div>' +
      '<div style="font-weight:600;color:#1B365D">' + esc(H.unit) + '</div><div class="muted">' + esc(H.address) + '</div>' +
      '<div class="mono muted small">Protokol Acuan: IAEA TRS-398 Rev. 1 (2024)</div></td>' +
      '<td style="border:none;text-align:right;padding:0;white-space:nowrap"><div style="color:#0072CE;font-size:9.5px;font-weight:700;text-transform:uppercase">Dokumen Resmi QC</div>' +
      '<div class="mono" style="font-weight:700;color:#1B365D;font-size:12px">' + esc(ctx.docId) + '</div></td></tr></table>');
    h.push('<h1>' + esc(ctx.title) + '</h1>');

    var limTxt = '±' + ctx.limits.photon.warn.toFixed(1) + '% (Warning) / ±' + ctx.limits.photon.action.toFixed(1) + '% (Action)';
    if (ctx.limits.separate) limTxt = 'Foton ' + limTxt + '; Elektron ±' + ctx.limits.electron.warn.toFixed(1) + '% / ±' + ctx.limits.electron.action.toFixed(1) + '%';
    h.push('<table class="meta"><tr><td class="k">Pesawat Linac</td><td><b>' + esc(L.linac_name) + '</b> — ' + esc(L.linac_model) + '</td><td class="k">Periode / Tanggal</td><td class="mono">' + esc(ctx.period) + '</td></tr>' +
      '<tr><td class="k">Nomor Seri</td><td class="mono">' + esc(L.serial_no) + ' · ' + esc(L.bunker) + '</td><td class="k">Batas Toleransi</td><td class="mono">' + esc(limTxt) + '</td></tr></table>');

    h.push('<h2>Alat Ukur</h2><table><tr><th>Kategori</th><th>Model</th><th>No. Seri</th><th class="r">Faktor Kalibrasi</th><th>Lembaga / Sertifikat</th><th>Berlaku s.d.</th></tr>');
    ctx.instruments.forEach(function (d) {
      h.push('<tr><td>' + (d.category === 'CHAMBER' ? 'Ion Chamber' : 'Electrometer') + '</td><td>' + esc(d.model_name) + '</td><td class="mono">' + esc(d.serial_no) + '</td>' +
        '<td class="r mono">' + (d.category === 'CHAMBER' ? 'N<sub>D,w</sub> ' + f(d.cal_factor, 3) + ' ' + esc(d.unit) : 'k<sub>elec</sub> ' + f(d.cal_factor, 4)) + '</td>' +
        '<td>' + esc(d.cal_lab) + ' · ' + esc(d.cert_no) + '</td><td class="mono">' + dateLabel(d.expiry_date) + '</td></tr>');
    });
    if (!ctx.instruments.length) h.push('<tr><td colspan="6" class="muted">—</td></tr>');
    h.push('</table>');

    h.push('<h2>Ringkasan Hasil (As-Found vs As-Left)</h2><table><tr><th>Energi</th><th>Tanggal</th><th class="r">As-Found (cGy/MU)</th><th class="r">Dev. Awal</th><th>Tindakan Adjustment</th><th class="r">As-Left (cGy/MU)</th><th class="r">Dev. Akhir</th><th>Status Final</th></tr>');
    ctx.rows.forEach(function (r) {
      var m = TRS398.STATUS_META[r.status] || { label: r.status, cls: '' };
      h.push('<tr><td><b>' + esc(r.energy) + '</b><div class="mono muted small">' + esc(r.id) + '</div></td><td class="mono">' + dateLabel(r.date, true) + '</td>' +
        '<td class="r mono">' + f(r.afOut, 3) + '</td><td class="r mono ' + ((TRS398.STATUS_META[r.afStatus] || {}).cls || '') + '">' + dev(r.afDev) + '</td><td>' + esc(r.action) + '</td>' +
        '<td class="r mono">' + (r.alOut === null ? '—' : f(r.alOut, 3)) + '</td><td class="r mono ' + (r.alStatus === 'PASS' ? 'cleared' : ((TRS398.STATUS_META[r.alStatus] || {}).cls || '')) + '">' + (r.alDev === null ? '—' : dev(r.alDev)) + '</td>' +
        '<td class="' + m.cls + '">' + esc(m.label) + '</td></tr>');
    });
    if (!ctx.rows.length) h.push('<tr><td colspan="8" class="muted c">Tidak ada pengukuran pada periode ini.</td></tr>');
    h.push('</table>');

    if (opts.chart !== false && ctx.trend.points.length && (opts.chartImg || !opts.noSvg)) {
      h.push('<h2>Tren Output 6 Bulan Terakhir — ' + esc(ctx.trend.energy) + '</h2><div style="border:1px solid #E2E8F0;padding:6px">');
      h.push(opts.chartImg ? '<img src="' + opts.chartImg + '" style="width:100%">' :
        controlChartSVG(ctx.trend.points, { warn: ctx.trend.warn, action: ctx.trend.action, width: 680, height: 170, compact: true }));
      h.push('<div class="small muted" style="margin-top:3px">○ merah = As-Found · ● hijau = As-Left · garis putus kuning/merah = batas Warning/Action</div></div>');
    }

    if (opts.adjustment !== false && ctx.adjustments.length) {
      h.push('<h2>Lampiran Detail Pengukuran Adjustment (CAPA)</h2>');
      ctx.adjustments.forEach(function (a) {
        var r = a.rec, m = TRS398.STATUS_META[r.status] || {};
        h.push('<div class="box"><b>' + esc(a.energy) + ' — Adjustment #' + esc(r.iteration_no) + '</b> <span class="mono muted">(' + esc(r.qc_id) + ')</span><br>' +
          '<b>Tindakan</b> (' + dateLabel(r.adj_datetime || r.qc_datetime, true) + '): ' + esc(r.adj_category) + ' — ' + esc(r.adj_action_desc) + '<br>' +
          '<b>Pelaksana:</b> ' + esc(r.adj_performer) + (r.adj_ticket ? ' · <b>Tiket:</b> <span class="mono">' + esc(r.adj_ticket) + '</span>' : '') + '<br>' +
          '<span class="mono">T = ' + f(r.temp_c, 1) + ' °C · P = ' + f(r.press_kpa, 2) + ' kPa · k_TP = ' + f(r.k_tp, 4) + ' · M_raw = [' + (r.m_raw_list || []).map(function (x) { return f(x, 3); }).join(', ') + '] nC · Mean = ' + f(r.m_raw_avg, 3) + ' nC · Output = ' + f(r.output_cgy_mu, 3) + ' cGy/MU · Deviasi = ' + dev(r.deviation_pct) + '</span> ' +
          '<span class="' + (m.cls || '') + '">' + esc(m.label || r.status) + '</span></div>');
      });
    }

    if (opts.worksheet) {
      h.push('<h2 class="pb">Lembar Kerja Kalkulasi IAEA TRS-398</h2>');
      ctx.worksheets.forEach(function (w) {
        var r = w.rec;
        h.push('<table style="margin-bottom:8px"><tr><th colspan="4">' + esc(w.energy) + ' — ' + (r.record_type === 'AS_FOUND' ? 'As-Found' : 'Adjustment #' + r.iteration_no) + ' · <span class="mono">' + esc(r.qc_id) + '</span> · ' + dateLabel(r.qc_datetime, true) + '</th></tr>' +
          '<tr><td>Setup / z_ref</td><td class="mono">' + esc(r.setup_type) + ' ' + f(w.en.ssd_sad_cm, 0) + ' cm · z_ref ' + f(w.en.z_ref_cm, 2) + ' cm</td><td>Kualitas berkas</td><td class="mono">' + (w.en.beam_type === 'ELECTRON' ? 'R50 = ' + f(r.quality_index, 2) + ' cm' : 'TPR20,10 = ' + f(r.quality_index, 3)) + '</td></tr>' +
          '<tr><td>Suhu / Tekanan</td><td class="mono">' + f(r.temp_c, 1) + ' °C / ' + f(r.press_kpa, 2) + ' kPa</td><td>MU</td><td class="mono">' + f(r.mu_set, 0) + '</td></tr>' +
          '<tr><td>Bacaan M_raw (nC)</td><td class="mono" colspan="3">' + (r.m_raw_list || []).map(function (x) { return f(x, 3); }).join(' · ') + ' → rata-rata ' + f(r.m_raw_avg, 4) + '</td></tr>' +
          '<tr><td>k_TP</td><td class="mono">' + f(r.k_tp, 4) + '</td><td>k_elec</td><td class="mono">' + f(r.k_elec, 4) + '</td></tr>' +
          '<tr><td>k_pol (' + (r.kpol_mode === 'measured' ? 'diukur' : 'tersimpan') + ')</td><td class="mono">' + f(r.k_pol, 4) + '</td><td>k_s (' + (r.ks_mode === 'measured' ? 'dua tegangan' : 'tersimpan') + ')</td><td class="mono">' + f(r.k_s, 4) + '</td></tr>' +
          (TRS398.ok(N(r.k_vol)) && Math.abs(N(r.k_vol) - 1) > 1e-9 ? '<tr><td>k_vol (FFF, ' + (r.kvol_mode === 'manual' ? 'profil terukur' : 'Pers. 22') + ')</td><td class="mono" colspan="3">' + f(r.k_vol, 4) + '</td></tr>' : '') +
          '<tr><td>M_Q (nC)</td><td class="mono">' + f(r.m_q, 4) + '</td><td>N_D,w,Q0 · k_Q,Q0</td><td class="mono">' + f(r.n_dw, 4) + ' cGy/nC · ' + f(r.k_q, 4) + '</td></tr>' +
          '<tr><td>D_w,Q(z_ref)</td><td class="mono">' + f(r.dw_zref, 3) + ' cGy</td><td>' + (r.setup_type === 'SAD' ? 'TMR(z_ref)' : 'PDD(z_ref)') + '</td><td class="mono">' + (r.setup_type === 'SAD' ? f(r.tmr_used, 4) : f(r.pdd_used, 2) + '%') + '</td></tr>' +
          '<tr><td>D_w,Q(z_max)</td><td class="mono">' + f(r.dw_zmax, 3) + ' cGy</td><td>Output / Baseline</td><td class="mono"><b>' + f(r.output_cgy_mu, 4) + '</b> / ' + f(r.baseline_used, 3) + ' cGy/MU</td></tr>' +
          '<tr><td>Deviasi</td><td class="mono"><b>' + dev(r.deviation_pct) + '</b></td><td>Status (batas ±' + f(r.warning_limit_used, 1) + '/±' + f(r.action_limit_used, 1) + '%)</td><td class="' + ((TRS398.STATUS_META[r.status] || {}).cls || '') + '">' + esc(r.status) + '</td></tr>' +
          (r.notes ? '<tr><td>Catatan</td><td colspan="3">' + esc(r.notes) + '</td></tr>' : '') + '</table>');
      });
    }

    if (opts.signature !== false) {
      var fm = ctx.fismed[0] || {};
      h.push('<table class="sign" style="margin-top:22px"><tr><td>Fisikawan Medis Pelaksana,</td><td>Mengetahui,<br>' + esc(ctx.kadep.position || 'Kepala Instalasi Radioterapi') + '</td></tr>' +
        '<tr><td style="height:58px"></td><td></td></tr>' +
        '<tr><td><b style="color:#1B365D;text-decoration:underline">' + esc(fm.full_name || '................................') + '</b><div class="mono muted small">' + esc(fm.nip_str || '') + '</div>' +
        (ctx.fismed.length > 1 ? '<div class="small muted">Turut melaksanakan: ' + ctx.fismed.slice(1).map(function (p) { return esc(p.full_name); }).join(', ') + '</div>' : '') + '</td>' +
        '<td><b style="color:#1B365D;text-decoration:underline">' + esc(ctx.kadep.full_name || '................................') + '</b><div class="mono muted small">' + esc(ctx.kadep.nip_str || '') + '</div></td></tr></table>');
    }
    h.push('<div class="small muted" style="margin-top:14px;border-top:1px solid #E2E8F0;padding-top:4px">Dokumen dibuat otomatis oleh e-Dose Agora · ' + esc(ctx.docId) + '</div></div>');
    return h.join('');
  }

  return { esc: esc, dateLabel: dateLabel, monthLabel: monthLabel, controlChartSVG: controlChartSVG, chartPoints: chartPoints,
    buildContext: buildContext, reportHTML: reportHTML, CSS: CSS, BULAN: BULAN, BULAN_PANJANG: BULAN_PANJANG };
})();
