// ── Configuración ──────────────────────────────────────────
const PIN       = '2210';
const AUTH_KEY  = 'cel_auth';
const STOCK_KEY = 'cel_stock';
const AUTH_DAYS = 30;

// ── Auth ───────────────────────────────────────────────────
let pinBuffer = '';

function checkAuth() {
  const stored = localStorage.getItem(AUTH_KEY);
  if (stored) {
    const days = (Date.now() - parseInt(stored)) / 86400000;
    if (days < AUTH_DAYS) { showApp(); return; }
  }
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').classList.add('app-hidden');
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.remove('app-hidden');
  initApp();
}

function initPinPad() {
  document.querySelectorAll('.pin-btn[data-n]').forEach(btn => {
    btn.addEventListener('click', () => addPin(btn.dataset.n));
  });
  document.getElementById('pin-back').addEventListener('click', backPin);
  document.getElementById('pin-clear').addEventListener('click', clearPin);

  document.addEventListener('keydown', e => {
    const ls = document.getElementById('login-screen');
    if (ls.style.display === 'none') return;
    if (e.key >= '0' && e.key <= '9') addPin(e.key);
    else if (e.key === 'Backspace') backPin();
    else if (e.key === 'Escape') clearPin();
  });
}

function addPin(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updateDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 180);
}

function backPin() { pinBuffer = pinBuffer.slice(0, -1); updateDots(); }
function clearPin() { pinBuffer = ''; updateDots(); }

function updateDots() {
  document.querySelectorAll('#pin-dots span').forEach((d, i) => {
    d.classList.toggle('filled', i < pinBuffer.length);
  });
}

function checkPin() {
  if (pinBuffer === PIN) {
    localStorage.setItem(AUTH_KEY, Date.now().toString());
    document.getElementById('login-screen').classList.add('success');
    setTimeout(showApp, 650);
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto';
    document.getElementById('login-screen').classList.add('shake');
    setTimeout(() => {
      document.getElementById('login-screen').classList.remove('shake');
      document.getElementById('pin-error').textContent = '';
      clearPin();
    }, 650);
  }
}

// ── Stock ──────────────────────────────────────────────────
let STOCK = [];
let editingId = null;
let appInited = false;

function loadStock() {
  try {
    STOCK = JSON.parse(localStorage.getItem(STOCK_KEY) || '[]');
  } catch (e) { STOCK = []; }
}

function saveStock() {
  localStorage.setItem(STOCK_KEY, JSON.stringify(STOCK));
}

// ── Init ───────────────────────────────────────────────────
function initApp() {
  if (appInited) return;
  appInited = true;
  loadStock();

  // Botón agregar
  document.getElementById('add-btn').addEventListener('click', () => openForm());

  // Filtros y búsqueda
  document.getElementById('search').addEventListener('input', debounceRender);
  document.getElementById('f-marca').addEventListener('change', debounceRender);
  document.getElementById('f-estado').addEventListener('change', debounceRender);
  document.getElementById('f-vendido').addEventListener('change', debounceRender);

  // Form modal
  document.getElementById('form-close').addEventListener('click', closeForm);
  document.getElementById('form-cancel').addEventListener('click', closeForm);
  document.getElementById('form-save').addEventListener('click', savePhone);
  document.getElementById('form-modal').addEventListener('click', e => {
    if (e.target.id === 'form-modal') closeForm();
  });

  // Detail modal
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-modal').addEventListener('click', e => {
    if (e.target.id === 'detail-modal') closeDetail();
  });

  render();
}

// ── Render ─────────────────────────────────────────────────
let renderTimer;
function debounceRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 60);
}

function render() {
  const q       = (document.getElementById('search').value || '').trim().toLowerCase();
  const fMarca  = document.getElementById('f-marca').value;
  const fEstado = document.getElementById('f-estado').value;
  const fVend   = document.getElementById('f-vendido').value;
  const words   = q ? q.split(/\s+/).filter(Boolean) : [];

  // Actualizar select de marcas
  const marcas = [...new Set(STOCK.map(p => p.marca))].sort();
  const selM   = document.getElementById('f-marca');
  const prev   = selM.value;
  while (selM.options.length > 1) selM.remove(1);
  marcas.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    selM.appendChild(o);
  });
  selM.value = prev;

  // Filtrar
  const filtered = STOCK.filter(p => {
    if (fMarca  && p.marca  !== fMarca)  return false;
    if (fEstado && p.estado !== fEstado) return false;
    if (fVend === '0' && p.vendido)      return false;
    if (fVend === '1' && !p.vendido)     return false;
    if (words.length) {
      const hay = (p.marca + ' ' + p.modelo + ' ' + (p.imei || '') + ' ' + (p.notas || '')).toLowerCase();
      return words.every(w => hay.includes(w));
    }
    return true;
  });

  // Stats
  const inStock  = STOCK.filter(p => !p.vendido);
  const sold     = STOCK.filter(p => p.vendido);
  const totalVal = inStock.reduce((s, p) => s + (p.precio || 0), 0);
  document.getElementById('s-stock').textContent = inStock.length;
  document.getElementById('s-sold').textContent  = sold.length;
  document.getElementById('s-value').textContent = '$' + totalVal.toLocaleString('es-AR');

  // Render lista
  const listEl  = document.getElementById('list');
  const emptyEl = document.getElementById('empty');

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  const badgeCls = { Nuevo: 'bg-new', Usado: 'bg-used', Reacondicionado: 'bg-refurb' };

  listEl.innerHTML = filtered.map(p => {
    const specs = [p.almacenamiento, p.ram ? p.ram + ' RAM' : ''].filter(Boolean).join(' · ');
    const fecha = p.fecha
      ? new Date(p.fecha).toLocaleDateString('es-AR', { day:'2-digit', month:'short' })
      : '';
    return `
<div class="card${p.vendido ? ' card-sold' : ''}" onclick="openDetail('${p.id}')">
  <div class="card-top">
    <div class="card-info">
      <span class="card-marca">${esc(p.marca)}</span>
      <span class="card-modelo">${esc(p.modelo)}</span>
      ${specs ? `<span class="card-specs">${esc(specs)}</span>` : ''}
    </div>
    <div class="card-right">
      <span class="badge ${badgeCls[p.estado] || ''}">${esc(p.estado)}</span>
      ${p.vendido ? '<span class="badge bg-sold">VENDIDO</span>' : ''}
    </div>
  </div>
  <div class="card-bottom">
    <span class="card-price">${p.precio ? '$ ' + p.precio.toLocaleString('es-AR') : '—'}</span>
    <div class="card-meta">
      ${p.imei ? `<span class="card-imei">${esc(p.imei)}</span>` : ''}
      ${fecha ? `<span class="card-date">${fecha}</span>` : ''}
    </div>
  </div>
</div>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Formulario ─────────────────────────────────────────────
function openForm(id) {
  editingId = id || null;
  const t = document.getElementById('form-title');

  if (id) {
    const p = STOCK.find(x => x.id === id);
    if (!p) return;
    t.textContent = '✏️ Editar Equipo';
    document.getElementById('fi-marca').value   = p.marca || '';
    document.getElementById('fi-modelo').value  = p.modelo || '';
    document.getElementById('fi-estado').value  = p.estado || '';
    document.getElementById('fi-precio').value  = p.precio || '';
    document.getElementById('fi-storage').value = p.almacenamiento || '';
    document.getElementById('fi-ram').value     = p.ram || '';
    document.getElementById('fi-imei').value    = p.imei || '';
    document.getElementById('fi-notas').value   = p.notas || '';
  } else {
    t.textContent = '📱 Agregar Equipo';
    ['fi-marca','fi-modelo','fi-precio','fi-imei','fi-notas'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('fi-estado').value  = '';
    document.getElementById('fi-storage').value = '';
    document.getElementById('fi-ram').value     = '';
  }

  document.getElementById('form-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('fi-marca').focus(), 300);
}

function closeForm() {
  document.getElementById('form-modal').classList.add('hidden');
  document.body.style.overflow = '';
  editingId = null;
}

function savePhone() {
  const marca   = document.getElementById('fi-marca').value.trim();
  const modelo  = document.getElementById('fi-modelo').value.trim();
  const estado  = document.getElementById('fi-estado').value;
  const precio  = parseInt(document.getElementById('fi-precio').value) || 0;
  const storage = document.getElementById('fi-storage').value;
  const ram     = document.getElementById('fi-ram').value;
  const imei    = document.getElementById('fi-imei').value.trim();
  const notas   = document.getElementById('fi-notas').value.trim();

  // Validaciones
  if (!marca)  { toast('Ingresá la marca', 'error');  return; }
  if (!modelo) { toast('Ingresá el modelo', 'error'); return; }
  if (!estado) { toast('Seleccioná el estado', 'error'); return; }
  if (!precio || precio <= 0) { toast('Ingresá un precio válido', 'error'); return; }
  if (imei && !/^\d{15}$/.test(imei)) {
    toast('El IMEI debe tener 15 dígitos', 'error'); return;
  }
  // Verificar IMEI duplicado
  if (imei) {
    const dup = STOCK.find(x => x.imei === imei && x.id !== editingId);
    if (dup) {
      toast('Ya existe un equipo con ese IMEI', 'error'); return;
    }
  }

  if (editingId) {
    const idx = STOCK.findIndex(x => x.id === editingId);
    if (idx >= 0) {
      STOCK[idx] = { ...STOCK[idx], marca, modelo, estado, precio, almacenamiento: storage, ram, imei, notas };
    }
    toast('Equipo actualizado', 'success');
  } else {
    STOCK.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      marca, modelo, estado, precio,
      almacenamiento: storage, ram, imei, notas,
      fecha: new Date().toISOString(),
      vendido: false,
    });
    toast('Equipo agregado al stock', 'success');
  }

  saveStock();
  closeForm();
  render();
}

// ── Detalle ────────────────────────────────────────────────
function openDetail(id) {
  const p = STOCK.find(x => x.id === id);
  if (!p) return;

  document.getElementById('det-marca').textContent  = p.marca;
  document.getElementById('det-modelo').textContent = p.modelo;

  const badgeCls = { Nuevo: 'bg-new', Usado: 'bg-used', Reacondicionado: 'bg-refurb' };
  const specs = [p.almacenamiento, p.ram ? p.ram + ' RAM' : ''].filter(Boolean).join(' · ');
  const fechaIng  = p.fecha ? new Date(p.fecha).toLocaleDateString('es-AR') : '—';
  const fechaVta  = p.fecha_venta ? new Date(p.fecha_venta).toLocaleDateString('es-AR') : null;

  document.getElementById('det-body').innerHTML = `
    <div class="det-row">
      <span class="det-label">Estado</span>
      <span class="badge ${badgeCls[p.estado] || ''}">${esc(p.estado)}</span>
    </div>
    <div class="det-row">
      <span class="det-label">Precio</span>
      <span class="det-val det-price">$ ${p.precio ? p.precio.toLocaleString('es-AR') : '—'}</span>
    </div>
    ${specs ? `<div class="det-row"><span class="det-label">Specs</span><span class="det-val">${esc(specs)}</span></div>` : ''}
    ${p.imei ? `<div class="det-row"><span class="det-label">IMEI</span><span class="det-val det-imei">${esc(p.imei)}</span></div>` : ''}
    <div class="det-row">
      <span class="det-label">Ingreso</span>
      <span class="det-val">${fechaIng}</span>
    </div>
    ${fechaVta ? `<div class="det-row"><span class="det-label">Venta</span><span class="det-val">${fechaVta}</span></div>` : ''}
    ${p.notas ? `<div class="det-row det-row--full"><span class="det-label">Notas</span><span class="det-val">${esc(p.notas)}</span></div>` : ''}
    ${p.vendido ? '<div class="det-sold-badge">VENDIDO</div>' : ''}
  `;

  document.getElementById('det-actions').innerHTML = `
    ${!p.vendido ? `<button class="btn-edit" onclick="closeDetail();openForm('${p.id}')">✏️ Editar</button>` : ''}
    ${!p.vendido
      ? `<button class="btn-sell" onclick="markSold('${p.id}')">💰 Marcar vendido</button>`
      : `<button class="btn-unsell" onclick="markSold('${p.id}')">↩️ Reactivar</button>`}
    <button class="btn-delete" onclick="deletePhone('${p.id}')">🗑️ Eliminar</button>
  `;

  document.getElementById('detail-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Acciones ───────────────────────────────────────────────
function markSold(id) {
  const p = STOCK.find(x => x.id === id);
  if (!p) return;
  p.vendido = !p.vendido;
  if (p.vendido) p.fecha_venta = new Date().toISOString();
  else           delete p.fecha_venta;
  saveStock();
  closeDetail();
  render();
  toast(p.vendido ? 'Marcado como vendido' : 'Reactivado al stock', 'success');
}

function deletePhone(id) {
  const p = STOCK.find(x => x.id === id);
  if (!p) return;
  if (!confirm('¿Eliminar ' + p.marca + ' ' + p.modelo + '?')) return;
  STOCK = STOCK.filter(x => x.id !== id);
  saveStock();
  closeDetail();
  render();
  toast('Equipo eliminado', 'info');
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || 'info');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── PWA ────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Arranque ───────────────────────────────────────────────
initPinPad();
checkAuth();
