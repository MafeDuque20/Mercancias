// ==========================================================================
// TALMA DATA CENTER — Router por hash (SPA)
// ==========================================================================

const routes = new Map();
let currentView = null;
let onNavigate = () => {};

export function defineRoute(name, onShow) {
  routes.set(name, onShow);
}

export function navigate(view) {
  location.hash = "#" + view;
}

export function initRouter(navigationHook) {
  onNavigate = navigationHook || onNavigate;
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = hash.split("/");
  const param = decodeURIComponent(rest.join("/") || "");
  const routeName = routes.has(name) ? name : "inicio";

  document.querySelectorAll(".tdc-view").forEach(v => v.classList.remove("view-active"));
  const viewEl = document.getElementById("view-" + routeName);
  if (viewEl) viewEl.classList.add("view-active");

  document.querySelectorAll("[data-nav]").forEach(a => {
    a.classList.toggle("active", a.dataset.nav === routeName);
  });

  currentView = routeName;
  const onShow = routes.get(routeName);
  if (onShow) onShow(param);
  onNavigate(routeName, param);
}

export function route(view) {
  return currentView;
}
