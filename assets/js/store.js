// ==========================================================================
// TALMA DATA CENTER — Store central
// Única suscripción a Firestore + único pipeline de filtros. Cada vista
// (tabla, KPIs, gráficos, personas, grupos, cursos) consume EXACTAMENTE
// el mismo arreglo filtrado, eliminando lógicas aisladas por widget.
// ==========================================================================
import { colRef, CAMPOS } from "./firebase-config.js";
import { onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { normalizarRegistroFirestore, getSemestre } from "./utils.js";

const listeners = new Set();

const FILTRO_DEFAULT = {
  busqueda: "",
  desde: "",
  hasta: "",
  semestre: "todos",
  asistio: "",
  base: "",
  grupo: "",
  curso: "",
  instructor: "",
  salon: "",
};

export const store = {
  data: [],          // todos los registros normalizados (en memoria)
  filtered: [],      // resultado tras filtros (única fuente de verdad)
  filtros: { ...FILTRO_DEFAULT },
  estado: "loading",   // loading | online | partial | error
  sizeCrudo: 0,
  ultimaActualizacion: "",

  /* ---------------- Suscripción de vistas ---------------- */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  notify() { listeners.forEach(fn => fn(store)); },

  /* ---------------- Filtros (API central) ---------------- */
  setFiltro(clave, valor) { store.filtros[clave] = valor; store.applyFilters(); },
  clearFiltros() { store.filtros = { ...FILTRO_DEFAULT }; store.applyFilters(); },

  filtrosActivos() {
    const etiquetas = {
      busqueda: "Búsqueda", desde: "Desde", hasta: "Hasta",
      semestre: "Semestre", asistio: "Asistencia", base: "Base",
      grupo: "Grupo", curso: "Curso", instructor: "Instructor", salon: "Salón",
    };
    return Object.entries(store.filtros)
      .filter(([k, v]) => (k === "semestre" ? v !== "todos" : (v ?? "") !== ""))
      .map(([k, v]) => ({ clave: k, etiqueta: etiquetas[k], valor: v }));
  },

  /* ---------------- Pipeline de filtros (único para todo) ---------------- */
  applyFilters() {
    const f = store.filtros;
    const term = (f.busqueda || "").toLowerCase().trim();
    store.filtered = store.data.filter(item => {
      if (term && !Object.values(item).some(v => String(v ?? "").toLowerCase().includes(term))) return false;
      if (f.base && item.BASE !== f.base) return false;
      if (f.grupo && item.GRUPO !== f.grupo) return false;
      if (f.curso && item.CURSO !== f.curso) return false;
      if (f.instructor && item.INSTRUCTOR !== f.instructor) return false;
      if (f.salon && item.SALON !== f.salon) return false;
      if (f.asistio && (item.ASISTIO || "SÍ").toUpperCase() !== f.asistio) return false;
      if (f.desde && item.FECHA && item.FECHA < f.desde) return false;
      if (f.hasta && item.FECHA && item.FECHA > f.hasta) return false;
      if (f.semestre !== "todos" && item.FECHA) {
        if (String(getSemestre(item.FECHA)) !== f.semestre) return false;
      }
      return true;
    });
    store.notify();
  },

  /* ---------------- Conexión a Firestore ---------------- */
  iniciar() { store.connect(); },

  _unsubscribe: null,

  connect() {
    store.setEstado("loading");
    if (typeof store._unsubscribe === "function") store._unsubscribe();
    store._unsubscribe = onSnapshot(colRef, (snapshot) => {
      store.procesarSnapshot(snapshot);
    }, (error) => {
      console.error("[FIREBASE] Error de suscripción:", error);
      store.error = {
        titulo: "No fue posible conectar con la nube",
        mensaje: error.message || String(error),
        codigo: error.code || "—",
        proceso: "onSnapshot(capacitaciones)",
      };
      store.setEstado("error");
      store.notify();
    });
  },

  procesarSnapshot(snapshot) {
    store.sizeCrudo = snapshot.size;
    try {
      const docs = snapshot.docs;
      if (!Array.isArray(docs)) throw new Error("snapshot.docs no es un arreglo. Estructura inesperada.");
      store.data = docs.map(d => normalizarRegistroFirestore({ _docId: d.id, ...d.data() }, CAMPOS));
      store.error = null;
      store.ultimaActualizacion = new Date().toLocaleString("es-CO");
      store.setEstado("online");
      store.applyFilters();
    } catch (err) {
      console.error("[DATA] Error procesando registros:", err);
      store.error = {
        titulo: "Se pudo consultar el total, pero no fue posible obtener los registros",
        mensaje: err.message || String(err),
        codigo: "—",
        proceso: "procesarSnapshot() / normalización de documentos",
      };
      store.setEstado("partial");
      store.notify();
    }
  },

  async actualizar() {
    try {
      store.setEstado("loading");
      store.notify();
      const snapshot = await getDocs(colRef);
      store.procesarSnapshot(snapshot);
      return { ok: true };
    } catch (err) {
      store.error = {
        titulo: "No fue posible actualizar los datos",
        mensaje: err.message || String(err),
        codigo: err.code || "—",
        proceso: "getDocs(capacitaciones)",
      };
      store.setEstado("error");
      store.notify();
      return { ok: false };
    }
  },

  setEstado(e) { store.estado = e; },
};

// Mapa visual de los estados de conexión (compartido por todas las vistas).
export const ESTADO_HTML = {
  loading: '<span class="status-dot status-loading"></span> Conectando...',
  online: '<span class="status-dot status-online"></span> Conectado a la nube',
  partial: '<span class="status-dot status-partial"></span> Conexión parcial',
  error: '<span class="status-dot status-offline"></span> Error de conexión',
};
