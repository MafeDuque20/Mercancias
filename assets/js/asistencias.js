// ==========================================================================
// TALMA DATA CENTER — Vista Asistencias (tabla + CRUD + carga masiva)
// Conserva toda la lógica original: crear, editar, eliminar, selección
// múltiple, edición masiva, exportación y carga masiva con validación.
// ==========================================================================
import { db, colRef, CAMPOS } from "./firebase-config.js";
import { doc, setDoc, addDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  showToast, validarRegistro, mapearEncabezados, normalizarFilaExcel,
  formatFechaDisplay, formatHoraDisplay, parseFechaFlexible,
} from "./utils.js";
import { store } from "./store.js";
import { escapeHtml } from "./ui.js";

let selectedIds = new Set();
let pendingImport = { validos: [], invalidos: [] };

let sortKey = "FECHA";
let sortDir = -1;
let page = 1;
let pageSize = 25;

const COLUMNAS = [
  { key: "ID", label: "ID" },
  { key: "NOMBRES", label: "Colaborador" },
  { key: "CURSO", label: "Curso" },
  { key: "PROGRAMA", label: "Programa" },
  { key: "FECHA", label: "Fecha" },
  { key: "BASE", label: "Base" },
  { key: "HORA", label: "Hora" },
  { key: "GRUPO", label: "Grupo" },
  { key: "INSTRUCTOR", label: "Instructor" },
  { key: "ASISTIO", label: "Asistió" },
  { key: "NOTA", label: "Nota" },
  { key: "OBSERVACION", label: "Observación" },
];

let modalRegistro, modalCargaMasiva, modalEdicionMasiva, modalValidacion, modalDocumento;

export function initAsistencias() {
  modalRegistro = new bootstrap.Modal(document.getElementById("modalRegistro"));
  modalCargaMasiva = new bootstrap.Modal(document.getElementById("modalCargaMasiva"));
  modalEdicionMasiva = new bootstrap.Modal(document.getElementById("modalEdicionMasiva"));
  modalValidacion = new bootstrap.Modal(document.getElementById("modalValidacion"));

  document.querySelectorAll("#asistenciasTable thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => sortTabla(th.dataset.sort));
  });

  document.getElementById("pagerSize").addEventListener("change", (e) => {
    pageSize = e.target.value === "todos" ? Infinity : Number(e.target.value);
    page = 1;
    render(store);
  });

  document.getElementById("pagerPrev").addEventListener("click", () => { page--; render(store); });
  document.getElementById("pagerNext").addEventListener("click", () => { page++; render(store); });
}

export function render(s) {
  const data = ordenar(s.filtered);
  const total = data.length;
  const pagina = pageSize === Infinity ? 1 : page;
  const pageCount = pageSize === Infinity ? 1 : Math.max(1, Math.ceil(total / pageSize));
  if (pageSize !== Infinity && page > pageCount) page = pageCount;
  const inicio = pageSize === Infinity ? 0 : (page - 1) * pageSize;
  const slice = pageSize === Infinity ? data : data.slice(inicio, inicio + pageSize);

  renderHeaders();
  renderTbody(slice, s.estado);
  renderPager(total, page, pageCount, inicio, slice.length);
  renderMobileCards(slice);
  updateBulkBar();
}

/* ============================== ORDENAMIENTO ============================== */
function sortTabla(key) {
  if (sortKey === key) sortDir = -sortDir;
  else { sortKey = key; sortDir = key === "FECHA" ? -1 : 1; }
  page = 1;
  render(store);
}

function ordena(regA, regB, key) {
  let va = String(regA[key] ?? "");
  let vb = String(regB[key] ?? "");
  if (key === "NOTA") {
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
  }
  return va.localeCompare(vb, "es", { numeric: true });
}

function ordenar(data) {
  const copia = [...data];
  copia.sort((a, b) => ordena(a, b, sortKey) * sortDir);
  return copia;
}

function renderHeaders() {
  document.querySelectorAll("#asistenciasTable thead th[data-sort]").forEach(th => {
    if (!th.dataset.label) th.dataset.label = th.textContent.trim();
    let ind = "";
    if (th.dataset.sort === sortKey) ind = sortDir === 1 ? "▲" : "▼";
    th.innerHTML = `${escapeHtml(th.dataset.label)}<span class="sort-ind">${ind}</span>`;
    th.classList.add("th-sort");
  });
}

/* ============================== TABLA ============================== */
function renderTbody(slice, estado) {
  const tbody = document.getElementById("tableBody");
  const totalCols = 2 + COLUMNAS.length;

  if (estado === "loading" && slice.length === 0) {
    tbody.innerHTML = Array.from({ length: 8 }, () =>
      `<tr><td colspan="${totalCols}"><div class="skeleton"></div></td></tr>`).join("");
    return;
  }
  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${totalCols}" class="text-center py-5 text-muted">No hay registros que coincidan con los filtros aplicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(item => {
    const esSi = (item.ASISTIO || "SÍ").toUpperCase() !== "NO";
    const checked = selectedIds.has(item._docId) ? "checked" : "";
    const rowClass = selectedIds.has(item._docId) ? "row-selected" : "";
    const cells = COLUMNAS.map(c => filaCelda(item, c.key)).join("");
    return `
      <tr class="${rowClass}">
        <td><input type="checkbox" class="form-check-input row-check" data-id="${item._docId}" ${checked}></td>
        <td>
          <button class="btn btn-sm btn-outline-navy py-0 px-1" title="Editar" onclick="editarRegistro('${item._docId}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-outline-danger py-0 px-1 ms-1" title="Eliminar" onclick="eliminarRegistro('${item._docId}')"><i class="fa-solid fa-trash"></i></button>
        </td>
        ${cells}
      </tr>`;
  }).join("");

  tbody.querySelectorAll(".row-check").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
      e.target.closest("tr").classList.toggle("row-selected", e.target.checked);
      updateBulkBar();
    });
  });

  const allBox = document.getElementById("selectAllCheckbox");
  if (allBox) allBox.checked = slice.length > 0 && slice.every(d => selectedIds.has(d._docId));
}

function filaCelda(item, key) {
  const v = escapeHtml(item[key] || "");
  switch (key) {
    case "ID": return `<td class="id-cell">${v || "—"}</td>`;
    case "NOMBRES": return `<td title="${v}">${v
      ? `<span class="person-link" data-open-perfil="${escapeHtml(item.ID || "")}">${v}</span>` : "—"}</td>`;
    case "CURSO": return `<td title="${v}">${v || "—"}</td>`;
    case "PROGRAMA": return `<td title="${v}">${v || "—"}</td>`;
    case "FECHA": return `<td class="mono">${formatFechaDisplay(item.FECHA)}</td>`;
    case "HORA": return `<td class="mono">${escapeHtml(formatHoraDisplay(item.HORA))}</td>`;
    case "ASISTIO": {
      const esSi = (item.ASISTIO || "SÍ").toUpperCase() !== "NO";
      return `<td><span class="hz-pill ${esSi ? "si" : "no"}"><span class="hz-dot"></span>${esSi ? "SÍ" : "NO"}</span></td>`;
    }
    case "OBSERVACION": return `<td title="${v}">${v || "—"}</td>`;
    default: return `<td>${v || "—"}</td>`;
  }
}

/* ============================== TARJETAS MÓVILES ============================== */
function renderMobileCards(slice) {
  const cont = document.getElementById("mobileCards");
  if (!cont) return;
  if (slice.length === 0) { cont.innerHTML = '<div class="text-center py-4 text-muted small">Sin resultados.</div>'; return; }
  cont.innerHTML = slice.map(item => {
    const esSi = (item.ASISTIO || "SÍ").toUpperCase() !== "NO";
    const nombre = escapeHtml(item.NOMBRES || "(Sin nombre)");
    return `
    <div class="mobile-card">
      <div class="mc-head">
        <div class="mc-title">
          <span class="person-link" data-open-perfil="${escapeHtml(item.ID || "")}">${nombre}</span>
        </div>
        <span class="hz-pill ${esSi ? "si" : "no"}"><span class="hz-dot"></span>${esSi ? "SÍ" : "NO"}</span>
      </div>
      <dl class="mc-grid">
        <dt>ID</dt><dd class="mono">${escapeHtml(item.ID || "—")}</dd>
        <dt>Fecha</dt><dd>${formatFechaDisplay(item.FECHA)}</dd>
        <dt>Curso</dt><dd>${escapeHtml(item.CURSO || "—")}</dd>
        <dt>Base</dt><dd>${escapeHtml(item.BASE || "—")}</dd>
        <dt>Grupo</dt><dd>${escapeHtml(item.GRUPO || "—")}</dd>
        <dt>Nota</dt><dd>${escapeHtml(item.NOTA || "—")}</dd>
      </dl>
      <div class="mt-2">
        <button class="btn btn-sm btn-outline-navy py-1 px-2 me-1" onclick="editarRegistro('${item._docId}')"><i class="fa-solid fa-pen me-1"></i>Editar</button>
        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="eliminarRegistro('${item._docId}')"><i class="fa-solid fa-trash me-1"></i>Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

/* ============================== PAGINACIÓN ============================== */
function renderPager(total, pagina, pageCount, inicio, visible) {
  const info = document.getElementById("pagerInfo");
  const prev = document.getElementById("pagerPrev");
  const next = document.getElementById("pagerNext");
  if (pageSize === Infinity || total === 0) {
    info.innerText = `${total} registro(s)`;
    prev.disabled = next.disabled = true;
  } else {
    info.innerText = `Página ${pagina} de ${pageCount} · mostrando ${visible} de ${total} registro(s)`;
    prev.disabled = pagina <= 1;
    next.disabled = pagina >= pageCount;
  }
}

function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  if (!bar) return;
  const contador = document.getElementById("bulkCount");
  if (contador) contador.innerText = selectedIds.size;
  bar.classList.toggle("show", selectedIds.size > 0);
}

window.toggleSelectAll = function (checkbox) {
  const data = store.filtered;
  ordenar(data).forEach(item => {
    if (checkbox.checked) selectedIds.add(item._docId); else selectedIds.delete(item._docId);
  });
  render(store);
};

window.limpiarSeleccion = function () {
  selectedIds.clear();
  render(store);
};

/* ============================== CRUD INDIVIDUAL ============================== */
window.abrirModalNuevo = function () {
  document.getElementById("registroForm").reset();
  document.getElementById("recordDocId").value = "";
  document.getElementById("field_PROGRAMA").value = "Mercancías Peligrosas";
  document.getElementById("field_ASISTIO").value = "SÍ";
  document.getElementById("modalTitle").innerText = "Nuevo Registro";
  limpiarValidacionForm();
  modalRegistro.show();
};

window.editarRegistro = function (docId) {
  const item = store.data.find(d => d._docId === docId);
  if (!item) return;
  document.getElementById("recordDocId").value = docId;
  CAMPOS.forEach(campo => {
    const el = document.getElementById("field_" + campo);
    if (el) el.value = item[campo] || (campo === "ASISTIO" ? "SÍ" : "");
  });
  document.getElementById("modalTitle").innerText = "Editar Registro";
  limpiarValidacionForm();
  modalRegistro.show();
};

function limpiarValidacionForm() {
  document.querySelectorAll("#registroForm .field-invalid").forEach(el => el.classList.remove("field-invalid"));
  document.getElementById("formErrors").innerHTML = "";
}

window.guardarRegistro = async function () {
  const docId = document.getElementById("recordDocId").value;
  const dataObj = {};
  CAMPOS.forEach(campo => {
    const el = document.getElementById("field_" + campo);
    dataObj[campo] = el ? el.value.trim() : "";
  });

  const { valido, errores } = validarRegistro(dataObj);
  limpiarValidacionForm();
  if (!valido) {
    document.getElementById("formErrors").innerHTML = errores.map(e =>
      `<div><i class="fa-solid fa-circle-exclamation me-1"></i>${e}</div>`).join("");
    if (!dataObj.ID || !/^\d{5,12}$/.test(dataObj.ID)) document.getElementById("field_ID").classList.add("field-invalid");
    if (!dataObj.NOMBRES || dataObj.NOMBRES.length < 4) document.getElementById("field_NOMBRES").classList.add("field-invalid");
    if (dataObj.CORREO && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dataObj.CORREO)) document.getElementById("field_CORREO").classList.add("field-invalid");
    return;
  }

  try {
    if (docId) {
      await setDoc(doc(db, "capacitaciones", docId), dataObj);
      showToast("Registro actualizado correctamente.", "success");
    } else {
      await addDoc(colRef, dataObj);
      showToast("Registro creado correctamente.", "success");
    }
    modalRegistro.hide();
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar el registro.", "danger");
  }
};

window.eliminarRegistro = async function (docId) {
  const item = store.data.find(d => d._docId === docId);
  if (!item) return;
  if (!confirm(`¿Eliminar el registro de "${item.NOMBRES || "sin nombre"}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteDoc(doc(db, "capacitaciones", docId));
    selectedIds.delete(docId);
    showToast("Registro eliminado.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar el registro.", "danger");
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
    showToast(`${ids.length} registro(s) eliminados.`, "success");
    selectedIds.clear();
  } catch (err) {
    console.error(err);
    showToast("Error al eliminar los registros seleccionados.", "danger");
  }
};

window.abrirEdicionMasiva = function () {
  if (selectedIds.size === 0) return;
  document.getElementById("bulkEditCount").innerText = selectedIds.size;
  document.getElementById("formEdicionMasiva").reset();
  document.querySelectorAll("#formEdicionMasiva .bulk-field-toggle").forEach(chk => {
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
  const campos = ["INSTRUCTOR", "FECHA", "HORA", "SALON", "GRUPO", "BASE", "CURSO", "PROGRAMA", "ASISTIO"];
  const cambios = {};
  campos.forEach(campo => {
    const chk = document.querySelector(`.bulk-field-toggle[data-campo="${campo}"]`);
    if (chk && chk.checked) {
      const input = document.getElementById("bulk_" + campo);
      cambios[campo] = input.value.trim();
    }
  });
  if (Object.keys(cambios).length === 0) {
    showToast("Selecciona al menos un campo para actualizar.", "warning");
    return;
  }
  if (cambios.FECHA) {
    const f = parseFechaFlexible(cambios.FECHA);
    if (!f.valid) { showToast("La fecha ingresada no es válida.", "danger"); return; }
    cambios.FECHA = f.iso;
  }
  try {
    const ids = [...selectedIds];
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db);
      ids.slice(i, i + 450).forEach(id => batch.set(doc(db, "capacitaciones", id), cambios, { merge: true }));
      await batch.commit();
    }
    showToast(`${ids.length} registro(s) actualizados masivamente.`, "success");
    modalEdicionMasiva.hide();
    selectedIds.clear();
  } catch (err) {
    console.error(err);
    showToast("Error al aplicar la edición masiva.", "danger");
  }
};

/* ============================== EXPORTAR EXCEL ============================== */
window.exportarExcel = function () {
  const data = store.filtered;
  if (data.length === 0) return showToast("No hay datos visibles para exportar.", "warning");
  const cleanData = data.map(({ _docId, ...rest }) => {
    const ordenado = {};
    CAMPOS.forEach(c => ordenado[c] = rest[c] || "");
    return ordenado;
  });
  const ws = XLSX.utils.json_to_sheet(cleanData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Capacitaciones");
  XLSX.writeFile(wb, `TDC_Capacitaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast(`Exportados ${cleanData.length} registro(s) a Excel.`, "success");
};

/* ============================== CARGA MASIVA ============================== */
window.procesarCargaMasiva = function () {
  const fileInput = document.getElementById("excelFileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("bulkStatus");
  if (!file) return showToast("Selecciona un archivo Excel o CSV.", "warning");
  statusDiv.innerText = "Leyendo archivo...";
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      if (jsonData.length === 0) {
        statusDiv.innerText = "";
        showToast("El archivo no contiene filas de datos.", "warning");
        return;
      }
      const headers = Object.keys(jsonData[0]);
      const mapa = mapearEncabezados(headers);
      if (!mapa.ID || !mapa.NOMBRES) {
        statusDiv.innerText = "";
        showToast("No se pudo identificar las columnas ID y/o Nombres. Revisa los encabezados del archivo.", "danger");
        return;
      }
      const validos = [];
      const invalidos = [];
      jsonData.forEach((rowRaw, idx) => {
        const rec = normalizarFilaExcel(rowRaw, mapa);
        if (!rec.PROGRAMA) rec.PROGRAMA = "Mercancías Peligrosas";
        const { valido, errores } = validarRegistro(rec);
        const erroresFinal = [...errores];
        if (rec._fechaValida === false) erroresFinal.push("Fecha con formato irreconocible");
        delete rec._fechaValida;
        if (valido && erroresFinal.length === 0) validos.push(rec);
        else invalidos.push({ fila: idx + 2, ...rec, _errores: erroresFinal.join("; ") });
      });
      pendingImport = { validos, invalidos };
      mostrarReporteValidacion(jsonData.length, validos.length, invalidos.length, invalidos);
      statusDiv.innerText = "";
      modalCargaMasiva.hide();
    } catch (err) {
      console.error(err);
      statusDiv.innerText = "";
      showToast("Error al procesar el archivo. Verifica que sea un Excel o CSV válido.", "danger");
    }
  };
  reader.readAsArrayBuffer(file);
};

function mostrarReporteValidacion(total, validos, invalidosCount, invalidos) {
  document.getElementById("valTotal").innerText = total;
  document.getElementById("valValidos").innerText = validos;
  document.getElementById("valInvalidos").innerText = invalidosCount;
  const tbody = document.getElementById("valTableBody");
  if (invalidos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Todas las filas pasaron la validación. ✅</td></tr>';
  } else {
    tbody.innerHTML = invalidos.map(r => `
      <tr class="error-row">
        <td>${r.fila}</td>
        <td>${escapeHtml(r.ID) || "—"}</td>
        <td>${escapeHtml(r.NOMBRES) || "—"}</td>
        <td class="error-reason">${escapeHtml(r._errores)}</td>
      </tr>`).join("");
  }
  document.getElementById("btnSubirValidos").disabled = validos === 0;
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
    showToast(`${validos.length} registro(s) cargados exitosamente a la nube.`, "success");
    modalValidacion.hide();
    pendingImport = { validos: [], invalidos: [] };
    document.getElementById("excelFileInput").value = "";
  } catch (err) {
    console.error(err);
    showToast("Error al subir los registros validados.", "danger");
  }
};
