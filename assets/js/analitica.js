// ==========================================================================
// TALMA DATA CENTER — Analítica (analitica.html)
// ==========================================================================
import { colRef, CAMPOS } from "./firebase-config.js";
import { onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uniqueSorted, getSemestre, getPeriodoLabel, parseHorasNumero, debounce, normalizarRegistroFirestore } from "./utils.js";

let allData = [];
let charts = {};
let agrupacionAsistencia = 'BASE'; // BASE | GRUPO
let unsubscribe = null;

const PALETA = ['#0b7a40', '#0b3d62', '#1c6fa8', '#3fa869', '#124a76', '#7fb3e0', '#8a94a6', '#5b7fa6'];

/* ============================== CONEXIÓN (mismo dataset/flujo que Operaciones) ============================== */
function iniciarConexion() {
  setEstadoConexion('loading');
  console.log('[FIREBASE] (Analítica) Suscribiendo a la colección "capacitaciones"...');
  if (typeof unsubscribe === 'function') unsubscribe();

  unsubscribe = onSnapshot(colRef, (snapshot) => {
    console.log(`[FIREBASE] (Analítica) Snapshot recibido. Documentos: ${snapshot.size}`);
    procesarSnapshot(snapshot);
  }, (error) => {
    console.error('[FIREBASE] (Analítica) Error de suscripción:', error);
    mostrarErrorCarga({
      titulo: 'No fue posible conectar con la nube',
      mensaje: error.message || String(error),
      codigo: error.code || '—',
      proceso: 'onSnapshot(capacitaciones)'
    });
    setEstadoConexion('error');
  });
}

function procesarSnapshot(snapshot) {
  document.getElementById('totalFilteredRecords').innerText = snapshot.size;
  try {
    const docsArray = snapshot.docs;
    if (!Array.isArray(docsArray)) throw new Error('snapshot.docs no es un arreglo. Estructura de respuesta inesperada.');

    console.log('[DATA] (Analítica) Normalizando registros...');
    const registros = docsArray.map(d => normalizarRegistroFirestore(d.data(), CAMPOS));
    if (!Array.isArray(registros)) throw new Error('El resultado de la normalización no es un arreglo.');

    allData = registros;
    console.log(`[DATA] (Analítica) Dataset cargado: ${allData.length} registro(s)`);

    ocultarErrorCarga();
    poblarFiltrosDinamicos();
    procesarDatosAnalitica();
    setEstadoConexion('online');
  } catch (err) {
    console.error('[DATA] (Analítica) Error procesando los registros recibidos:', err);
    mostrarErrorCarga({
      titulo: 'Se pudo consultar el total, pero no fue posible obtener los registros',
      mensaje: err.message || String(err),
      codigo: '—',
      proceso: 'procesarSnapshot() / normalización de documentos'
    });
    setEstadoConexion('partial');
  }
}

window.actualizarDatosAnalitica = async function () {
  const btn = document.getElementById('btnActualizarDatosAnalitica');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-1"></i> Actualizando...'; }
  setEstadoConexion('loading');
  try {
    const snapshot = await getDocs(colRef);
    procesarSnapshot(snapshot);
  } catch (err) {
    console.error('[FIREBASE] (Analítica) Error al actualizar manualmente:', err);
    mostrarErrorCarga({
      titulo: 'No fue posible actualizar los datos',
      mensaje: err.message || String(err),
      codigo: err.code || '—',
      proceso: 'getDocs(capacitaciones)'
    });
    setEstadoConexion('error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrows-rotate me-1"></i> Actualizar datos'; }
  }
};

window.reintentarCargaAnalitica = function () {
  console.log('[FIREBASE] (Analítica) Reintentando conexión...');
  iniciarConexion();
};

function setEstadoConexion(estado) {
  const badge = document.getElementById('connectionBadge');
  const mapa = {
    loading: '<span class="status-dot status-loading"></span> Conectando...',
    online: '<span class="status-dot status-online"></span> Conectado a la nube',
    partial: '<span class="status-dot status-partial"></span> Conexión parcial',
    error: '<span class="status-dot status-offline"></span> Error de conexión'
  };
  badge.innerHTML = mapa[estado] || mapa.error;
}

function mostrarErrorCarga({ titulo, mensaje, codigo, proceso }) {
  const cont = document.getElementById('loadErrorPanel');
  if (!cont) return;
  cont.classList.remove('d-none');
  cont.innerHTML = `
    <div class="d-flex align-items-start gap-3">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--dg-red); font-size:1.4rem; margin-top:2px;"></i>
      <div class="flex-grow-1">
        <div class="fw-bold" style="color:var(--dg-red);">${titulo}</div>
        <div class="small mt-1" style="color:var(--ink-600);"><strong>Proceso:</strong> ${proceso}</div>
        <div class="small" style="color:var(--ink-600);"><strong>Código:</strong> ${codigo}</div>
        <div class="small mono mt-1" style="color:var(--ink-600); word-break:break-word;">${mensaje}</div>
      </div>
      <button class="btn btn-sm btn-navy" onclick="reintentarCargaAnalitica()"><i class="fa-solid fa-rotate-right me-1"></i>Reintentar</button>
    </div>`;
}

function ocultarErrorCarga() {
  const cont = document.getElementById('loadErrorPanel');
  if (cont) { cont.classList.add('d-none'); cont.innerHTML = ''; }
}

iniciarConexion();

function poblarFiltrosDinamicos() {
  llenarSelect('filtroBase', uniqueSorted(allData.map(d => d.BASE)));
  llenarSelect('filtroGrupo', uniqueSorted(allData.map(d => d.GRUPO)));
  llenarSelect('filtroInstructor', uniqueSorted(allData.map(d => d.INSTRUCTOR)));
}

function llenarSelect(id, valores) {
  const sel = document.getElementById(id);
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + valores.map(v => `<option value="${v}">${v}</option>`).join('');
  if (valores.includes(actual)) sel.value = actual;
}

/* ============================== FILTROS ============================== */
window.procesarDatosAnalitica = function () {
  const semestre = document.getElementById('filtroSemestre').value;
  const base = document.getElementById('filtroBase').value;
  const grupo = document.getElementById('filtroGrupo').value;
  const instructor = document.getElementById('filtroInstructor').value;
  const desde = document.getElementById('filtroFechaDesde').value;
  const hasta = document.getElementById('filtroFechaHasta').value;

  let dataFiltrada = allData.filter(item => {
    if (base && item.BASE !== base) return false;
    if (grupo && item.GRUPO !== grupo) return false;
    if (instructor && item.INSTRUCTOR !== instructor) return false;
    if (desde && item.FECHA && item.FECHA < desde) return false;
    if (hasta && item.FECHA && item.FECHA > hasta) return false;
    if (semestre !== 'todos' && item.FECHA) {
      if (String(getSemestre(item.FECHA)) !== semestre) return false;
    }
    return true;
  });

  document.getElementById('totalFilteredRecords').innerText = dataFiltrada.length;
  renderKpis(dataFiltrada);
  renderGraficos(dataFiltrada);
};

window.limpiarFiltrosAnalitica = function () {
  ['filtroBase', 'filtroGrupo', 'filtroInstructor', 'filtroFechaDesde', 'filtroFechaHasta'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('filtroSemestre').value = 'todos';
  window.procesarDatosAnalitica();
};

window.setAgrupacionAsistencia = function (valor, btnEl) {
  agrupacionAsistencia = valor;
  document.querySelectorAll('.toggle-agrupacion').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  window.procesarDatosAnalitica();
};

/* ============================== KPIs ============================== */
function renderKpis(data) {
  const total = data.length;
  const asistieron = data.filter(d => (d.ASISTIO || 'SÍ').toUpperCase() !== 'NO').length;
  const pct = total ? Math.round((asistieron / total) * 100) : 0;
  const grupos = new Set(data.map(d => d.GRUPO).filter(Boolean)).size;
  const horasTotales = data.reduce((sum, d) => sum + parseHorasNumero(d.INTENSIDAD), 0);

  document.getElementById('kpiAlumnos').innerText = total;
  document.getElementById('kpiPctAsistencia').innerText = `${pct}%`;
  document.getElementById('kpiGruposActivos').innerText = grupos;
  document.getElementById('kpiHorasTotales').innerText = horasTotales.toLocaleString('es-CO');
}

/* ============================== GRÁFICOS ============================== */
function renderGraficos(data) {
  console.log(`[CHARTS] Generando gráficos con ${data.length} registro(s)`);
  renderAsistenciaGlobal(data);
  renderAsistenciaPorCategoria(data);
  renderDistribucion(data, 'SALON', 'chartSalones', 'Alumnos por Salón');
  renderDistribucion(data, 'INSTRUCTOR', 'chartInstructores', 'Alumnos por Instructor');
  renderHorasPorPeriodo(data);
}

// Muestra "No hay datos suficientes" en lugar del canvas cuando no hay
// nada que graficar, sin romper Chart.js ni dejar un gráfico vacío/roto.
function toggleEmptyState(canvasId, isEmpty) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  let msg = canvas.parentElement.querySelector('.chart-empty-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'chart-empty-msg d-flex align-items-center justify-content-center h-100 text-muted small';
    msg.innerHTML = '<span><i class="fa-solid fa-chart-simple me-2"></i>No hay datos suficientes</span>';
    canvas.parentElement.appendChild(msg);
  }
  canvas.style.display = isEmpty ? 'none' : '';
  msg.style.display = isEmpty ? '' : 'none';
}

function renderAsistenciaGlobal(data) {
  toggleEmptyState('chartAsistencia', data.length === 0);
  if (data.length === 0) { if (charts.asistencia) { charts.asistencia.destroy(); charts.asistencia = null; } return; }

  let asistieron = 0, noAsistieron = 0;
  data.forEach(item => (item.ASISTIO || 'SÍ').toUpperCase() === 'NO' ? noAsistieron++ : asistieron++);

  const ctx = document.getElementById('chartAsistencia').getContext('2d');
  if (charts.asistencia) charts.asistencia.destroy();
  charts.asistencia = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Asistieron', 'No asistieron'],
      datasets: [{ data: [asistieron, noAsistieron], backgroundColor: ['#0b7a40', '#d92d2d'], borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
    }
  });
}

function renderAsistenciaPorCategoria(data) {
  toggleEmptyState('chartAsistenciaCategoria', data.length === 0);
  if (data.length === 0) { if (charts.asistenciaCategoria) { charts.asistenciaCategoria.destroy(); charts.asistenciaCategoria = null; } return; }

  const campo = agrupacionAsistencia;
  const map = {};
  data.forEach(item => {
    const key = item[campo] || 'SIN ASIGNAR';
    if (!map[key]) map[key] = { si: 0, no: 0 };
    (item.ASISTIO || 'SÍ').toUpperCase() === 'NO' ? map[key].no++ : map[key].si++;
  });
  const labels = Object.keys(map);

  const ctx = document.getElementById('chartAsistenciaCategoria').getContext('2d');
  if (charts.asistenciaCategoria) charts.asistenciaCategoria.destroy();
  charts.asistenciaCategoria = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Asistieron', data: labels.map(l => map[l].si), backgroundColor: '#0b7a40', borderRadius: 4 },
        { label: 'No asistieron', data: labels.map(l => map[l].no), backgroundColor: '#d92d2d', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
    }
  });
}

function renderDistribucion(data, campo, canvasId, label) {
  toggleEmptyState(canvasId, data.length === 0);
  if (data.length === 0) { if (charts[canvasId]) { charts[canvasId].destroy(); charts[canvasId] = null; } return; }

  const count = {};
  data.forEach(item => {
    const key = item[campo] || 'SIN ASIGNAR';
    count[key] = (count[key] || 0) + 1;
  });
  const labels = Object.keys(count);
  const chartKey = canvasId;

  const ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[chartKey]) charts[chartKey].destroy();
  charts[chartKey] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data: Object.values(count), backgroundColor: PALETA, borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderHorasPorPeriodo(data) {
  const map = {};
  data.forEach(item => {
    if (!item.FECHA) return;
    const periodo = getPeriodoLabel(item.FECHA);
    map[periodo] = (map[periodo] || 0) + parseHorasNumero(item.INTENSIDAD);
  });
  const labels = Object.keys(map).sort();

  toggleEmptyState('chartHorasPeriodo', labels.length === 0);
  if (labels.length === 0) { if (charts.horasPeriodo) { charts.horasPeriodo.destroy(); charts.horasPeriodo = null; } return; }

  const ctx = document.getElementById('chartHorasPeriodo').getContext('2d');
  if (charts.horasPeriodo) charts.horasPeriodo.destroy();
  charts.horasPeriodo = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Horas de capacitación ejecutadas',
        data: labels.map(l => map[l]),
        borderColor: '#0b3d62',
        backgroundColor: 'rgba(11,61,98,0.12)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#0b7a40',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
