# TALMA DATA CENTER — Mercancías Peligrosas

Sistema de radicación y analítica de capacitaciones, conectado en tiempo real
a Firestore (mismo proyecto y colección `capacitaciones` que ya tenías, por
lo que tus datos actuales no se pierden).

## Contenido del paquete

```
talma-data-center/
├── index.html              → Página de Operaciones (tabla, filtros, CRUD, carga masiva)
├── analitica.html           → Página de Analítica (KPIs y gráficos)
├── LEEME.md                  → Este archivo
└── assets/
    ├── css/
    │   └── styles.css       → Sistema de diseño compartido (tokens, tabla, badges, etc.)
    └── js/
        ├── firebase-config.js → Configuración de Firebase (misma que ya usabas)
        ├── utils.js            → Validaciones, mapeo de columnas de Excel, formato de fechas, toasts
        ├── app.js              → Lógica de Operaciones (CRUD, filtros, selección, edición masiva)
        └── analitica.js        → Lógica de Analítica (KPIs y gráficos Chart.js)
```

## Cómo usarlo

1. Descomprime el ZIP conservando la estructura de carpetas (`index.html` y
   `analitica.html` deben quedar en la raíz, junto a la carpeta `assets/`).
2. Súbelo tal cual a donde alojas la herramienta hoy (mismo hosting/GitHub
   Pages/servidor interno). No requiere backend ni build: son archivos
   estáticos.
3. Abre `index.html` en el navegador — se conecta automáticamente a Firestore.

## Qué cambió respecto a la versión anterior

- **Estructura de datos**: se conservan exactamente las mismas 16 columnas y
  las mismas claves en Firestore (`ID`, `NOMBRES`, `PROGRAMA`, `CURSO`,
  `FECHA`, `INTENSIDAD`, `BASE`, `HORA`, `SALON`, `GRUPO`, `CARGO`,
  `CORREO`, `INSTRUCTOR`, `ASISTIO`, `NOTA`, `OBSERVACION`).
- **Filtros avanzados combinables** en Operaciones y Analítica: texto libre,
  rango de fechas, semestre, grupo, base, salón, instructor y asistencia —
  todos se aplican a la vez.
- **Validación de datos** en el formulario individual y en la carga masiva:
  ID numérico (5–12 dígitos), nombres obligatorios, correo con formato
  válido, fecha dentro de un rango razonable (2015–2035), asistencia SÍ/NO.
- **Carga masiva robusta**: reconoce encabezados de Excel aunque vengan
  desordenados, sin tildes o con nombres alternativos (p. ej. "Cédula",
  "Nombre completo", "Estación"). Antes de subir nada, muestra un reporte
  de validación con el conteo de filas válidas/inválidas y el motivo exacto
  de cada error, con opción de descargar ese reporte en Excel y de subir
  solo las filas válidas.
- **Selección múltiple y edición masiva**: casillas de verificación por
  fila (o "seleccionar todo lo filtrado"), con una barra de acciones para
  eliminar en lote o abrir el modal de **Edición Masiva**, donde eliges qué
  campos sobrescribir (Instructor, Fecha, Hora, Salón, Grupo, Base, Curso,
  Programa, Asistió) y a cuántos registros aplicarlo — ideal para asignar
  instructor/salón a un grupo completo de una sola vez.
- **KPIs en tiempo real** arriba de la tabla y en analítica: registros
  filtrados, % de asistencia, grupos activos, bases activas, horas
  ejecutadas.
- **Analítica ampliada** (Chart.js): asistencia global, asistencia por
  Base/Grupo (con botón para alternar entre ambas agrupaciones),
  distribución por Salón, distribución por Instructor, y horas totales de
  capacitación ejecutadas por periodo semestral.
- **Diseño renovado**: paleta corporativa Talma (azul marino) combinada con
  un lenguaje visual de "rótulo de mercancías peligrosas" (insignias en
  forma de rombo) usado consistentemente para los estados de asistencia y
  los íconos de KPI — coherente con el propósito del sistema.
- **Notificaciones tipo toast** en vez de `alert()` para todas las acciones
  (guardar, eliminar, exportar, errores de conexión, etc.).

## Notas técnicas

- Los archivos JavaScript son módulos ES (`type="module"`), por lo que
  algunos navegadores exigen servirlos por `http://` o `https://` (no
  `file://` directo) — si lo pruebas en tu equipo, usa un servidor local
  simple (por ejemplo `npx serve` o la extensión "Live Server") o súbelo
  directo a tu hosting.
- Las escrituras masivas (edición y eliminación en lote, carga de Excel) se
  dividen automáticamente en bloques de 450 operaciones para respetar el
  límite de 500 operaciones por lote de Firestore.
