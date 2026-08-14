// ==========================================================================
// TALMA DATA CENTER — Operaciones (index.html)
// ==========================================================================
import { db, colRef, CAMPOS } from "./firebase-config.js";
import {
  onSnapshot, doc, setDoc, addDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  showToast, validarRegistro, mapearEncabezados, normalizarFilaExcel,
  formatFechaDisplay, uniqueSorted, debounce, getSemestre, parseFechaFlexible
} from "./utils.js";

let currentData = [];      // todos los registros (crudos de Firestore)
let filteredData = [];     // resultado tras aplicar filtros
let selectedIds = new Set(); // _docId seleccionados
let pendingImport = { validos: [], invalidos: [] };

const modalRegistro = new bootstrap.Modal(document.getElementById('modalRegistro'));
const modalCargaMasiva = new bootstrap.Modal(document.getElementById('modalCargaMasiva'));
const modalEdicionMasiva = new bootstrap.Modal(document.getElementById('modalEdicionMasiva'));
const modalValidacion = new bootstrap.Modal(document.getElementById('modalValidacion'));

/* ============================== CONEXIÓN EN TIEMPO REAL ============================== */
onSnapshot(colRef, (snapshot) => {
  currentData = snapshot.docs.map(d => ({ _docId: d.id, ...d.data() }));
  setConexion(true);
  document.getElementById('totalRecords').innerText = currentData.length;
  poblarFiltrosDinamicos();
  aplicarFiltros();
}, (error) => {
  console.error(error);
  setConexion(false);
});

function setConexion(ok) {
  document.getElementById('connectionBadge').innerHTML = ok
    ? '<span class="status-dot status-online"></span> Conectado a la nube'
    : '<span class="status-dot status-offline"></span> Error de conexión';
}

/* ============================== FILTROS ============================== */
const filtroIds = ["searchInput", "filtroGrupo", "filtroBase", "filtroSalon", "filtroInstructor", "filtroAsistio", "filtroFechaDesde", "filtroFechaHasta", "filtroSemestre"];

function poblarFiltrosDinamicos() {
  const grupos = uniqueSorted(currentData.map(d => d.GRUPO));
  const bases = uniqueSorted(currentData.map(d => d.BASE));
  const salones = uniqueSorted(currentData.map(d => d.SALON));
  const instructores = uniqueSorted(currentData.map(d => d.INSTRUCTOR));

  llenarSelect('filtroGrupo', grupos);
  llenarSelect('filtroBase', bases);
  llenarSelect('filtroSalon', salones);
  llenarSelect('filtroInstructor', instructores);
}

function llenarSelect(id, valores) {
  const sel = document.getElementById(id);
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + valores.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (valores.includes(actual)) sel.value = actual;
}

window.aplicarFiltros = function () {
  const term = document.getElementById('searchInput').value.toLowerCase().trim();
  const grupo = document.getElementById('filtroGrupo').value;
  const base = document.getElementById('filtroBase').value;
  const salon = document.getElementById('filtroSalon').value;
  const instructor = document.getElementById('filtroInstructor').value;
  const asistio = document.getElementById('filtroAsistio').value;
  const desde = document.getElementById('filtroFechaDesde').value;
  const hasta = document.getElementById('filtroFechaHasta').value;
  const semestre = document.getElementById('filtroSemestre').value;

  filteredData = currentData.filter(item => {
    if (term && !Object.values(item).some(v => String(v ?? '').toLowerCase().includes(term))) return false;
    if (grupo && item.GRUPO !== grupo) return false;
    if (base && item.BASE !== base) return false;
    if (salon && item.SALON !== salon) return false;
    if (instructor && item.INSTRUCTOR !== instructor) return false;
    if (asistio && (item.ASISTIO || 'SÍ').toUpperCase() !== asistio) return false;
    if (desde && item.FECHA && item.FECHA < desde) return false;
    if (hasta && item.FECHA && item.FECHA > hasta) return false;
    if (semestre !== 'todos' && item.FECHA) {
      if (String(getSemestre(item.FECHA)) !== semestre) return false;
    }
    return true;
  });

  renderTable(filteredData);
  renderKpis(filteredData);
};

window.limpiarFiltros = function () {
  filtroIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = id === 'filtroSemestre' ? 'todos' : ''; });
  aplicarFiltros();
};

const aplicarFiltrosDebounced = debounce(() => window.aplicarFiltros(), 200);
document.getElementById('searchInput').addEventListener('input', aplicarFiltrosDebounced);

/* ============================== KPIs ============================== */
function renderKpis(data) {
  const total = data.length;
  const asistieron = data.filter(d => (d.ASISTIO || 'SÍ').toUpperCase() !== 'NO').length;
  const pct = total ? Math.round((asistieron / total) * 100) : 0;
  const grupos = new Set(data.map(d => d.GRUPO).filter(Boolean)).size;
  const bases = new Set(data.map(d => d.BASE).filter(Boolean)).size;

  document.getElementById('kpiTotal').innerText = total;
  document.getElementById('kpiAsistencia').innerText = `${pct}%`;
  document.getElementById('kpiGrupos').innerText = grupos;
  document.getElementById('kpiBases').innerText = bases;
}

/* ============================== TABLA ============================== */
function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="18" class="text-center py-5 text-muted">No hay registros que coincidan con los filtros aplicados.</td></tr>';
    updateBulkBar();
    return;
  }

  tbody.innerHTML = data.map(item => {
    const asistio = (item.ASISTIO || 'SÍ').toUpperCase();
    const esSi = asistio !== 'NO';
    const checked = selectedIds.has(item._docId) ? 'checked' : '';
    const rowClass = selectedIds.has(item._docId) ? 'row-selected' : '';
    return `
      <tr class="${rowClass}" data-id="${item._docId}">
        <td><input type="checkbox" class="form-check-input row-check" data-id="${item._docId}" ${checked}></td>
        <td>
          <button class="btn btn-sm btn-outline-navy py-0 px-1 me-1" title="Editar" onclick="editarRegistro('${item._docId}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-outline-danger py-0 px-1" title="Eliminar" onclick="eliminarRegistro('${item._docId}')"><i class="fa-solid fa-trash"></i></button>
        </td>
        <td class="id-cell">${escapeHtml(item.ID) || '—'}</td>
        <td title="${escapeHtml(item.NOMBRES)}">${escapeHtml(item.NOMBRES) || '—'}</td>
        <td title="${escapeHtml(item.PROGRAMA)}">${escapeHtml(item.PROGRAMA) || '—'}</td>
        <td title="${escapeHtml(item.CURSO)}">${escapeHtml(item.CURSO) || '—'}</td>
        <td class="mono">${formatFechaDisplay(item.FECHA)}</td>
        <td>${escapeHtml(item.INTENSIDAD) || '—'}</td>
        <td>${escapeHtml(item.BASE) || '—'}</td>
        <td class="mono">${escapeHtml(item.HORA) || '—'}</td>
        <td>${escapeHtml(item.SALON) || '—'}</td>
        <td>${escapeHtml(item.GRUPO) || '—'}</td>
        <td>${escapeHtml(item.CARGO) || '—'}</td>
        <td title="${escapeHtml(item.CORREO)}">${escapeHtml(item.CORREO) || '—'}</td>
        <td>${escapeHtml(item.INSTRUCTOR) || '—'}</td>
        <td><span class="hz-pill ${esSi ? 'si' : 'no'}"><span class="hz-dot"></span>${esSi ? 'SÍ' : 'NO'}</span></td>
        <td>${escapeHtml(item.NOTA) || '—'}</td>
        <td title="${escapeHtml(item.OBSERVACION)}">${escapeHtml(item.OBSERVACION) || '—'}</td>
      </tr>`;
  }).join('');

  document.querySelectorAll('.row-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
      e.target.closest('tr').classList.toggle('row-selected', e.target.checked);
      updateBulkBar();
    });
  });

  updateBulkBar();
  document.getElementById('selectAllCheckbox').checked =
    data.length > 0 && data.every(d => selectedIds.has(d._docId));
}

window.toggleSelectAll = function (checkbox) {
  filteredData.forEach(item => {
    if (checkbox.checked) selectedIds.add(item._docId); else selectedIds.delete(item._docId);
  });
  renderTable(filteredData);
};

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const count = selectedIds.size;
  document.getElementById('bulkCount').innerText = count;
  bar.classList.toggle('show', count > 0);
}

window.limpiarSeleccion = function () {
  selectedIds.clear();
  renderTable(filteredData);
};

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============================== CRUD INDIVIDUAL ============================== */
window.abrirModalNuevo = function () {
  document.getElementById('registroForm').reset();
  document.getElementById('recordDocId').value = '';
  document.getElementById('field_PROGRAMA').value = 'Mercancías Peligrosas';
  document.getElementById('field_ASISTIO').value = 'SÍ';
  document.getElementById('modalTitle').innerText = 'Nuevo Registro';
  limpiarValidacionForm();
  modalRegistro.show();
};

window.editarRegistro = function (docId) {
  const item = currentData.find(d => d._docId === docId);
  if (!item) return;

  document.getElementById('recordDocId').value = docId;
  CAMPOS.forEach(campo => {
    const el = document.getElementById('field_' + campo);
    if (el) el.value = item[campo] || (campo === 'ASISTIO' ? 'SÍ' : '');
  });

  document.getElementById('modalTitle').innerText = 'Editar Registro';
  limpiarValidacionForm();
  modalRegistro.show();
};

function limpiarValidacionForm() {
  document.querySelectorAll('#registroForm .field-invalid').forEach(el => el.classList.remove('field-invalid'));
  document.getElementById('formErrors').innerHTML = '';
}

window.guardarRegistro = async function () {
  const docId = document.getElementById('recordDocId').value;
  const dataObj = {};
  CAMPOS.forEach(campo => {
    const el = document.getElementById('field_' + campo);
    dataObj[campo] = el ? el.value.trim() : '';
  });

  const { valido, errores } = validarRegistro(dataObj);
  limpiarValidacionForm();

  if (!valido) {
    document.getElementById('formErrors').innerHTML = errores.map(e => `<div><i class="fa-solid fa-circle-exclamation me-1"></i>${e}</div>`).join('');
    if (!dataObj.ID || !/^\d{5,12}$/.test(dataObj.ID)) document.getElementById('field_ID').classList.add('field-invalid');
    if (!dataObj.NOMBRES || dataObj.NOMBRES.length < 4) document.getElementById('field_NOMBRES').classList.add('field-invalid');
    if (dataObj.CORREO && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dataObj.CORREO)) document.getElementById('field_CORREO').classList.add('field-invalid');
    return;
  }

  try {
    if (docId) {
      await setDoc(doc(db, "capacitaciones", docId), dataObj);
      showToast('Registro actualizado correctamente.', 'success');
    } else {
      await addDoc(colRef, dataObj);
      showToast('Registro creado correctamente.', 'success');
    }
    modalRegistro.hide();
  } catch (err) {
    console.error(err);
    showToast('No se pudo guardar el registro. Intenta de nuevo.', 'danger');
  }
};

window.eliminarRegistro = async function (docId) {
  if (!confirm("¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.")) return;
  try {
    await deleteDoc(doc(db, "capacitaciones", docId));
    selectedIds.delete(docId);
    showToast('Registro eliminado.', 'success');
  } catch (err) {
    console.error(err);
    showToast('No se pudo eliminar el registro.', 'danger');
  }
};

/* ============================== ACCIONES MASIVAS ============================== */
window.eliminarSeleccionados = async function () {
  if (selectedIds.size === 0) return;
  if (!confirm(`¿Eliminar ${selectedIds.size} registro(s) seleccionados? Esta acción no se puede deshacer.`)) return;

  try {
    const ids = [...selectedIds];
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db);
      ids.slice(i, i + 450).forEach(id => batch.delete(doc(db, "capacitaciones", id)));
      await batch.commit();
    }
    showToast(`${ids.length} registro(s) eliminados.`, 'success');
    selectedIds.clear();
  } catch (err) {
    console.error(err);
    showToast('Error al eliminar los registros seleccionados.', 'danger');
  }
};

window.abrirEdicionMasiva = function () {
  if (selectedIds.size === 0) return;
  document.getElementById('bulkEditCount').innerText = selectedIds.size;
  document.getElementById('formEdicionMasiva').reset();
  document.querySelectorAll('#formEdicionMasiva .bulk-field-toggle').forEach(chk => {
    chk.checked = false;
    toggleBulkField(chk);
  });
  modalEdicionMasiva.show();
};

window.toggleBulkField = function (checkbox) {
  const target = document.getElementById(checkbox.dataset.target);
  if (target) target.disabled = !checkbox.checked;
};

window.aplicarEdicionMasiva = async function () {
  const campos = ['INSTRUCTOR', 'FECHA', 'HORA', 'SALON', 'GRUPO', 'BASE', 'CURSO', 'PROGRAMA', 'ASISTIO'];
  const cambios = {};
  campos.forEach(campo => {
    const chk = document.querySelector(`.bulk-field-toggle[data-campo="${campo}"]`);
    if (chk && chk.checked) {
      const input = document.getElementById('bulk_' + campo);
      cambios[campo] = input.value.trim();
    }
  });

  if (Object.keys(cambios).length === 0) {
    showToast('Selecciona al menos un campo para actualizar.', 'warning');
    return;
  }

  if (cambios.FECHA) {
    const f = parseFechaFlexible(cambios.FECHA);
    if (!f.valid) { showToast('La fecha ingresada no es válida.', 'danger'); return; }
    cambios.FECHA = f.iso;
  }

  try {
    const ids = [...selectedIds];
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db);
      ids.slice(i, i + 450).forEach(id => batch.set(doc(db, "capacitaciones", id), cambios, { merge: true }));
      await batch.commit();
    }
    showToast(`${ids.length} registro(s) actualizados masivamente.`, 'success');
    modalEdicionMasiva.hide();
    selectedIds.clear();
  } catch (err) {
    console.error(err);
    showToast('Error al aplicar la edición masiva.', 'danger');
  }
};

/* ============================== EXPORTAR EXCEL ============================== */
window.exportarExcel = function () {
  if (filteredData.length === 0) return showToast('No hay datos visibles para exportar.', 'warning');

  const cleanData = filteredData.map(({ _docId, ...rest }) => {
    const ordenado = {};
    CAMPOS.forEach(c => ordenado[c] = rest[c] || '');
    return ordenado;
  });
  const ws = XLSX.utils.json_to_sheet(cleanData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Capacitaciones");
  XLSX.writeFile(wb, `TDC_Capacitaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast(`Exportados ${cleanData.length} registro(s) a Excel.`, 'success');
};

/* ============================== CARGA MASIVA CON VALIDACIÓN ============================== */
window.procesarCargaMasiva = function () {
  const fileInput = document.getElementById('excelFileInput');
  const file = fileInput.files[0];
  const statusDiv = document.getElementById('bulkStatus');
  if (!file) return showToast('Selecciona un archivo Excel o CSV.', 'warning');

  statusDiv.innerText = "Leyendo archivo...";
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (jsonData.length === 0) {
        statusDiv.innerText = "";
        showToast('El archivo no contiene filas de datos.', 'warning');
        return;
      }

      const headers = Object.keys(jsonData[0]);
      const mapa = mapearEncabezados(headers);

      if (!mapa.ID || !mapa.NOMBRES) {
        statusDiv.innerText = "";
        showToast('No se pudo identificar las columnas ID y/o Nombres. Revisa los encabezados del archivo.', 'danger');
        return;
      }

      const validos = [];
      const invalidos = [];

      jsonData.forEach((rowRaw, idx) => {
        const rec = normalizarFilaExcel(rowRaw, mapa);
        if (!rec.PROGRAMA) rec.PROGRAMA = 'Mercancías Peligrosas';
        const { valido, errores } = validarRegistro(rec);
        const erroresFinal = [...errores];
        if (rec._fechaValida === false) erroresFinal.push('Fecha con formato irreconocible');
        delete rec._fechaValida;

        if (valido && erroresFinal.length === 0) {
          validos.push(rec);
        } else {
          invalidos.push({ fila: idx + 2, ...rec, _errores: erroresFinal.join('; ') });
        }
      });

      pendingImport = { validos, invalidos };
      mostrarReporteValidacion(jsonData.length, validos.length, invalidos.length, invalidos);
      statusDiv.innerText = "";
      bootstrap.Modal.getInstance(document.getElementById('modalCargaMasiva'))?.hide();
    } catch (err) {
      console.error(err);
      statusDiv.innerText = "";
      showToast('Error al procesar el archivo. Verifica que sea un Excel o CSV válido.', 'danger');
    }
  };

  reader.readAsArrayBuffer(file);
};

function mostrarReporteValidacion(total, validos, invalidosCount, invalidos) {
  document.getElementById('valTotal').innerText = total;
  document.getElementById('valValidos').innerText = validos;
  document.getElementById('valInvalidos').innerText = invalidosCount;

  const tbody = document.getElementById('valTableBody');
  if (invalidos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Todas las filas pasaron la validación. ✅</td></tr>';
  } else {
    tbody.innerHTML = invalidos.map(r => `
      <tr class="error-row">
        <td>${r.fila}</td>
        <td>${escapeHtml(r.ID) || '—'}</td>
        <td>${escapeHtml(r.NOMBRES) || '—'}</td>
        <td class="error-reason">${escapeHtml(r._errores)}</td>
      </tr>`).join('');
  }

  document.getElementById('btnSubirValidos').disabled = validos === 0;
  modalValidacion.show();
}

window.descargarReporteErrores = function () {
  if (pendingImport.invalidos.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(pendingImport.invalidos.map(r => ({
    FILA: r.fila, ID: r.ID, NOMBRES: r.NOMBRES, MOTIVO_ERROR: r._errores
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Errores");
  XLSX.writeFile(wb, "TDC_Reporte_Errores_CargaMasiva.xlsx");
};

window.confirmarSubidaValidos = async function () {
  const validos = pendingImport.validos;
  if (validos.length === 0) return;

  try {
    for (let i = 0; i < validos.length; i += 450) {
      const batch = writeBatch(db);
      validos.slice(i, i + 450).forEach(rec => batch.set(doc(colRef), rec));
      await batch.commit();
    }
    showToast(`${validos.length} registro(s) cargados exitosamente a la nube.`, 'success');
    modalValidacion.hide();
    pendingImport = { validos: [], invalidos: [] };
    document.getElementById('excelFileInput').value = '';
  } catch (err) {
    console.error(err);
    showToast('Error al subir los registros validados.', 'danger');
  }
};
