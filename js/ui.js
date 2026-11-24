/* =====================================================================
 * e-Dose Agora — Helper UI: ikon, format angka, toast, modal, dialog
 * ===================================================================== */
var UI = (function () {
  var esc = ReportKit.esc, N = TRS398.num, OK = TRS398.ok;

  /* Ikon garis 1.5px gaya Lucide (inline SVG, tanpa font ikon eksternal) */
  var P = {
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
    atom: '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    arrowR: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    alertC: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkC: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    cloudOff: '<path d="m2 2 20 20"/><path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2"/><path d="M21.53 16.53A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10 5.07"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
    beaker: '<path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>',
    grid: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'
  };
  function icon(name, cls, sw) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.5) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  var LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="13" y="4" width="6" height="24" rx="2" fill="#1B365D"/><rect x="4" y="13" width="24" height="6" rx="2" fill="#0072CE"/><circle cx="16" cy="16" r="3.5" fill="#2E9E5B"/></svg>';

  /* Format angka presisi tetap */
  function f(v, d) { return OK(N(v)) ? N(v).toFixed(d) : '—'; }
  var dev = TRS398.fmtDev;
  var date = ReportKit.dateLabel;

  /* Badge status: selalu label teks + ikon (tidak hanya warna) */
  function badge(status, extra) {
    var m = TRS398.STATUS_META[status] || { label: status || '—', cls: 'muted' };
    var ic = m.cls === 'pass' || m.cls === 'cleared' ? 'check' : m.cls === 'warning' ? 'alert' : m.cls === 'fail' ? 'alertC' : '';
    return '<span class="badge b-' + m.cls + '">' + (ic ? icon(ic, 'ic-xs', 2.2) : '') + esc(m.label) + (extra ? ' ' + esc(extra) : '') + '</span>';
  }
  function devClass(status) { var m = TRS398.STATUS_META[status]; return m ? 't-' + m.cls : ''; }

  /* Toast */
  function toast(msg, type, opts) {
    opts = opts || {};
    var host = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'success');
    el.setAttribute('role', 'status');
    el.innerHTML = icon(type === 'error' ? 'alertC' : type === 'warning' ? 'alert' : type === 'info' ? 'cloud' : 'checkC', 'ic-sm', 2) +
      '<div class="toast-msg">' + msg + '</div>' + (opts.action ? '<button class="toast-act">' + esc(opts.action) + '</button>' : '') +
      '<button class="toast-x" aria-label="Tutup">' + icon('x', 'ic-xs', 2) + '</button>';
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    var close = function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 200); };
    el.querySelector('.toast-x').onclick = close;
    if (opts.action) el.querySelector('.toast-act').onclick = function () { close(); opts.onAction && opts.onAction(); };
    if (!opts.sticky) setTimeout(close, opts.ms || (type === 'error' ? 7000 : 3600));
    return close;
  }

  /* Modal */
  function modal(o) {
    var root = document.getElementById('modal-root');
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '">' +
      '<div class="modal-hd"><h3>' + (o.titleHtml || esc(o.title || '')) + '</h3><button class="icon-btn" data-close aria-label="Tutup">' + icon('x', '', 2) + '</button></div>' +
      '<div class="modal-bd">' + (o.body || '') + '</div>' + (o.footer !== undefined ? '<div class="modal-ft">' + o.footer + '</div>' : '') + '</div>';
    root.appendChild(wrap);
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { wrap.classList.add('show'); });
    function close() {
      wrap.classList.remove('show');
      setTimeout(function () { wrap.remove(); if (!root.children.length) document.body.classList.remove('modal-open'); }, 180);
      document.removeEventListener('keydown', onKey);
      o.onClose && o.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
    var el = wrap.querySelector('.modal');
    if (o.onMount) o.onMount(el, close);
    var first = el.querySelector('input:not([type=hidden]):not([readonly]),select,textarea');
    if (first && o.autofocus !== false) setTimeout(function () { first.focus(); }, 50);
    return { el: el, close: close };
  }

  /* Dialog konfirmasi — resolve(true/false); opsi input alasan */
  function confirm(o) {
    return new Promise(function (resolve) {
      var done = false;
      var m = modal({
        title: o.title, size: 'sm', body: '<div class="confirm-body">' + (o.body || '') +
          (o.reason ? '<label class="field mt"><span>' + esc(o.reason) + ' <b class="req">*</b></span><textarea id="cf-reason" rows="2" placeholder="Contoh: salah ketik bacaan M2"></textarea></label>' : '') + '</div>',
        footer: '<button class="btn btn-ghost" data-close>' + esc(o.cancel || 'Batal') + '</button><button class="btn ' + (o.danger ? 'btn-danger' : o.success ? 'btn-success' : 'btn-primary') + '" id="cf-ok">' + esc(o.ok || 'Ya, Lanjutkan') + '</button>',
        autofocus: !!o.reason,
        onMount: function (el, close) {
          el.querySelector('#cf-ok').onclick = function () {
            var reason = o.reason ? el.querySelector('#cf-reason').value.trim() : true;
            if (o.reason && !reason) { el.querySelector('#cf-reason').classList.add('invalid'); el.querySelector('#cf-reason').focus(); return; }
            done = true; close(); resolve(reason);
          };
          if (!o.reason) setTimeout(function () { el.querySelector('#cf-ok').focus(); }, 50);
        },
        onClose: function () { if (!done) resolve(false); }
      });
    });
  }

  /* Tombol sibuk */
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + esc(label || 'Memproses...'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function downloadBase64(b64, filename, mime) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([arr], { type: mime || 'application/pdf' }));
    var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  /* SVG → PNG data URI (untuk grafik di PDF server) */
  function svgToPng(svg, w, h) {
    return new Promise(function (resolve) {
      var s = svg.replace('width="100%"', 'width="' + w + '" height="' + h + '"');
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = function () { resolve(''); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }

  function debounce(fn, ms) { var t; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); }; }

  /* Opsi <select> */
  function options(list, valKey, labelFn, selected, placeholder) {
    return (placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '') + list.map(function (x) {
      var v = typeof valKey === 'function' ? valKey(x) : x[valKey];
      return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(labelFn(x)) + '</option>';
    }).join('');
  }

  /* Nilai form → objek (berdasarkan atribut name) */
  function formData(root) {
    var o = {};
    root.querySelectorAll('[name]').forEach(function (el) {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    });
    return o;
  }

  function nowLocalInput() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* Tooltip kustom untuk titik control chart */
  function bindChartTips(container, onClick) {
    var tip = document.getElementById('chart-tip');
    container.querySelectorAll('.cc-pt').forEach(function (c) {
      var t = c.querySelector('title'), txt = t ? t.textContent : '';
      if (t) t.remove();
      c.addEventListener('mouseenter', function () { tip.textContent = txt; tip.classList.add('show'); c.setAttribute('r', +c.getAttribute('r') + 2); });
      c.addEventListener('mousemove', function (e) { tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 34) + 'px'; });
      c.addEventListener('mouseleave', function () { tip.classList.remove('show'); c.setAttribute('r', +c.getAttribute('r') - 2); });
      if (onClick) c.addEventListener('click', function () { tip.classList.remove('show'); onClick(c.dataset.id, c.dataset.kind); });
    });
  }

  return { esc: esc, icon: icon, LOGO: LOGO, f: f, dev: dev, date: date, badge: badge, devClass: devClass, toast: toast, modal: modal,
    confirm: confirm, busy: busy, downloadBase64: downloadBase64, svgToPng: svgToPng, debounce: debounce, options: options,
    formData: formData, nowLocalInput: nowLocalInput, bindChartTips: bindChartTips };
})();
