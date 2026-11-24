/* =====================================================================
 * W-06 · Report Center & Pratinjau PDF Resmi (A4)
 * Pratinjau dirender instan di browser dengan template yang SAMA dengan
 * PDF server (Laporan.gs). "Cetak Langsung" tanpa server sama sekali.
 * ===================================================================== */
(function () {
  var esc = UI.esc;
  var R = { type: 'session', sessionId: '', linacId: '', month: '', chart: true, adjustment: true, signature: true, worksheet: false };

  function params() {
    return R.type === 'session' ? { type: 'session', sessionId: R.sessionId } : { type: 'monthly', linacId: R.linacId, month: R.month };
  }
  function opts() { return { chart: R.chart, adjustment: R.adjustment, signature: R.signature, worksheet: R.worksheet }; }
  function months() {
    var m = {};
    Data.sessions().forEach(function (s) { if ((Data.E()[s.energy_id] || {}).linac_id === R.linacId) m[String(s.datetime).slice(0, 7)] = 1; });
    return Object.keys(m).sort().reverse();
  }

  function ensure(p) {
    if (p[0] === 'monthly') { R.type = 'monthly'; R.linacId = p[1] || R.linacId; R.month = p[2] || R.month; }
    else if (p[0]) { R.type = 'session'; R.sessionId = Api.resolveId(p[0]); }
    var ss = Data.sessions().filter(function (s) { return !Data.isTemp(s.id); });
    if (!R.sessionId || !Data.session(R.sessionId)) R.sessionId = (ss[0] || {}).id || '';
    if (!R.linacId) { var s0 = Data.session(R.sessionId); R.linacId = s0 ? (Data.E()[s0.energy_id] || {}).linac_id : (Data.linacs()[0] || {}).linac_id; }
    var ms = months();
    if (!R.month || (ms.length && ms.indexOf(R.month) < 0 && p[0] !== 'monthly')) R.month = ms[0] || Data.today().slice(0, 7);
  }

  function cfgPanel() {
    var ss = Data.sessions().filter(function (s) { return !Data.isTemp(s.id); }).slice(0, 80), E = Data.E();
    var ms = months(); if (ms.indexOf(R.month) < 0) ms.unshift(R.month);
    return '<section class="report-cfg"><div class="sec"><h2 class="h-sm mb">Jenis Laporan</h2><div class="stack-sm">' +
      '<label class="radio-card ' + (R.type === 'session' ? 'on' : '') + '"><input type="radio" name="rtype" value="session"' + (R.type === 'session' ? ' checked' : '') + '><div><div class="label" style="color:var(--primary)">Laporan Per Sesi QC</div><div class="small muted">Lembar kerja TRS-398 + lampiran As-Found &amp; As-Left.</div></div></label>' +
      '<label class="radio-card ' + (R.type === 'monthly' ? 'on' : '') + '"><input type="radio" name="rtype" value="monthly"' + (R.type === 'monthly' ? ' checked' : '') + '><div><div class="label" style="color:var(--primary)">Laporan Rekap Bulanan per Pesawat</div><div class="small muted">Ringkasan seluruh energi aktif dalam satu bulan kalender.</div></div></label></div></div>' +
      '<div class="sec stack-sm">' + (R.type === 'session'
        ? '<label class="field"><span>Sesi QC</span><select id="r-session">' + UI.options(ss, 'id', function (s) { var e = E[s.energy_id] || {}; return s.id + ' · ' + e.linac_name + ' ' + e.energy_label + ' · ' + UI.date(s.datetime) + ' · ' + (TRS398.STATUS_META[s.status] || {}).label; }, R.sessionId) + '</select></label>'
        : '<label class="field"><span>Pesawat Linac</span><select id="r-linac">' + UI.options(Data.linacs(true), 'linac_id', function (l) { return l.linac_name + ' (' + l.serial_no + ')'; }, R.linacId) + '</select></label>' +
          '<label class="field"><span>Bulan &amp; Tahun</span><select id="r-month">' + UI.options(ms, function (m) { return m; }, ReportKit.monthLabel, R.month) + '</select></label>') + '</div>' +
      '<div class="sec stack-sm"><h3 class="label">Opsi Konten Dokumen</h3>' +
      [['chart', 'Sertakan Grafik Control Chart'], ['adjustment', 'Sertakan Lampiran Adjustment / CAPA'], ['worksheet', 'Sertakan Lembar Kerja Kalkulasi TRS-398'], ['signature', 'Sertakan Blok Pengesahan Tanda Tangan']].map(function (o) {
        return '<label class="check"><input type="checkbox" data-opt="' + o[0] + '"' + (R[o[0]] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
      }).join('') + '</div>' +
      '<div class="sec stack-sm"><button class="btn btn-primary btn-block" id="r-dl">' + UI.icon('download', '', 1.75) + 'Unduh Laporan PDF</button>' +
      '<button class="btn btn-outline btn-block" id="r-print">' + UI.icon('printer', '', 1.75) + 'Cetak Langsung</button>' +
      '<button class="btn btn-outline-navy btn-block" id="r-mail">' + UI.icon('mail', '', 1.75) + 'Kirim PDF via Email</button>' +
      '<p class="small muted" style="margin:4px 0 0">PDF resmi dibuat oleh server Apps Script dari data tersimpan. "Cetak Langsung" memakai pratinjau ini (pilih <i>Save as PDF</i> di dialog cetak).</p></div></section>';
  }

  function preview() {
    var ctx = ReportKit.buildContext(Store.data, params());
    return '<section class="viewer"><article class="a4" id="print-area">' + ReportKit.reportHTML(ctx, opts()) + '</article></section>';
  }

  async function chartImg() {
    var ctx = ReportKit.buildContext(Store.data, params());
    if (!R.chart || ctx.error || !ctx.trend.points.length) return '';
    var svg = ReportKit.controlChartSVG(ctx.trend.points, { warn: ctx.trend.warn, action: ctx.trend.action, width: 680, height: 170, compact: true });
    return UI.svgToPng(svg, 1360, 340);
  }

  async function download(btn) {
    var ctx = ReportKit.buildContext(Store.data, params());
    if (ctx.error) return UI.toast(esc(ctx.error), 'error');
    if (Api.isDemo()) { UI.toast('Mode demo: PDF server tidak tersedia — gunakan dialog cetak lalu pilih "Save as PDF".', 'info'); return window.print(); }
    UI.busy(btn, true, 'Membuat PDF...');
    var img = await chartImg();
    var r = await Api.raw('generatePdf', { params: params(), options: opts(), chartImg: img }, 90000);
    UI.busy(btn, false);
    if (!r.success) return UI.toast(esc(r.message || 'Gagal membuat PDF.'), 'error');
    UI.downloadBase64(r.base64, r.filename);
    UI.toast('PDF ' + esc(r.filename) + ' diunduh.', 'success');
  }

  function email() {
    UI.modal({
      title: 'Kirim Laporan PDF via Email', size: 'sm',
      body: '<label class="field"><span>Alamat penerima (pisahkan dengan koma)</span><input id="m-to" type="text" value="' + esc(Data.cfg().ALERT_EMAILS || '') + '" placeholder="fismed@rs.co.id, kadep@rs.co.id"></label>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="m-send">' + UI.icon('mail') + 'Kirim</button>',
      onMount: function (el, close) {
        el.querySelector('#m-send').onclick = async function () {
          var to = el.querySelector('#m-to').value.trim();
          if (!to) return el.querySelector('#m-to').classList.add('invalid');
          UI.busy(this, true, 'Mengirim...');
          var img = await chartImg();
          var r = Api.isDemo() ? await Api.mutate('emailPdf', {}) : await Api.raw('emailPdf', { params: params(), options: opts(), chartImg: img, recipients: to }, 90000);
          UI.busy(this, false);
          if (!r.success) return UI.toast(esc(r.message), 'error');
          close(); UI.toast(esc(r.message), 'success');
        };
      }
    });
  }

  function refreshPreview(el) { el.querySelector('.viewer').outerHTML = preview(); }

  Pages.laporan = {
    title: 'Report Center & Pratinjau PDF Resmi (A4)', live: true,
    actions: function () { return '<span class="badge b-pass" style="padding:6px 12px">' + UI.icon('shield', 'ic-xs', 2) + 'Audit-Ready BAPETEN Format</span>'; },
    render: function (p) {
      ensure(p);
      if (!Data.sessions().length) return '<div class="card empty">' + UI.icon('file') + '<div>Belum ada data pengukuran untuk dilaporkan.</div></div>';
      return '<div class="report-split">' + cfgPanel() + preview() + '</div>';
    },
    mount: function (el) {
      var q = function (s) { return el.querySelector(s); };
      if (!q('.report-split')) return;
      el.querySelectorAll('[name=rtype]').forEach(function (r) {
        r.onchange = function () {
          R.type = this.value;
          var s = Data.session(R.sessionId);
          if (R.type === 'monthly' && s) { R.linacId = (Data.E()[s.energy_id] || {}).linac_id; R.month = String(s.datetime).slice(0, 7); }
          history.replaceState(null, '', R.type === 'session' ? '#/laporan/' + encodeURIComponent(R.sessionId) : '#/laporan/monthly/' + encodeURIComponent(R.linacId) + '/' + R.month);
          App.render({ keepScroll: true });
        };
      });
      if (q('#r-session')) q('#r-session').onchange = function () { R.sessionId = this.value; history.replaceState(null, '', '#/laporan/' + encodeURIComponent(R.sessionId)); refreshPreview(el); };
      if (q('#r-linac')) q('#r-linac').onchange = function () { R.linacId = this.value; R.month = months()[0] || R.month; history.replaceState(null, '', '#/laporan/monthly/' + encodeURIComponent(R.linacId) + '/' + R.month); App.render({ keepScroll: true }); };
      if (q('#r-month')) q('#r-month').onchange = function () { R.month = this.value; history.replaceState(null, '', '#/laporan/monthly/' + encodeURIComponent(R.linacId) + '/' + R.month); refreshPreview(el); };
      el.querySelectorAll('[data-opt]').forEach(function (c) { c.onchange = function () { R[c.dataset.opt] = c.checked; refreshPreview(el); }; });
      q('#r-dl').onclick = function () { download(this); };
      q('#r-print').onclick = function () { window.print(); };
      q('#r-mail').onclick = email;
    }
  };
})();
