# TALMA DATA CENTER — Mercancías Peligrosas

Sistema corporativo de gestión y análisis de capacitaciones, conectado en
tiempo real a Firestore (mismo proyecto y colección `capacitaciones` que
ya tenías, por lo que tus datos actuales no se pierden).

## Arquitectura actual (SPA)

La aplicación se unificó en una sola página (`index.html`) con navegación
por hash. Todo el sistema consume una **única fuente de datos filtrados**
(`assets/js/store.js`), de modo que tabla, KPIs, gráficos, personas,
grupos y cursos siempre muestran exactamente el mismo conjunto de datos.

```
talma-data-center/
├── index.html              → Aplicación completa (SPA)
├── analitica.html          → Redirección de compatibilidad hacia index.html#analitica
├── LEEME.md                → Este archivo
└── assets/
    ├── css/
    │   └── styles.css       → Sistema de diseño (tokens, tabla, badges, SPA)
    └── js/
        ├── firebase-config.js → Credenciales y campos oficiales (16 columnas)
        ├── utils.js            → Validación, Excel-map, fechas, formato de hora, toasts
        ├── agregados.js        → Métricas: registros vs PERSONAS ÚNICAS (ID) y agregaciones
        ├── store.js            → Única suscripción a Firestore + pipeline único de filtros
        ├── filtros.js          → Barra compacta de filtros, chips y resumen
        ├── router.js           → Router por hash (incluye detalles grupo/curso)
        ├── ui.js               → Helpers de UI (KPIs, escape, pills, estado)
        ├── dashboard.js        → Vista INICIO (KPIs + resumen rápido)
        ├── asistencias.js      → Vista ASISTENCIAS (tabla ordenable, paginada, CRUD completo)
        ├── colaboradores.js    → Vista COLABORADORES (personas únicas)
        ├── cursos.js           → Vista CURSOS (+ detalle e histórico)
        ├── grupos.js           → Vista GRUPOS (+ detalle con participantes)
        ├── analitica.js        → Vista ANALÍTICA (7+ gráficos sobre store.filtered)
        ├── perfil.js           → Ficha de colaborador (overlay): resumen, info, historial, documentos
        ├── documentos.js       → Firebase Storage + colección Firestore 'documentos'
        └── app.js              → Boot: inicia conexión, router y render central
```

## Novedades respecto a la versión anterior

- **SPA con 6 vistas**: Inicio, Asistencias, Colaboradores, Cursos,
  Grupos y Analítica, más vistas de detalle de grupo/curso y perfil de
  colaborador.
- **Fuente de datos única (store.js)**: al filtrar (p. ej. Base=ADZ) se
  actualizan tabla, KPIs y gráficos a la vez, con una sola suscripción a
  Firestore (menos lecturas simultáneas).
- **Personas únicas (ID)** diferenciadas de los registros en todos los
  KPIs y vistas.
- **Perfil de colaborador**: se abre desde cualquier nombre clickeable y
  muestra resumen, información personal, historial de capacitación y
  documentos.
- **Documentos**: carga/descarga/eliminación reales sobre Firebase
  Storage, con metadatos en la colección `documentos`. Se solicita el
  nombre del usuario que carga (persistido en localStorage) porque la app
  no tiene autenticación.
- **Tabla mejorada**: ordenamiento por columna, paginación, formato de
  hora legible (las fracciones de Excel como 0.4167 se ven como 10:00),
  y tarjetas responsivas en móvil.
- Conserva intacto: crear/editar/eliminar, selección múltiple, edición
  masiva, carga masiva con validación, exportación a Excel, actualizar
  datos y tema claro/oscuro.

## Cómo usarlo

1. Descomprime el ZIP conservando la estructura de carpetas (`index.html`
   en la raíz junto a `assets/`).
2. Súbelo tal cual a tu hosting/servidor interno. No requiere backend ni
   build: son archivos estáticos.
3. Abre `index.html` — se conecta automáticamente a Firestore.
4. Para documentos, habilita Firebase Storage y permite escribir/crear en
   la colección `documentos` (usa las mismas reglas que la colección
   `capacitaciones` donde aplique).

## Notas técnicas

- Las escrituras masivas se dividen en bloques de 450 operaciones
  (límite de Firestore).
- El antiguo enlace `analitica.html` redirige automáticamente a
  `index.html#analitica`.
