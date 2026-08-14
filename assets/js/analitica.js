// ==========================================================================
// TALMA DATA CENTER — Analítica (analitica.html)
// ==========================================================================
import { colRef } from "./firebase-config.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uniqueSorted, getSemestre, getPeriodoLabel, parseHorasNumero, debounce } from "./utils.js";

let allData = [];
let charts = {};
let agrupacionAsistencia = 'BASE'; // BASE | GRUPO

const PALETA = ['#0b7a40', '#0b3d62', '#1c6fa8', '#3fa869', '#124a76', '#7fb3e0', '#8a94a6', '#5b7fa6'];

/* ============================== CONEXIÓN ============================== */
onSnapshot(colRef, (snapshot) => {
  allData = snapshot.docs.map(d => d.data());
  document.getElementById('connectionBadge').innerHTML = '<span class="status-dot status-online"></span> Conectado a la nube';
  poblarFiltrosDinamicos();
  procesarDatosAnalitica();
}, (error) => {
  console.error(error);
  document.getElementById('connectionBadge').innerHTML = '<span class="status-dot status-offline"></span> Error de conexión';
});

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
  renderAsistenciaGlobal(data);
  renderAsistenciaPorCategoria(data);
  renderDistribucion(data, 'SALON', 'chartSalones', 'Alumnos por Salón');
  renderDistribucion(data, 'INSTRUCTOR', 'chartInstructores', 'Alumnos por Instructor');
  renderHorasPorPeriodo(data);
}

function renderAsistenciaGlobal(data) {
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
