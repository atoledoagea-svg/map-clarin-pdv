// ============ Estado de la aplicación ============
let map;
let markers = [];
let lugares = [];
let lugarSeleccionado = null;
let filtros = { localidades: [], partidos: [], distribuidoras: [] };
let tileLayer = null;
let estiloMapa = 'claro';

// API Key - En producción, esto debe venir de una variable de entorno o configuración segura
// Por ahora, se puede configurar desde el servidor o usar una variable de entorno del cliente
const API_KEY = window.API_KEY || 'clarin-secret-key-2024-change-in-production';

/**
 * Helper para hacer peticiones autenticadas a la API
 */
async function apiRequest(url, options = {}) {
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('No autorizado. Verifica la API key.');
    }
    if (response.status === 429) {
      throw new Error('Demasiadas solicitudes. Por favor espera un momento.');
    }
    throw new Error(`Error HTTP: ${response.status}`);
  }
  
  return response;
}

// Filtros activos (todos son arrays)
let filtrosActivos = {
  partidos: [],
  localidades: [],
  estados: [],
  distribuidoras: [],
  diass: [],
  horarios: [],
  escaparates: [],
  fachadas: [],
  venta_no_editorials: [],
  repartos: [],
  suscripcioness: [],
  usa_parada_onlines: [],
  mayor_ventas: []
};

// Estilos de mapa disponibles
const ESTILOS_MAPA = {
  oscuro: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  claro: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

// Colores de marcadores estilo Clarín
const MARKER_COLORS = {
  abierto: '#4CAF50',      // Verde
  cerrado: '#E31837',      // Rojo Clarín
  desconocido: '#FF9800'   // Naranja
};

// ============ Inicialización ============
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  cargarFiltros();
  cargarLugares();
  initEventListeners();
  initAutocompletado();
  cargarFiltrosGuardados();
  
  // Verificar que las funciones estén disponibles
  console.log('Funciones disponibles:', {
    guardarFiltroActual: typeof guardarFiltroActual,
    mostrarDialogoGuardarFiltro: typeof mostrarDialogoGuardarFiltro
  });
  
  // Asegurar que el botón de guardar funcione (event listener adicional como respaldo)
  const btnGuardar = document.querySelector('.btn-save-filter');
  if (btnGuardar) {
    console.log('Botón guardar encontrado, agregando event listener adicional');
    btnGuardar.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Botón guardar clickeado (event listener)');
      mostrarDialogoGuardarFiltro(e);
    });
  } else {
    console.warn('Botón guardar no encontrado en el DOM');
  }
  
  // Cargar modo guardado
  const modoGuardado = localStorage.getItem('modoTema');
  if (modoGuardado) {
    cambiarModo(modoGuardado);
  }
  
  // Cargar filtros desde URL si existen
  cargarFiltrosDesdeURL();
  
  // Iniciar tour si es necesario
  iniciarTourSiEsNecesario();
  setInterval(actualizarHora, 1000);
});

function initMap() {
  // Límites del Gran Buenos Aires
  const GBA_BOUNDS = [
    [-35.00, -59.00], // Suroeste
    [-34.30, -58.00]  // Noreste
  ];

  // Centrar en Buenos Aires / Avellaneda con límites
  map = L.map('map', {
    zoomControl: false,
    maxBounds: GBA_BOUNDS,        // No permite salir del GBA
    maxBoundsViscosity: 1.0,      // Rebote suave en los bordes
    minZoom: 10,                  // Zoom mínimo (no se puede alejar mucho)
    maxZoom: 19                   // Zoom máximo
  }).setView([-34.65, -58.45], 11);

  // Controles de zoom
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Estilo inicial del mapa (claro)
  tileLayer = L.tileLayer(ESTILOS_MAPA.claro.url, {
    attribution: ESTILOS_MAPA.claro.attribution,
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
}

// Función para cambiar modo (oscuro/claro) - afecta mapa e interfaz
function cambiarModo(modo) {
  if (modo === estiloMapa) return;
  
  estiloMapa = modo;
  
  // Cambiar clase del body para modo oscuro/claro de la interfaz
  if (modo === 'oscuro') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  // Remover capa anterior del mapa
  if (tileLayer) {
    map.removeLayer(tileLayer);
  }
  
  // Agregar nueva capa del mapa
  tileLayer = L.tileLayer(ESTILOS_MAPA[modo].url, {
    attribution: ESTILOS_MAPA[modo].attribution,
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
  
  // Actualizar botones
  document.getElementById('btn-modo-oscuro')?.classList.toggle('active', modo === 'oscuro');
  document.getElementById('btn-modo-claro')?.classList.toggle('active', modo === 'claro');
  
  // Guardar preferencia en localStorage
  localStorage.setItem('modoTema', modo);
}

function initEventListeners() {
  // Buscador
  const buscador = document.getElementById('buscar-lugar');
  if (buscador) {
    buscador.addEventListener('input', filtrarLugares);
  }

}

// Toggle categoría colapsable
function toggleCategory(header) {
  const category = header.closest('.filter-category');
  category.classList.toggle('collapsed');
}

// Toggle chip de filtro
function toggleChip(chip) {
  chip.classList.toggle('active');
  
  const tipo = chip.dataset.tipo;
  const valor = chip.dataset.valor;
  
  if (tipo && valor) {
    // Es un filtro dinámico
    const key = tipo + 's';
    if (!filtrosActivos[key]) filtrosActivos[key] = [];
    
    if (chip.classList.contains('active')) {
      if (!filtrosActivos[key].includes(valor)) {
        filtrosActivos[key].push(valor);
      }
    } else {
      const idx = filtrosActivos[key].indexOf(valor);
      if (idx > -1) filtrosActivos[key].splice(idx, 1);
    }
  }
  
  actualizarFiltrosActivos();
  filtrarLugares();
}

// Actualizar visualización de filtros activos
function actualizarFiltrosActivos() {
  const container = document.getElementById('active-filters');
  const tagsContainer = document.getElementById('active-filters-tags');
  
  let tags = [];
  
  // Iconos por tipo de filtro
  const iconos = {
    partido: '📍',
    localidad: '🏘️',
    estado: '📊',
    distribuidora: '🚚',
    dias: '📅',
    horario: '🕐',
    escaparate: '🪟',
    fachada: '🏠',
    venta_no_editorial: '📦',
    reparto: '🛵',
    suscripciones: '📰',
    usa_parada_online: '💻'
  };
  
  // Filtros dinámicos (todos son arrays)
  Object.keys(filtrosActivos).forEach(key => {
    if (Array.isArray(filtrosActivos[key])) {
      const tipo = key.slice(0, -1); // Quitar la 's' final
      const icono = iconos[tipo] || '';
      filtrosActivos[key].forEach(val => {
        tags.push({ label: `${icono} ${val}`, tipo: tipo, valor: val });
      });
    }
  });
  
  // Mostrar/ocultar sección
  container.style.display = tags.length > 0 ? 'block' : 'none';
  
  // Renderizar tags
  tagsContainer.innerHTML = tags.map(tag => `
    <span class="active-tag">
      ${tag.label}
      <button class="active-tag-remove" onclick="removeFilter('${tag.tipo}', '${tag.valor || ''}')">&times;</button>
    </span>
  `).join('');
  
  // Actualizar contadores de categorías
  actualizarContadoresCategorias();
}

function removeFilter(tipo, valor) {
  const key = tipo + 's';
  
  if (filtrosActivos[key]) {
    const idx = filtrosActivos[key].indexOf(valor);
    if (idx > -1) filtrosActivos[key].splice(idx, 1);
  }
  
  // Buscar y desactivar el chip
  let chip = document.querySelector(`.filter-chip[data-tipo="${tipo}"][data-valor="${valor}"]`);
  if (chip) {
    chip.classList.remove('active');
  }
  
  // Desactivar checkbox del dropdown si aplica
  if (tipo === 'partido' || tipo === 'localidad') {
    const menuId = tipo === 'partido' ? 'menu-partidos' : 'menu-localidades';
    const menu = document.getElementById(menuId);
    if (menu) {
      const items = menu.querySelectorAll('.dropdown-item');
      items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.value === valor) {
          checkbox.checked = false;
          item.classList.remove('selected');
        }
      });
    }
    // Actualizar texto del dropdown
    actualizarTextoDropdown(key);
  }
  
  actualizarFiltrosActivos();
  filtrarLugares();
  
  // Si no hay filtros de ubicación, volver al zoom general
  if (filtrosActivos.partidos.length === 0 && filtrosActivos.localidades.length === 0) {
    volverAZoomGeneral();
  }
}

function actualizarContadoresCategorias() {
  // Contar filtros activos por categoría
  const counts = {
    estado: filtrosActivos.estados?.length || 0,
    distribuidora: filtrosActivos.distribuidoras?.length || 0,
    dias: filtrosActivos.diass?.length || 0,
    horario: filtrosActivos.horarios?.length || 0,
    escaparate: filtrosActivos.escaparates?.length || 0,
    fachada: filtrosActivos.fachadas?.length || 0,
    venta_no_editorial: filtrosActivos.venta_no_editorials?.length || 0,
    reparto: filtrosActivos.repartos?.length || 0,
    suscripciones: filtrosActivos.suscripcioness?.length || 0,
    usa_parada_online: filtrosActivos.usa_parada_onlines?.length || 0,
    mayor_venta: filtrosActivos.mayor_ventas?.length || 0
  };
  
  Object.keys(counts).forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) {
      el.textContent = counts[cat];
      el.classList.toggle('has-active', counts[cat] > 0);
    }
  });
}

// ============ API Calls ============
async function cargarLugares() {
  try {
    mostrarLoading(true);
    
    // Timeout de 30 segundos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: El servidor no respondió en 30 segundos')), 30000);
    });
    
    const fetchPromise = apiRequest('/api/lugares');
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    lugares = await response.json();
    
    if (!lugares || lugares.length === 0) {
      console.warn('No se recibieron lugares');
    }
    
    llenarFiltrosDinamicos();
    renderizarLugares();
    renderizarMarcadores();
    ajustarVistaAMarcadores();
    
    // Pequeño delay para mostrar el progreso completo
    setTimeout(() => {
      mostrarLoading(false);
    }, 500);
  } catch (error) {
    console.error('Error cargando lugares:', error);
    mostrarLoading(false);
    
    let mensaje = 'Error cargando datos. ';
    if (error.message.includes('Timeout')) {
      mensaje += 'El servidor está tardando mucho en responder. Verificá la conexión.';
    } else if (error.message.includes('Failed to fetch')) {
      mensaje += 'No se pudo conectar al servidor. Verificá que esté corriendo.';
    } else {
      mensaje += 'Verificá que el Sheet esté compartido públicamente.';
    }
    
    showError(mensaje);
  }
}

async function cargarFiltros() {
  try {
    const response = await apiRequest('/api/filtros');
    filtros = await response.json();
    
    // Llenar dropdown de partidos
    const menuPartidos = document.getElementById('menu-partidos');
    if (menuPartidos) {
      menuPartidos.innerHTML = filtros.partidos.map(partido => `
        <div class="dropdown-item" onclick="toggleDropdownItem('partidos', '${partido}', event)">
          <input type="checkbox" id="chk-partido-${partido}" value="${partido}">
          <label for="chk-partido-${partido}">${partido}</label>
        </div>
      `).join('');
    }

    // Llenar dropdown de localidades
    const menuLocalidades = document.getElementById('menu-localidades');
    if (menuLocalidades) {
      menuLocalidades.innerHTML = filtros.localidades.map(localidad => `
        <div class="dropdown-item" onclick="toggleDropdownItem('localidades', '${localidad}', event)">
          <input type="checkbox" id="chk-localidad-${localidad.replace(/\s+/g, '-')}" value="${localidad}">
          <label for="chk-localidad-${localidad.replace(/\s+/g, '-')}">${localidad}</label>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error cargando filtros:', error);
  }
}

// Toggle menú dropdown
function toggleDropdownMenu(tipo) {
  const dropdown = document.getElementById(`dropdown-${tipo}`);
  const isOpen = dropdown.classList.contains('open');
  
  // Cerrar todos los dropdowns
  document.querySelectorAll('.dropdown-multiselect.open').forEach(d => d.classList.remove('open'));
  
  // Abrir el actual si estaba cerrado
  if (!isOpen) {
    dropdown.classList.add('open');
  }
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-multiselect')) {
    document.querySelectorAll('.dropdown-multiselect.open').forEach(d => d.classList.remove('open'));
  }
});

// Toggle item del dropdown
function toggleDropdownItem(tipo, valor, event) {
  event.stopPropagation();
  
  const item = event.currentTarget;
  const checkbox = item.querySelector('input[type="checkbox"]');
  
  // Toggle checkbox
  checkbox.checked = !checkbox.checked;
  item.classList.toggle('selected', checkbox.checked);
  
  // Actualizar filtros activos
  if (checkbox.checked) {
    if (!filtrosActivos[tipo].includes(valor)) {
      filtrosActivos[tipo].push(valor);
    }
  } else {
    const idx = filtrosActivos[tipo].indexOf(valor);
    if (idx > -1) filtrosActivos[tipo].splice(idx, 1);
  }
  
  // Actualizar texto del dropdown
  actualizarTextoDropdown(tipo);
  
  actualizarFiltrosActivos();
  filtrarLugares();
  
  // Si hay filtros de ubicación activos, ajustar vista; si no, volver al zoom general
  if (filtrosActivos.partidos.length > 0 || filtrosActivos.localidades.length > 0) {
    ajustarVistaAMarcadores();
  } else {
    volverAZoomGeneral();
  }
}

// Volver al zoom general del GBA
function volverAZoomGeneral() {
  if (map) {
    map.setView([-34.65, -58.45], 11, {
      animate: true,
      duration: 0.5
    });
  }
}

// Actualizar texto del dropdown
function actualizarTextoDropdown(tipo) {
  const textEl = document.getElementById(`text-${tipo}`);
  const selected = filtrosActivos[tipo];
  
  if (selected.length === 0) {
    textEl.textContent = 'Seleccionar...';
    textEl.classList.remove('has-selection');
  } else if (selected.length === 1) {
    textEl.textContent = selected[0];
    textEl.classList.add('has-selection');
  } else {
    textEl.textContent = `${selected.length} seleccionados`;
    textEl.classList.add('has-selection');
  }
}

// Toggle dropdown visibility
function toggleDropdown(tipo, e) {
  if (e) e.stopPropagation();
  
  const container = document.getElementById(`container-${tipo}`);
  const isOpen = container.classList.contains('open');
  
  // Cerrar todos los dropdowns
  document.querySelectorAll('.multi-select-container.open').forEach(c => c.classList.remove('open'));
  
  // Abrir el actual si estaba cerrado
  if (!isOpen) {
    container.classList.add('open');
  }
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.multi-select-container')) {
    document.querySelectorAll('.multi-select-container.open').forEach(c => c.classList.remove('open'));
  }
});

// Toggle opción del multi-select (no usado actualmente)
function toggleMultiSelectOption(tipo, valor, element) {
  event.stopPropagation();
  
  element.classList.toggle('selected');
  const key = tipo;
  
  if (element.classList.contains('selected')) {
    if (!filtrosActivos[key].includes(valor)) {
      filtrosActivos[key].push(valor);
    }
  } else {
    const idx = filtrosActivos[key].indexOf(valor);
    if (idx > -1) filtrosActivos[key].splice(idx, 1);
  }
  
  actualizarFiltrosActivos();
  filtrarLugares();
  ajustarVistaAMarcadores();
}

// Actualizar texto del placeholder
function actualizarPlaceholderMultiSelect(tipo) {
  const placeholder = document.getElementById(`placeholder-${tipo}`);
  const selected = filtrosActivos[tipo];
  
  if (selected.length === 0) {
    placeholder.textContent = tipo === 'partidos' ? 'Seleccionar partidos...' : 'Seleccionar localidades...';
    placeholder.classList.remove('has-selection');
  } else if (selected.length === 1) {
    placeholder.textContent = selected[0];
    placeholder.classList.add('has-selection');
  } else {
    placeholder.textContent = `${selected.length} seleccionados`;
    placeholder.classList.add('has-selection');
  }
}

// Llenar checkboxes dinámicos después de cargar lugares
function llenarFiltrosDinamicos() {
  // Extraer valores únicos de los lugares
  const estados = [...new Set(lugares.map(l => l.estado).filter(Boolean))];
  const distribuidoras = [...new Set(lugares.map(l => l.distribuidora).filter(Boolean))];
  const dias = [...new Set(lugares.map(l => l.dias_atencion).filter(Boolean))];
  const horarios = [...new Set(lugares.map(l => l.horario).filter(Boolean))];
  const escaparates = [...new Set(lugares.map(l => l.escaparate).filter(Boolean))];
  const fachadas = [...new Set(lugares.map(l => l.fachada).filter(Boolean))];
  const ventaNoEditorial = [...new Set(lugares.map(l => l.venta_no_editorial).filter(Boolean))];
  const repartos = [...new Set(lugares.map(l => l.reparto).filter(Boolean))];
  const suscripciones = [...new Set(lugares.map(l => l.suscripciones).filter(Boolean))];
  const paradaOnline = [...new Set(lugares.map(l => l.usa_parada_online).filter(Boolean))];
  const mayorVenta = [...new Set(lugares.map(l => l.mayor_venta).filter(Boolean))];

  // Llenar grupo de estados
  llenarGrupoCheckboxes('filtro-estado-grupo', estados, 'estado');
  
  // Llenar grupo de distribuidoras
  llenarGrupoCheckboxes('filtro-distribuidora-grupo', distribuidoras, 'distribuidora');
  
  // Llenar grupo de días
  llenarGrupoCheckboxes('filtro-dias-grupo', dias, 'dias');
  
  // Llenar grupo de horarios
  llenarGrupoCheckboxes('filtro-horario-grupo', horarios, 'horario');
  
  // Llenar grupo de escaparate
  llenarGrupoCheckboxes('filtro-escaparate-grupo', escaparates, 'escaparate');
  
  // Llenar grupo de fachada
  llenarGrupoCheckboxes('filtro-fachada-grupo', fachadas, 'fachada');
  
  // Llenar grupo de venta no editorial
  llenarGrupoCheckboxes('filtro-venta_no_editorial-grupo', ventaNoEditorial, 'venta_no_editorial');
  
  // Llenar grupo de reparto
  llenarGrupoCheckboxes('filtro-reparto-grupo', repartos, 'reparto');
  
  // Llenar grupo de suscripciones
  llenarGrupoCheckboxes('filtro-suscripciones-grupo', suscripciones, 'suscripciones');
  
  // Llenar grupo de parada online
  llenarGrupoCheckboxes('filtro-usa_parada_online-grupo', paradaOnline, 'usa_parada_online');
  
  // Llenar grupo de mayor venta
  llenarGrupoCheckboxes('filtro-mayor_venta-grupo', mayorVenta, 'mayor_venta');
}

function llenarGrupoCheckboxes(containerId, valores, tipo) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Iconos por tipo
  const iconos = {
    estado: { 'Abierto': '✅', 'Cerrado ahora': '🔴', 'Abre ocasionalmente': '🟡', 'Cerrado pero hace reparto': '🛵' },
    distribuidora: '🚚',
    dias: '📅',
    horario: '🕐',
    ubicacion: '📍',
    mayorVenta: '💰'
  };
  
  container.innerHTML = valores.map(valor => {
    let icono = '';
    if (typeof iconos[tipo] === 'object') {
      icono = iconos[tipo][valor] || '';
    } else if (iconos[tipo]) {
      icono = iconos[tipo];
    }
    
    return `
      <button class="filter-chip" data-tipo="${tipo}" data-valor="${valor}" onclick="toggleChip(this)">
        ${icono} ${valor}
      </button>
    `;
  }).join('');
}


// ============ Renderizado ============
function aplicarFiltros(lugar) {
  const busquedaDesktop = document.getElementById('buscar-lugar')?.value?.toLowerCase() || '';
  const busquedaMobile = document.getElementById('mobile-buscar-lugar')?.value?.toLowerCase() || '';
  const busqueda = busquedaDesktop || busquedaMobile;

  // Búsqueda por texto (incluye paquete)
  if (busqueda) {
    const textoLugar = `${lugar.nombre} ${lugar.direccion} ${lugar.localidad} ${lugar.partido} ${lugar.contacto_nombre} ${lugar.paquete || ''}`.toLowerCase();
    if (!textoLugar.includes(busqueda)) return false;
  }

  // Filtros de partidos (múltiples)
  if (filtrosActivos.partidos && filtrosActivos.partidos.length > 0) {
    if (!filtrosActivos.partidos.includes(lugar.partido)) return false;
  }
  
  // Filtros de localidades (múltiples)
  if (filtrosActivos.localidades && filtrosActivos.localidades.length > 0) {
    if (!filtrosActivos.localidades.includes(lugar.localidad)) return false;
  }
  
  // Filtro de estados
  if (filtrosActivos.estados && filtrosActivos.estados.length > 0) {
    if (!filtrosActivos.estados.includes(lugar.estado)) return false;
  }
  
  // Filtro de distribuidoras
  if (filtrosActivos.distribuidoras && filtrosActivos.distribuidoras.length > 0) {
    if (!filtrosActivos.distribuidoras.includes(lugar.distribuidora)) return false;
  }
  
  // Filtro de días
  if (filtrosActivos.diass && filtrosActivos.diass.length > 0) {
    if (!filtrosActivos.diass.includes(lugar.dias_atencion)) return false;
  }
  
  // Filtro de horarios
  if (filtrosActivos.horarios && filtrosActivos.horarios.length > 0) {
    if (!filtrosActivos.horarios.includes(lugar.horario)) return false;
  }
  
  // Filtro de escaparate
  if (filtrosActivos.escaparates && filtrosActivos.escaparates.length > 0) {
    if (!filtrosActivos.escaparates.includes(lugar.escaparate)) return false;
  }
  
  // Filtro de fachada
  if (filtrosActivos.fachadas && filtrosActivos.fachadas.length > 0) {
    if (!filtrosActivos.fachadas.includes(lugar.fachada)) return false;
  }
  
  // Filtro de venta no editorial
  if (filtrosActivos.venta_no_editorials && filtrosActivos.venta_no_editorials.length > 0) {
    if (!filtrosActivos.venta_no_editorials.includes(lugar.venta_no_editorial)) return false;
  }
  
  // Filtro de reparto
  if (filtrosActivos.repartos && filtrosActivos.repartos.length > 0) {
    if (!filtrosActivos.repartos.includes(lugar.reparto)) return false;
  }
  
  // Filtro de suscripciones
  if (filtrosActivos.suscripcioness && filtrosActivos.suscripcioness.length > 0) {
    if (!filtrosActivos.suscripcioness.includes(lugar.suscripciones)) return false;
  }
  
  // Filtro de parada online
  if (filtrosActivos.usa_parada_onlines && filtrosActivos.usa_parada_onlines.length > 0) {
    if (!filtrosActivos.usa_parada_onlines.includes(lugar.usa_parada_online)) return false;
  }
  
  // Filtro de mayor venta
  if (filtrosActivos.mayor_ventas && filtrosActivos.mayor_ventas.length > 0) {
    if (!filtrosActivos.mayor_ventas.includes(lugar.mayor_venta)) return false;
  }
  
  return true;
}

function renderizarLugares() {
  let lugaresFiltrados = lugares.filter(aplicarFiltros);

  // Actualizar contador
  const countEl = document.getElementById('lugares-count');
  if (countEl) {
    countEl.textContent = lugaresFiltrados.length;
  }
}

function renderizarMarcadores() {
  // Limpiar marcadores existentes
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  const lugaresFiltrados = lugares.filter(aplicarFiltros);

  lugaresFiltrados.forEach(lugar => {
    if (!lugar.latitud || !lugar.longitud) return;

    const color = lugar.estaAbierto === true ? MARKER_COLORS.abierto : 
                  lugar.estaAbierto === false ? MARKER_COLORS.cerrado : 
                  MARKER_COLORS.desconocido;

    // Crear icono personalizado
    const customIcon = L.divIcon({
      className: 'custom-marker-container',
      html: `
        <div class="custom-marker" style="background: ${color}">
          <span class="custom-marker-inner">🏪</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });

    const marker = L.marker([lugar.latitud, lugar.longitud], { icon: customIcon })
      .addTo(map)
      .bindPopup(crearPopupContent(lugar));

    marker.lugarId = lugar.id;

    marker.on('click', () => {
      lugarSeleccionado = lugar.id;
      renderizarLugares();
      scrollToLugar(lugar.id);
    });

    markers.push(marker);
  });
}

function crearPopupContent(lugar) {
  return `
    <div class="popup-content">
      <h3>${lugar.nombre || 'Sin nombre'}</h3>
      <span class="popup-estado ${getEstadoClase(lugar.estaAbierto)}">
        ${getEstadoTexto(lugar.estado)}
      </span>
      
      ${lugar.direccion ? `<p class="popup-direccion">📍 ${lugar.direccion}</p>` : ''}
      ${lugar.localidad ? `<p class="popup-localidad">${lugar.localidad}, ${lugar.partido}</p>` : ''}
      
      <div class="popup-details">
        ${lugar.contacto_nombre ? `<p>👤 ${lugar.contacto_nombre}</p>` : ''}
        ${lugar.telefono ? `<p>📞 <a href="tel:${lugar.telefono}">${lugar.telefono}</a></p>` : ''}
        ${lugar.email ? `<p>✉️ <a href="mailto:${lugar.email}">${lugar.email}</a></p>` : ''}
        ${lugar.horario ? `<p>🕐 ${lugar.horario}</p>` : ''}
        ${lugar.dias_atencion ? `<p>📅 ${lugar.dias_atencion}</p>` : ''}
        ${lugar.distribuidora ? `<p>🚚 ${lugar.distribuidora}</p>` : ''}
      </div>
      
      ${lugar.imagen ? `<img src="${lugar.imagen}" class="popup-img" alt="Foto del kiosco" onerror="this.style.display='none'">` : ''}
    </div>
  `;
}

function ajustarVistaAMarcadores() {
  if (markers.length === 0) return;
  
  const group = new L.featureGroup(markers);
  const bounds = group.getBounds();
  
  // Si hay pocos marcadores, hacer más zoom
  const maxZoom = markers.length <= 5 ? 16 : markers.length <= 15 ? 15 : 14;
  
  map.fitBounds(bounds.pad(0.1), {
    maxZoom: maxZoom,
    animate: true,
    duration: 0.5
  });
}

// ============ Utilidades ============
function getEstadoClase(estaAbierto) {
  if (estaAbierto === true) return 'abierto';
  if (estaAbierto === false) return 'cerrado';
  return 'desconocido';
}

function getEstadoTexto(estado) {
  if (!estado) return 'Sin info';
  return estado;
}

function seleccionarLugar(id) {
  lugarSeleccionado = id;
  renderizarLugares();
  
  const lugar = lugares.find(l => l.id == id);
  if (lugar && lugar.latitud && lugar.longitud) {
    map.setView([lugar.latitud, lugar.longitud], 17);
    
    // Abrir popup del marcador
    const marker = markers.find(m => m.lugarId == id);
    if (marker) {
      marker.openPopup();
    }
  }
}

function scrollToLugar(id) {
  const card = document.querySelector(`.lugar-card[data-id="${id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function filtrarLugares() {
  renderizarLugares();
  renderizarMarcadores();
}

function showLoading(show) {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

function showError(message) {
  console.error(message);
  alert('⚠️ ' + message);
}

function limpiarFiltros() {
  // Resetear buscador
  const buscador = document.getElementById('buscar-lugar');
  if (buscador) buscador.value = '';
  
  const mobileBuscador = document.getElementById('mobile-buscar-lugar');
  if (mobileBuscador) mobileBuscador.value = '';
  
  // Resetear filtros activos
  filtrosActivos = {
    partidos: [],
    localidades: [],
    estados: [],
    distribuidoras: [],
    diass: [],
    horarios: [],
    escaparates: [],
    fachadas: [],
    venta_no_editorials: [],
    repartos: [],
    suscripcioness: [],
    usa_parada_onlines: [],
    mayor_ventas: []
  };
  
  // Desactivar todos los chips
  document.querySelectorAll('.filter-chip.active').forEach(chip => {
    chip.classList.remove('active');
  });
  
  // Resetear dropdowns de ubicación
  document.querySelectorAll('.dropdown-item.selected').forEach(item => {
    item.classList.remove('selected');
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  });
  
  // Resetear textos de dropdowns
  const textPartidos = document.getElementById('text-partidos');
  const textLocalidades = document.getElementById('text-localidades');
  if (textPartidos) {
    textPartidos.textContent = 'Seleccionar...';
    textPartidos.classList.remove('has-selection');
  }
  if (textLocalidades) {
    textLocalidades.textContent = 'Seleccionar...';
    textLocalidades.classList.remove('has-selection');
  }
  
  actualizarFiltrosActivos();
  filtrarLugares();
  volverAZoomGeneral();
}

// ============ Autocompletado ============
function initAutocompletado() {
  // Autocompletado para desktop
  const input = document.getElementById('buscar-lugar');
  const suggestions = document.getElementById('search-suggestions');
  
  if (input && suggestions) {
    setupAutocompletado(input, suggestions);
  }
  
  // Autocompletado para móvil
  const mobileInput = document.getElementById('mobile-buscar-lugar');
  const mobileSuggestions = document.getElementById('mobile-search-suggestions');
  
  if (mobileInput && mobileSuggestions) {
    setupAutocompletado(mobileInput, mobileSuggestions);
  }
}

function setupAutocompletado(input, suggestions) {
  // Event listener único para input que maneja sugerencias y sincronización
  input.addEventListener('input', (e) => {
    const query = e.target.value;
    const queryLower = query.toLowerCase().trim();
    
    // Sincronizar con el otro input si existe
    if (input.id === 'buscar-lugar') {
      const mobileInput = document.getElementById('mobile-buscar-lugar');
      if (mobileInput && mobileInput.value !== query) {
        mobileInput.value = query;
      }
    } else if (input.id === 'mobile-buscar-lugar') {
      const desktopInput = document.getElementById('buscar-lugar');
      if (desktopInput && desktopInput.value !== query) {
        desktopInput.value = query;
      }
    }
    
    // Mostrar sugerencias mientras se escribe
    if (queryLower.length < 2) {
      suggestions.classList.remove('active');
      suggestions.innerHTML = '';
      // Aplicar filtro aunque no haya sugerencias
      filtrarLugares();
      return;
    }
    
    // Buscar coincidencias
    const matches = lugares.filter(lugar => {
      const texto = `${lugar.nombre} ${lugar.direccion} ${lugar.localidad} ${lugar.partido} ${lugar.paquete || ''}`.toLowerCase();
      return texto.includes(queryLower);
    }).slice(0, 8); // Máximo 8 sugerencias
    
    if (matches.length === 0) {
      suggestions.classList.remove('active');
      suggestions.innerHTML = '';
    } else {
      // Mostrar sugerencias
      suggestions.innerHTML = matches.map(lugar => `
        <div class="search-suggestion-item" onclick="seleccionarSugerencia(${lugar.id})">
          <div class="suggestion-name">${lugar.nombre}</div>
          <div class="suggestion-address">${lugar.direccion}, ${lugar.localidad}</div>
          ${lugar.paquete ? `<div class="suggestion-paquete">Paquete: ${lugar.paquete}</div>` : ''}
        </div>
      `).join('');
      
      suggestions.classList.add('active');
    }
    
    // Aplicar filtro en tiempo real
    filtrarLugares();
  });
  
  // Cerrar sugerencias al presionar Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestions.classList.remove('active');
      if (input.id === 'mobile-buscar-lugar') {
        toggleMobileSearchPopup();
      }
    }
  });
  
  // Cerrar sugerencias al hacer clic fuera (solo para el contenedor específico)
  const container = input.closest('.search-box-container');
  if (container) {
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        suggestions.classList.remove('active');
      }
    });
  }
}

function seleccionarSugerencia(id) {
  const lugar = lugares.find(l => l.id == id);
  if (!lugar) return;
  
  // Poner el nombre en ambos buscadores
  const input = document.getElementById('buscar-lugar');
  if (input) input.value = lugar.nombre;
  
  const mobileInput = document.getElementById('mobile-buscar-lugar');
  if (mobileInput) mobileInput.value = lugar.nombre;
  
  // Cerrar sugerencias
  const suggestions = document.getElementById('search-suggestions');
  if (suggestions) suggestions.classList.remove('active');
  
  const mobileSuggestions = document.getElementById('mobile-search-suggestions');
  if (mobileSuggestions) mobileSuggestions.classList.remove('active');
  
  // Cerrar popup móvil si está abierto
  const popup = document.getElementById('mobile-search-popup');
  if (popup && popup.classList.contains('active')) {
    toggleMobileSearchPopup();
  }
  
  // Centrar en el lugar
  if (lugar.latitud && lugar.longitud) {
    map.setView([lugar.latitud, lugar.longitud], 17, { animate: true });
    
    // Buscar y abrir el popup del marcador
    const marker = markers.find(m => m.lugarId == id);
    if (marker) {
      marker.openPopup();
    }
  }
  
  // Aplicar filtro
  filtrarLugares();
}

// ============ Control de Filtros ============
function expandirTodosFiltros() {
  document.querySelectorAll('.filter-category.collapsed').forEach(cat => {
    cat.classList.remove('collapsed');
  });
}

function contraerTodosFiltros() {
  document.querySelectorAll('.filter-category:not(.collapsed)').forEach(cat => {
    cat.classList.add('collapsed');
  });
}

// ============ Indicador de Carga Mejorado ============
const loadingTips = [
  '💡 Consejo: Usa el buscador para encontrar puntos por nombre, dirección o paquete',
  '⌨️ Atajo: Presiona F para enfocar el buscador rápidamente',
  '📍 Tip: Selecciona múltiples partidos y localidades para filtrar mejor',
  '⭐ Pro tip: Guarda tus filtros favoritos para reutilizarlos después',
  '🌙 Tip: Cambia entre modo claro y oscuro según tu preferencia',
  '📥 Consejo: Exporta los resultados filtrados a Excel con el botón Exportar',
  '🔍 Tip: Usa el autocompletado del buscador para encontrar puntos más rápido',
  '🗺️ Consejo: Haz clic en un marcador del mapa para ver los detalles del punto',
  '⌨️ Atajo: Presiona R para resetear la vista del mapa',
  '📊 Tip: Los filtros se pueden combinar para búsquedas más específicas'
];

let currentTipIndex = 0;
let loadingTipInterval = null;

function mostrarLoading(mostrar = true) {
  const overlay = document.getElementById('loading-overlay');
  const progressBar = document.getElementById('loading-progress-bar');
  
  if (!overlay) {
    console.warn('Loading overlay no encontrado');
    return;
  }
  
  if (mostrar) {
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
    currentTipIndex = 0;
    actualizarTip();
    iniciarRotacionTips();
    // Simular progreso
    let progreso = 0;
    const intervalo = setInterval(() => {
      progreso += Math.random() * 15;
      if (progreso > 90) progreso = 90;
      if (progressBar) {
        progressBar.style.width = `${progreso}%`;
      }
    }, 200);
    
    // Guardar intervalo para limpiarlo después
    overlay.dataset.progressInterval = intervalo;
  } else {
    // Asegurar que se oculte completamente
    overlay.classList.add('hidden');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
    
    detenerRotacionTips();
    if (progressBar) {
      progressBar.style.width = '100%';
      setTimeout(() => {
        progressBar.style.width = '0%';
      }, 300);
    }
    // Limpiar intervalo de progreso
    if (overlay.dataset.progressInterval) {
      clearInterval(parseInt(overlay.dataset.progressInterval));
      delete overlay.dataset.progressInterval;
    }
  }
}

function actualizarTip() {
  const tipElement = document.getElementById('loading-tip');
  if (tipElement && loadingTips.length > 0) {
    tipElement.textContent = loadingTips[currentTipIndex];
  }
}

function iniciarRotacionTips() {
  detenerRotacionTips();
  loadingTipInterval = setInterval(() => {
    currentTipIndex = (currentTipIndex + 1) % loadingTips.length;
    actualizarTip();
  }, 4000); // Cambiar tip cada 4 segundos
}

function detenerRotacionTips() {
  if (loadingTipInterval) {
    clearInterval(loadingTipInterval);
    loadingTipInterval = null;
  }
}

// ============ Filtros Guardados ============
let filtrosGuardados = [];

// Cargar filtros guardados al iniciar
function cargarFiltrosGuardados() {
  try {
    const guardados = localStorage.getItem('filtrosGuardados');
    if (guardados) {
      filtrosGuardados = JSON.parse(guardados);
      // Asegurar que sea un array
      if (!Array.isArray(filtrosGuardados)) {
        filtrosGuardados = [];
      }
    } else {
      filtrosGuardados = [];
    }
    // Renderizar siempre para mostrar el estado actual
    renderizarFiltrosGuardados();
  } catch (error) {
    console.error('Error cargando filtros guardados:', error);
    filtrosGuardados = [];
    renderizarFiltrosGuardados();
  }
}

// Renderizar lista de filtros guardados
function renderizarFiltrosGuardados() {
  const lista = document.getElementById('saved-filters-list');
  if (!lista) {
    console.warn('Lista de filtros guardados no encontrada');
    return;
  }
  
  // Asegurar que filtrosGuardados sea un array
  if (!Array.isArray(filtrosGuardados)) {
    filtrosGuardados = [];
  }
  
  if (filtrosGuardados.length === 0) {
    lista.innerHTML = '<div class="saved-filters-empty">No hay filtros guardados</div>';
    return;
  }
  
  // Renderizar con escape de HTML para seguridad
  lista.innerHTML = filtrosGuardados.map((filtro, index) => {
    const nombreEscapado = escapeHtml(filtro.nombre || 'Sin nombre');
    return `
      <div class="saved-filter-item">
        <span class="saved-filter-name" onclick="aplicarFiltroGuardado(${index})" title="${nombreEscapado}">${nombreEscapado}</span>
        <div class="saved-filter-actions">
          <button class="btn-apply-filter" onclick="aplicarFiltroGuardado(${index})" title="Aplicar filtro">Aplicar</button>
          <button class="btn-delete-filter" onclick="eliminarFiltroGuardado(${index})" title="Eliminar filtro">×</button>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('Filtros guardados renderizados:', filtrosGuardados.length);
}

// Mostrar diálogo para guardar filtro
function mostrarDialogoGuardarFiltro(e) {
  // Prevenir comportamiento por defecto si es un evento
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  console.log('=== mostrarDialogoGuardarFiltro ejecutado ===');
  console.log('Filtros activos actuales:', filtrosActivos);
  
  const modal = document.getElementById('modal-guardar-filtro');
  const input = document.getElementById('nombre-filtro');
  
  console.log('Modal encontrado:', modal ? 'SÍ' : 'NO');
  console.log('Input encontrado:', input ? 'SÍ' : 'NO');
  
  if (!modal) {
    console.error('ERROR: Modal no encontrado en el DOM');
    alert('Error: No se pudo encontrar el modal de guardar filtro');
    return;
  }
  
  if (!input) {
    console.error('ERROR: Input no encontrado en el DOM');
    alert('Error: No se pudo encontrar el campo de nombre');
    return;
  }
  
  try {
    // Mostrar modal - usar múltiples métodos para asegurar compatibilidad
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '10000';
    modal.classList.add('active');
    
    // Limpiar y enfocar input
    input.value = '';
    setTimeout(() => {
      input.focus();
    }, 100);
    
    console.log('✅ Modal abierto correctamente');
    console.log('Estado del modal:', {
      display: modal.style.display,
      visibility: modal.style.visibility,
      opacity: modal.style.opacity,
      zIndex: modal.style.zIndex,
      hasActiveClass: modal.classList.contains('active')
    });
  } catch (error) {
    console.error('ERROR al abrir modal:', error);
    alert('Error al abrir el diálogo: ' + error.message);
  }
}

// Cerrar modal
function cerrarModalGuardarFiltro() {
  const modal = document.getElementById('modal-guardar-filtro');
  if (modal) {
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.classList.remove('active');
  }
}

// Guardar filtro actual
function guardarFiltroActual() {
  console.log('=== INICIANDO guardarFiltroActual ===');
  console.log('filtrosActivos actuales:', filtrosActivos);
  
  try {
    const nombreInput = document.getElementById('nombre-filtro');
    if (!nombreInput) {
      console.error('Input de nombre no encontrado');
      mostrarPopupConfirmacion('Error', 'No se pudo encontrar el campo de nombre', 'error');
      return;
    }
    
    const nombre = nombreInput.value?.trim();
    console.log('Nombre ingresado:', nombre);
    
    if (!nombre) {
      mostrarPopupConfirmacion('Campo requerido', 'Por favor ingresa un nombre para el filtro', 'warning');
      nombreInput.focus();
      return;
    }
    
    // Asegurar que filtrosGuardados esté inicializado
    if (!Array.isArray(filtrosGuardados)) {
      console.log('Inicializando filtrosGuardados como array vacío');
      filtrosGuardados = [];
    }
    
    // Verificar si ya existe un filtro con ese nombre
    const indiceExistente = filtrosGuardados.findIndex(f => f.nombre.toLowerCase() === nombre.toLowerCase());
    if (indiceExistente !== -1) {
      if (!confirm('Ya existe un filtro con ese nombre. ¿Deseas reemplazarlo?')) {
        return;
      }
      // Eliminar el existente
      filtrosGuardados.splice(indiceExistente, 1);
      console.log('Filtro existente eliminado, índice:', indiceExistente);
    }
    
    // Capturar estado actual de filtros
    const filtrosActuales = JSON.parse(JSON.stringify(filtrosActivos));
    const busquedaActual = document.getElementById('buscar-lugar')?.value || '';
    
    console.log('Filtros a guardar:', filtrosActuales);
    console.log('Búsqueda a guardar:', busquedaActual);
    
    // Guardar filtros actuales
    const filtroAGuardar = {
      nombre: nombre,
      filtros: filtrosActuales,
      busqueda: busquedaActual,
      fecha: new Date().toISOString()
    };
    
    console.log('Filtro completo a guardar:', filtroAGuardar);
    
    filtrosGuardados.push(filtroAGuardar);
    console.log('Total de filtros guardados:', filtrosGuardados.length);
    
    // Guardar en localStorage
    try {
      const datosParaGuardar = JSON.stringify(filtrosGuardados);
      console.log('Datos para localStorage:', datosParaGuardar);
      localStorage.setItem('filtrosGuardados', datosParaGuardar);
      
      // Verificar que se guardó
      const verificado = localStorage.getItem('filtrosGuardados');
      console.log('Verificación localStorage:', verificado ? 'OK' : 'ERROR');
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
      mostrarPopupConfirmacion('Error', 'Error al guardar en el almacenamiento local: ' + e.message, 'error');
      return;
    }
    
    // Cerrar modal primero
    cerrarModalGuardarFiltro();
    
    // Actualizar UI - forzar renderizado
    setTimeout(() => {
      console.log('Renderizando filtros guardados...');
      renderizarFiltrosGuardados();
      
      // Verificar que se renderizó
      const lista = document.getElementById('saved-filters-list');
      console.log('Lista después de renderizar:', lista?.innerHTML?.substring(0, 100));
      
      // Mostrar popup de confirmación
      mostrarPopupConfirmacion(
        'Filtro guardado',
        `El filtro "${nombre}" se ha guardado correctamente y aparecerá en la lista de filtros guardados.`,
        'success'
      );
    }, 100);
    
  } catch (error) {
    console.error('Error en guardarFiltroActual:', error);
    console.error('Stack:', error.stack);
    mostrarPopupConfirmacion('Error', 'Error al guardar el filtro: ' + error.message, 'error');
  }
}

// Mostrar popup de confirmación personalizado
function mostrarPopupConfirmacion(titulo, mensaje, tipo = 'success') {
  const overlay = document.getElementById('custom-popup-overlay');
  const titleEl = document.getElementById('custom-popup-title');
  const messageEl = document.getElementById('custom-popup-message');
  const iconEl = overlay?.querySelector('.custom-popup-icon');
  
  if (!overlay || !titleEl || !messageEl) return;
  
  // Actualizar contenido
  titleEl.textContent = titulo;
  messageEl.textContent = mensaje;
  
  // Actualizar icono según el tipo
  if (iconEl) {
    switch(tipo) {
      case 'success':
        iconEl.textContent = '✅';
        break;
      case 'error':
        iconEl.textContent = '❌';
        break;
      case 'warning':
        iconEl.textContent = '⚠️';
        break;
      default:
        iconEl.textContent = '✅';
    }
  }
  
  // Mostrar popup
  overlay.style.display = 'flex';
}

// Cerrar popup de confirmación
function cerrarPopupConfirmacion() {
  const overlay = document.getElementById('custom-popup-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Aplicar filtro guardado
function aplicarFiltroGuardado(index) {
  const filtro = filtrosGuardados[index];
  if (!filtro) return;
  
  // Restaurar filtros
  filtrosActivos = JSON.parse(JSON.stringify(filtro.filtros));
  
  // Restaurar búsqueda
  const buscador = document.getElementById('buscar-lugar');
  if (buscador) {
    buscador.value = filtro.busqueda || '';
  }
  
  // Actualizar UI de filtros
  actualizarFiltrosActivos();
  
  // Actualizar checkboxes de dropdowns
  actualizarCheckboxesFiltros();
  
  // Aplicar filtros
  filtrarLugares();
  
  // Ajustar vista si hay filtros de ubicación
  if (filtrosActivos.partidos.length > 0 || filtrosActivos.localidades.length > 0) {
    ajustarVistaAMarcadores();
  } else {
    volverAZoomGeneral();
  }
}

// Actualizar checkboxes de filtros guardados
function actualizarCheckboxesFiltros() {
  // Actualizar dropdowns de partidos y localidades
  ['partidos', 'localidades'].forEach(tipo => {
    const menu = document.getElementById(`menu-${tipo}`);
    if (menu) {
      const items = menu.querySelectorAll('.dropdown-item');
      items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
          const valor = checkbox.value;
          const estaSeleccionado = filtrosActivos[tipo]?.includes(valor);
          checkbox.checked = estaSeleccionado;
          item.classList.toggle('selected', estaSeleccionado);
        }
      });
    }
    actualizarTextoDropdown(tipo);
  });
  
  // Actualizar chips de otros filtros
  document.querySelectorAll('.filter-chip').forEach(chip => {
    const tipo = chip.getAttribute('data-tipo');
    const valor = chip.getAttribute('data-valor');
    
    if (!tipo || !valor) return;
    
    const key = tipo + 's';
    const estaActivo = filtrosActivos[key]?.includes(valor);
    chip.classList.toggle('active', estaActivo);
  });
}

// Eliminar filtro guardado
function eliminarFiltroGuardado(index) {
  const filtro = filtrosGuardados[index];
  if (!filtro) return;
  
  if (!confirm(`¿Estás seguro de eliminar el filtro "${filtro.nombre}"?`)) {
    return;
  }
  
  filtrosGuardados.splice(index, 1);
  localStorage.setItem('filtrosGuardados', JSON.stringify(filtrosGuardados));
  renderizarFiltrosGuardados();
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', (e) => {
  const modal = document.getElementById('modal-guardar-filtro');
  if (modal && e.target === modal) {
    cerrarModalGuardarFiltro();
  }
  
  // Cerrar popup de confirmación al hacer clic fuera
  const popup = document.getElementById('custom-popup-overlay');
  if (popup && e.target === popup) {
    cerrarPopupConfirmacion();
  }
});

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Si el popup está abierto, cerrarlo primero
    const popup = document.getElementById('custom-popup-overlay');
    if (popup && popup.style.display !== 'none') {
      cerrarPopupConfirmacion();
      return;
    }
    
    // Si el modal está abierto, cerrarlo
    const modal = document.getElementById('modal-guardar-filtro');
    if (modal && modal.style.display !== 'none') {
      cerrarModalGuardarFiltro();
      return;
    }
    // Si no, limpiar filtros
    limpiarFiltros();
  }
});

// ============ Tour Guiado ============
let tourActual = null;
let pasoActual = 0;

const pasosTour = [
  {
    titulo: '¡Bienvenido a Puntos de Venta Clarín!',
    descripcion: 'Este tour te ayudará a conocer las funciones principales de la aplicación. Puedes saltarlo en cualquier momento.',
    elemento: null,
    posicion: 'center'
  },
  {
    titulo: 'Búsqueda de puntos de venta',
    descripcion: 'Usa el buscador para encontrar puntos por nombre, dirección o número de paquete. También puedes usar el atajo de teclado <kbd>F</kbd>.',
    elemento: 'buscar-lugar',
    posicion: 'bottom'
  },
  {
    titulo: 'Filtros de ubicación',
    descripcion: 'Selecciona partidos y localidades para filtrar los puntos de venta en el mapa. Puedes seleccionar múltiples opciones.',
    elemento: '.map-location-filters',
    posicion: 'bottom'
  },
  {
    titulo: 'Filtros avanzados',
    descripcion: 'En el panel lateral puedes filtrar por estado, distribuidora, horarios y más características. Usa los botones "Expandir filtros" y "Contraer filtros" para gestionar todas las secciones.',
    elemento: '.filters-section',
    posicion: 'right'
  },
  {
    titulo: 'Filtros guardados',
    descripcion: 'Guarda tus combinaciones de filtros favoritas para reutilizarlas rápidamente. Haz clic en "Guardar" para crear un nuevo filtro guardado.',
    elemento: '.saved-filters-section',
    posicion: 'right'
  },
  {
    titulo: 'Compartir enlace',
    descripcion: 'Comparte los filtros actuales con otros usuarios. Al hacer clic, se genera un enlace que puedes copiar y compartir. Al abrir el enlace, se aplicarán automáticamente los mismos filtros.',
    elemento: '.map-controls-left',
    posicion: 'bottom'
  },
  {
    titulo: 'Contador de resultados',
    descripcion: 'En la esquina inferior izquierda del mapa puedes ver el número de puntos de venta que coinciden con tus filtros actuales. Este contador se actualiza automáticamente cuando cambias los filtros o la búsqueda.',
    elemento: '.map-results-counter',
    posicion: 'top'
  },
  {
    titulo: 'Controles del mapa',
    descripcion: 'Cambia entre modo claro y oscuro, o resetea la vista del mapa. También puedes usar <kbd>R</kbd> para resetear y <kbd>E</kbd> para exportar.',
    elemento: '.map-controls',
    posicion: 'left'
  },
  {
    titulo: '¡Listo para empezar!',
    descripcion: 'Ya conoces las funciones principales. Puedes exportar los resultados a Excel, usar atajos de teclado y mucho más. ¡Explora la aplicación!',
    elemento: null,
    posicion: 'center'
  }
];

// Iniciar tour si es primera vez
function iniciarTourSiEsNecesario() {
  const noMostrarTour = localStorage.getItem('noMostrarTour');
  if (noMostrarTour === 'true') {
    return;
  }
  
  const tourCompletado = localStorage.getItem('tourCompletado');
  if (tourCompletado === 'true') {
    return;
  }
  
  // Esperar un poco para que la página cargue completamente
  setTimeout(() => {
    iniciarTour();
  }, 1000);
}

// Iniciar tour
function iniciarTour() {
  pasoActual = 0;
  tourActual = true;
  const overlay = document.getElementById('tour-overlay');
  if (overlay) {
    overlay.style.display = 'block';
    agregarListenersTour();
    mostrarPaso(0);
  }
}

// Mostrar paso del tour
function mostrarPaso(index) {
  if (index < 0 || index >= pasosTour.length) {
    finalizarTour();
    return;
  }
  
  pasoActual = index;
  const paso = pasosTour[index];
  const overlay = document.getElementById('tour-overlay');
  const highlight = document.getElementById('tour-highlight');
  const tooltip = document.getElementById('tour-tooltip');
  const title = document.getElementById('tour-title');
  const description = document.getElementById('tour-description');
  const counter = document.getElementById('tour-step-counter');
  const btnPrev = document.getElementById('tour-btn-prev');
  const btnNext = document.getElementById('tour-btn-next');
  const btnFinish = document.getElementById('tour-btn-finish');
  
  if (!overlay || !highlight || !tooltip || !title || !description) return;
  
  // Actualizar contenido
  title.textContent = paso.titulo;
  description.innerHTML = paso.descripcion;
  counter.textContent = `${index + 1} / ${pasosTour.length}`;
  
  // Mostrar/ocultar botones
  if (btnPrev) btnPrev.style.display = index === 0 ? 'none' : 'block';
  if (btnNext) btnNext.style.display = index === pasosTour.length - 1 ? 'none' : 'block';
  if (btnFinish) btnFinish.style.display = index === pasosTour.length - 1 ? 'block' : 'none';
  
  // Resaltar elemento
  let elementoEncontrado = null;
  if (paso.elemento) {
    elementoEncontrado = typeof paso.elemento === 'string' 
      ? document.getElementById(paso.elemento) || document.querySelector(paso.elemento)
      : paso.elemento;
    
    if (elementoEncontrado) {
      // Esperar un momento para que el DOM se actualice
      setTimeout(() => {
        const rect = elementoEncontrado.getBoundingClientRect();
        
        // Actualizar highlight
        highlight.style.width = `${rect.width + 20}px`;
        highlight.style.height = `${rect.height + 20}px`;
        highlight.style.top = `${rect.top - 10 + window.scrollY}px`;
        highlight.style.left = `${rect.left - 10 + window.scrollX}px`;
        highlight.style.display = 'block';
        
        // Posicionar tooltip
        posicionarTooltip(tooltip, elementoEncontrado, paso.posicion);
        
        // Scroll al elemento si es necesario
        elementoEncontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Iniciar actualización continua
        iniciarActualizacionTour();
      }, 100);
    } else {
      highlight.style.display = 'none';
      posicionarTooltipCentro(tooltip);
      detenerActualizacionTour();
    }
  } else {
    highlight.style.display = 'none';
    posicionarTooltipCentro(tooltip);
    detenerActualizacionTour();
  }
}

// Posicionar tooltip
function posicionarTooltip(tooltip, elemento, posicion) {
  if (!tooltip || !elemento) return;
  
  const padding = 20;
  const rect = elemento.getBoundingClientRect();
  
  // Asegurar que el tooltip tenga dimensiones antes de posicionar
  if (tooltip.offsetWidth === 0 || tooltip.offsetHeight === 0) {
    // Forzar renderizado
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    const tempWidth = tooltip.offsetWidth;
    const tempHeight = tooltip.offsetHeight;
    tooltip.style.visibility = 'visible';
  }
  
  const tooltipWidth = tooltip.offsetWidth || 350;
  const tooltipHeight = tooltip.offsetHeight || 200;
  
  let top = 0;
  let left = 0;
  
  switch(posicion) {
    case 'top':
      top = rect.top - tooltipHeight - padding;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      break;
    case 'bottom':
      top = rect.bottom + padding;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      break;
    case 'left':
      top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
      left = rect.left - tooltipWidth - padding;
      break;
    case 'right':
      top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
      left = rect.right + padding;
      break;
    default:
      posicionarTooltipCentro(tooltip);
      return;
  }
  
  // Ajustar si se sale de la pantalla
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Ajustar horizontalmente
  if (left < padding) {
    left = padding;
  } else if (left + tooltipWidth > viewportWidth - padding) {
    left = viewportWidth - tooltipWidth - padding;
  }
  
  // Ajustar verticalmente
  if (top < padding) {
    top = padding;
    // Si no cabe arriba, intentar abajo
    if (posicion === 'top' && rect.bottom + tooltipHeight + padding < viewportHeight) {
      top = rect.bottom + padding;
    }
  } else if (top + tooltipHeight > viewportHeight - padding) {
    top = viewportHeight - tooltipHeight - padding;
    // Si no cabe abajo, intentar arriba
    if (posicion === 'bottom' && rect.top - tooltipHeight - padding > 0) {
      top = rect.top - tooltipHeight - padding;
    }
  }
  
  // Aplicar posición
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.transform = '';
}

// Actualizar posición del tooltip cuando hay scroll o resize
let tourUpdateInterval = null;

function iniciarActualizacionTour() {
  detenerActualizacionTour();
  tourUpdateInterval = setInterval(() => {
    if (tourActual !== null && pasoActual >= 0) {
      const paso = pasosTour[pasoActual];
      if (paso && paso.elemento) {
        const elemento = typeof paso.elemento === 'string' 
          ? document.getElementById(paso.elemento) || document.querySelector(paso.elemento)
          : paso.elemento;
        const tooltip = document.getElementById('tour-tooltip');
        const highlight = document.getElementById('tour-highlight');
        
        if (elemento && tooltip) {
          const rect = elemento.getBoundingClientRect();
          
          // Actualizar highlight
          if (highlight) {
            highlight.style.width = `${rect.width + 20}px`;
            highlight.style.height = `${rect.height + 20}px`;
            highlight.style.top = `${rect.top - 10 + window.scrollY}px`;
            highlight.style.left = `${rect.left - 10 + window.scrollX}px`;
          }
          
          // Actualizar tooltip
          posicionarTooltip(tooltip, elemento, paso.posicion);
        }
      }
    }
  }, 100); // Actualizar cada 100ms
}

function detenerActualizacionTour() {
  if (tourUpdateInterval) {
    clearInterval(tourUpdateInterval);
    tourUpdateInterval = null;
  }
}

// Posicionar tooltip en el centro
function posicionarTooltipCentro(tooltip) {
  tooltip.style.top = '50%';
  tooltip.style.left = '50%';
  tooltip.style.transform = 'translate(-50%, -50%)';
}

// Siguiente paso
function tourSiguiente() {
  mostrarPaso(pasoActual + 1);
}

// Paso anterior
function tourAnterior() {
  mostrarPaso(pasoActual - 1);
}

// Saltar tour
function saltarTour() {
  const noMostrar = document.getElementById('tour-no-mostrar')?.checked;
  if (noMostrar) {
    localStorage.setItem('noMostrarTour', 'true');
  }
  cerrarTour();
}

// Finalizar tour
function finalizarTour() {
  const noMostrar = document.getElementById('tour-no-mostrar')?.checked;
  if (noMostrar) {
    localStorage.setItem('noMostrarTour', 'true');
  }
  localStorage.setItem('tourCompletado', 'true');
  cerrarTour();
}

// Cerrar tour
function cerrarTour() {
  detenerActualizacionTour();
  removerListenersTour();
  const overlay = document.getElementById('tour-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  tourActual = null;
  pasoActual = -1;
}

// Agregar listeners para scroll y resize durante el tour
let tourScrollListener = null;
let tourResizeListener = null;

function agregarListenersTour() {
  if (tourScrollListener) return; // Ya están agregados
  
  tourScrollListener = () => {
    if (tourActual !== null && pasoActual >= 0) {
      const paso = pasosTour[pasoActual];
      if (paso && paso.elemento) {
        const elemento = typeof paso.elemento === 'string' 
          ? document.getElementById(paso.elemento) || document.querySelector(paso.elemento)
          : paso.elemento;
        const tooltip = document.getElementById('tour-tooltip');
        const highlight = document.getElementById('tour-highlight');
        
        if (elemento && tooltip && highlight) {
          const rect = elemento.getBoundingClientRect();
          
          highlight.style.width = `${rect.width + 20}px`;
          highlight.style.height = `${rect.height + 20}px`;
          highlight.style.top = `${rect.top - 10 + window.scrollY}px`;
          highlight.style.left = `${rect.left - 10 + window.scrollX}px`;
          
          posicionarTooltip(tooltip, elemento, paso.posicion);
        }
      }
    }
  };
  
  tourResizeListener = () => {
    if (tourActual !== null && pasoActual >= 0) {
      mostrarPaso(pasoActual); // Reposicionar todo
    }
  };
  
  window.addEventListener('scroll', tourScrollListener, true);
  window.addEventListener('resize', tourResizeListener);
}

function removerListenersTour() {
  if (tourScrollListener) {
    window.removeEventListener('scroll', tourScrollListener, true);
    tourScrollListener = null;
  }
  if (tourResizeListener) {
    window.removeEventListener('resize', tourResizeListener);
    tourResizeListener = null;
  }
}

// Función para toggle del panel de ayuda de teclado (si existe)
function toggleKeyboardHelp() {
  const panel = document.getElementById('keyboard-help-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

// ============ Atajos de Teclado ============
document.addEventListener('keydown', (e) => {
  // Ignorar si el usuario está escribiendo en un input o textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    // Permitir Escape siempre
    if (e.key === 'Escape') {
      return;
    }
    // Para otros atajos, solo si no hay texto seleccionado
    return;
  }
  
  // Ignorar si se está presionando Ctrl, Alt o Meta (para no interferir con atajos del navegador)
  if (e.ctrlKey || e.altKey || e.metaKey) {
    return;
  }
  
  switch(e.key.toLowerCase()) {
    case 'f':
      // F = Enfocar búsqueda
      e.preventDefault();
      const buscador = document.getElementById('buscar-lugar');
      if (buscador) {
        buscador.focus();
        buscador.select();
      }
      break;
      
    case 'e':
      // E = Exportar
      e.preventDefault();
      exportarExcel();
      break;
      
    case 'r':
      // R = Resetear vista
      e.preventDefault();
      volverAZoomGeneral();
      break;
      
    case 'escape':
      // Esc = Limpiar filtros (ya manejado arriba)
      e.preventDefault();
      limpiarFiltros();
      break;
  }
});

// ============ Compartir Enlace ============
function compartirEnlace() {
  // Crear objeto con los filtros actuales
  const estadoFiltros = {
    filtros: filtrosActivos,
    busqueda: document.getElementById('buscar-lugar')?.value || '',
    modo: estiloMapa
  };
  
  // Codificar en base64
  const estadoCodificado = btoa(JSON.stringify(estadoFiltros));
  
  // Crear URL con el estado
  const url = new URL(window.location.href);
  url.searchParams.set('filtros', estadoCodificado);
  const urlCompartir = url.toString();
  
  // Copiar al portapapeles
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(urlCompartir).then(() => {
      alert('✅ Enlace copiado al portapapeles!\n\nComparte este enlace para que otros vean los mismos filtros.');
    }).catch(() => {
      // Fallback si no se puede copiar
      mostrarEnlaceCompartir(urlCompartir);
    });
  } else {
    // Fallback para navegadores antiguos
    mostrarEnlaceCompartir(urlCompartir);
  }
}

function mostrarEnlaceCompartir(url) {
  const enlace = prompt('Comparte este enlace:\n\n(Presiona Ctrl+C para copiar)', url);
}

// Cargar filtros desde URL al iniciar
function cargarFiltrosDesdeURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const filtrosCodificados = urlParams.get('filtros');
  
  if (filtrosCodificados) {
    try {
      const estadoFiltros = JSON.parse(atob(filtrosCodificados));
      
      // Restaurar filtros
      filtrosActivos = estadoFiltros.filtros || filtrosActivos;
      
      // Restaurar búsqueda
      const buscador = document.getElementById('buscar-lugar');
      if (buscador && estadoFiltros.busqueda) {
        buscador.value = estadoFiltros.busqueda;
      }
      
      // Restaurar modo
      if (estadoFiltros.modo) {
        cambiarModo(estadoFiltros.modo);
      }
      
      // Actualizar UI
      actualizarCheckboxesFiltros();
      actualizarFiltrosActivos();
      filtrarLugares();
      
      if (filtrosActivos.partidos.length > 0 || filtrosActivos.localidades.length > 0) {
        ajustarVistaAMarcadores();
      }
    } catch (error) {
      console.error('Error cargando filtros desde URL:', error);
    }
  }
}

// ============ Exportar a PDF ============
function exportarPDF() {
  // Obtener lugares filtrados
  const lugaresFiltrados = lugares.filter(aplicarFiltros);
  
  if (lugaresFiltrados.length === 0) {
    alert('No hay datos para imprimir');
    return;
  }
  
  mostrarLoading(true);
  
  const fecha = new Date().toLocaleDateString('es-AR');
  const mapContainer = document.getElementById('map');
  
  // Función para generar PDF con o sin mapa
  const generarPDF = (mapImageData = null) => {
    // Crear elemento temporal con el mapa y la tabla
    const divTemp = document.createElement('div');
    divTemp.id = 'pdf-temp-container';
    divTemp.style.position = 'absolute';
    divTemp.style.top = '-9999px';
    divTemp.style.left = '0';
    divTemp.style.width = '800px'; // Ancho fijo en píxeles
    divTemp.style.padding = '20px';
    divTemp.style.backgroundColor = '#ffffff';
    divTemp.style.fontFamily = 'Arial, sans-serif';
    divTemp.style.color = '#000000';
    
    // Construir HTML con mapa (si está disponible) y tabla
    let contenidoHTML = `
      <div style="text-align: center; margin-bottom: 15px; border-bottom: 3px solid #E31837; padding-bottom: 10px;">
        <h1 style="color: #E31837; margin: 0; font-size: 24px; font-weight: bold;">Puntos de Venta Clarín</h1>
        <p style="margin: 8px 0; color: #666; font-size: 12px;">Fecha: ${fecha} | Total de puntos: ${lugaresFiltrados.length}</p>
      </div>
    `;
    
    // Agregar mapa si está disponible
    if (mapImageData) {
      contenidoHTML += `
        <div style="margin-bottom: 20px; border: 2px solid #E31837; border-radius: 4px; overflow: hidden;">
          <div style="background-color: #E31837; color: white; padding: 8px; font-weight: bold; font-size: 14px; text-align: center;">
            Mapa con Filtros Aplicados
          </div>
          <img src="${mapImageData}" style="width: 100%; height: auto; display: block; max-height: 400px; object-fit: contain;" alt="Mapa de puntos de venta">
        </div>
      `;
    }
    
    // Agregar tabla
    contenidoHTML += `
      <div style="margin-top: 15px;">
        <div style="background-color: #E31837; color: white; padding: 10px; font-weight: bold; font-size: 14px; text-align: center; border-radius: 4px 4px 0 0;">
          Lista de Puntos de Venta
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 2px solid #E31837;">
          <thead>
            <tr>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Nombre</th>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Paquete</th>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Dirección</th>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Localidad</th>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Partido</th>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Estado</th>
              <th style="background-color: #E31837; color: white; padding: 8px 6px; text-align: left; font-weight: bold; border: 1px solid #B8142D;">Teléfono</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    lugaresFiltrados.forEach((lugar, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      contenidoHTML += `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.nombre || '')}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.paquete || '')}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.direccion || '')}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.localidad || '')}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.partido || '')}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.estado || '')}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${escapeHtml(lugar.telefono || '')}</td>
        </tr>
      `;
    });
    
    contenidoHTML += `
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 15px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
        <p>Generado desde Puntos de Venta Clarín - ${fecha}</p>
      </div>
    `;
    
    divTemp.innerHTML = contenidoHTML;
    document.body.appendChild(divTemp);
    
    // Esperar a que el DOM se actualice y la imagen se cargue
    setTimeout(() => {
      // Configurar opciones para PDF
      const opciones = {
        margin: [10, 10, 10, 10],
        filename: `puntos_venta_clarin_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: true,
          backgroundColor: '#ffffff',
          allowTaint: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      console.log('Generando PDF...');
      
      // Generar PDF
      html2pdf().set(opciones).from(divTemp).save().then(() => {
        console.log('PDF generado exitosamente');
        if (divTemp.parentNode) {
          document.body.removeChild(divTemp);
        }
        mostrarLoading(false);
        alert('✅ PDF generado correctamente');
      }).catch((error) => {
        console.error('Error generando PDF:', error);
        if (divTemp.parentNode) {
          document.body.removeChild(divTemp);
        }
        mostrarLoading(false);
        alert('Error al generar el PDF: ' + error.message);
      });
    }, mapImageData ? 2000 : 500); // Esperar más si hay imagen del mapa
  };
  
  // Intentar capturar el mapa
  if (mapContainer && typeof html2canvas !== 'undefined') {
    // Asegurar que el mapa esté completamente renderizado
    if (map && typeof map.invalidateSize === 'function') {
      map.invalidateSize();
    }
    
    setTimeout(() => {
      html2canvas(mapContainer, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        backgroundColor: '#ffffff',
        logging: false,
        width: mapContainer.offsetWidth,
        height: mapContainer.offsetHeight
      }).then((mapCanvas) => {
        const mapImageData = mapCanvas.toDataURL('image/png');
        console.log('Mapa capturado exitosamente');
        generarPDF(mapImageData);
      }).catch((error) => {
        console.warn('Error capturando el mapa, generando PDF sin mapa:', error);
        generarPDF(); // Generar PDF sin mapa
      });
    }, 1000);
  } else {
    // Generar PDF sin mapa
    console.log('Generando PDF sin mapa');
    generarPDF();
  }
}

// Función auxiliar para escapar HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ============ Exportar a Excel ============
function exportarExcel() {
  // Obtener lugares filtrados
  const lugaresFiltrados = lugares.filter(aplicarFiltros);
  
  if (lugaresFiltrados.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  // Preparar datos para Excel
  const datos = lugaresFiltrados.map(lugar => ({
    'Nombre': lugar.nombre || '',
    'Paquete': lugar.paquete || '',
    'Dirección': lugar.direccion || '',
    'Localidad': lugar.localidad || '',
    'Partido': lugar.partido || '',
    'Estado': lugar.estado || '',
    'Distribuidora': lugar.distribuidora || '',
    'Días de Atención': lugar.dias_atencion || '',
    'Horario': lugar.horario || '',
    'Teléfono': lugar.telefono || '',
    'Contacto': lugar.contacto_nombre || '',
    'Escaparate': lugar.escaparate || '',
    'Fachada': lugar.fachada || '',
    'Venta No Editorial': lugar.venta_no_editorial || '',
    'Reparto': lugar.reparto || '',
    'Suscripciones': lugar.suscripciones || '',
    'Mayor Venta': lugar.mayor_venta || '',
    'Parada Online': lugar.usa_parada_online || '',
    'Latitud': lugar.latitud || '',
    'Longitud': lugar.longitud || ''
  }));
  
  // Crear libro de Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datos);
  
  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 25 }, // Nombre
    { wch: 15 }, // Paquete
    { wch: 30 }, // Dirección
    { wch: 20 }, // Localidad
    { wch: 15 }, // Partido
    { wch: 15 }, // Estado
    { wch: 15 }, // Distribuidora
    { wch: 20 }, // Días de Atención
    { wch: 15 }, // Horario
    { wch: 15 }, // Teléfono
    { wch: 20 }, // Contacto
    { wch: 12 }, // Escaparate
    { wch: 12 }, // Fachada
    { wch: 15 }, // Venta No Editorial
    { wch: 10 }, // Reparto
    { wch: 12 }, // Suscripciones
    { wch: 15 }, // Mayor Venta
    { wch: 15 }, // Parada Online
    { wch: 12 }, // Latitud
    { wch: 12 }  // Longitud
  ];
  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, 'Puntos de Venta');
  
  // Generar nombre de archivo con fecha
  const fecha = new Date().toISOString().split('T')[0];
  const nombreArchivo = `puntos_venta_clarin_${fecha}.xlsx`;
  
  // Descargar
  XLSX.writeFile(wb, nombreArchivo);
}

// Exponer funciones globalmente
window.seleccionarLugar = seleccionarLugar;
window.cambiarModo = cambiarModo;
window.limpiarFiltros = limpiarFiltros;
window.toggleCategory = toggleCategory;
window.toggleChip = toggleChip;
window.toggleDropdownMenu = toggleDropdownMenu;
window.toggleDropdownItem = toggleDropdownItem;
window.removeFilter = removeFilter;
window.expandirTodosFiltros = expandirTodosFiltros;
window.contraerTodosFiltros = contraerTodosFiltros;
window.exportarExcel = exportarExcel;
window.exportarPDF = exportarPDF;
window.compartirEnlace = compartirEnlace;
window.seleccionarSugerencia = seleccionarSugerencia;
window.volverAZoomGeneral = volverAZoomGeneral;
window.mostrarDialogoGuardarFiltro = mostrarDialogoGuardarFiltro;
window.cerrarModalGuardarFiltro = cerrarModalGuardarFiltro;
window.guardarFiltroActual = guardarFiltroActual;
window.aplicarFiltroGuardado = aplicarFiltroGuardado;
window.eliminarFiltroGuardado = eliminarFiltroGuardado;
window.cerrarPopupConfirmacion = cerrarPopupConfirmacion;
window.iniciarTour = iniciarTour;
window.tourSiguiente = tourSiguiente;
window.tourAnterior = tourAnterior;
window.saltarTour = saltarTour;
window.finalizarTour = finalizarTour;
window.cerrarTour = cerrarTour;
window.toggleKeyboardHelp = toggleKeyboardHelp;

// ============ Funciones para interfaz móvil ============

// Toggle del drawer móvil
function toggleMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  if (!drawer) return;
  
  const isActive = drawer.classList.contains('active');
  
  // Cerrar popup de búsqueda si está abierto
  const popup = document.getElementById('mobile-search-popup');
  if (popup && popup.classList.contains('active')) {
    toggleMobileSearchPopup();
  }
  
  if (isActive) {
    // Cerrar drawer
    drawer.classList.remove('active');
  } else {
    // Abrir drawer
    drawer.classList.add('active');
  
    // Copiar contenido del sidebar al drawer si está vacío
    const drawerBody = drawer.querySelector('.mobile-drawer-body');
    const sidebar = document.querySelector('.sidebar');
    
    if (drawerBody && sidebar && !drawerBody.dataset.copied) {
      // Clonar el contenido del sidebar
      const sidebarClone = sidebar.cloneNode(true);
      sidebarClone.style.display = 'block';
      sidebarClone.style.width = '100%';
      sidebarClone.style.height = 'auto';
      sidebarClone.style.overflow = 'visible';
      
      // Limpiar drawer body
      drawerBody.innerHTML = '';
      drawerBody.appendChild(sidebarClone);
      drawerBody.dataset.copied = 'true';
      
      // Re-inicializar event listeners en el contenido clonado
      initMobileDrawerListeners();
    }
  }
}

// Inicializar listeners en el drawer
function initMobileDrawerListeners() {
  const drawer = document.querySelector('.mobile-drawer-body');
  if (!drawer) return;
  
  // Buscador
  const buscador = drawer.querySelector('#buscar-lugar');
  if (buscador) {
    buscador.addEventListener('input', filtrarLugares);
  }
  
  // Botones de filtros
  const filterChips = drawer.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', function() {
      const category = this.dataset.category;
      const value = this.dataset.value;
      toggleChip(category, value);
    });
  });
  
  // Botones de categorías
  const categoryHeaders = drawer.querySelectorAll('.filter-category-header');
  categoryHeaders.forEach(header => {
    header.addEventListener('click', function() {
      toggleCategory(this);
    });
  });
  
  // Botón de guardar filtro (en el drawer)
  const btnGuardarDrawer = drawer.querySelector('.btn-save-filter');
  if (btnGuardarDrawer) {
    console.log('Botón guardar encontrado en drawer, agregando event listener');
    btnGuardarDrawer.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Botón guardar clickeado en drawer');
      mostrarDialogoGuardarFiltro(e);
    });
  }
}

// Enfocar búsqueda móvil
function toggleMobileSearchPopup() {
  const popup = document.getElementById('mobile-search-popup');
  if (!popup) return;
  
  const isActive = popup.classList.contains('active');
  
  // Cerrar drawer de filtros si está abierto
  const drawer = document.getElementById('mobile-drawer');
  if (drawer && drawer.classList.contains('active')) {
    toggleMobileDrawer();
  }
  
  if (isActive) {
    // Cerrar popup
    popup.classList.remove('active');
    // Cerrar sugerencias
    const mobileSuggestions = document.getElementById('mobile-search-suggestions');
    if (mobileSuggestions) {
      mobileSuggestions.classList.remove('active');
    }
  } else {
    // Abrir popup
    popup.classList.add('active');
    setTimeout(() => {
      const buscador = document.getElementById('mobile-buscar-lugar');
      if (buscador) {
        buscador.focus();
        // Asegurar que el autocompletado esté inicializado
        const mobileSuggestions = document.getElementById('mobile-search-suggestions');
        if (mobileSuggestions && !buscador.dataset.autocompleteInit) {
          setupAutocompletado(buscador, mobileSuggestions);
          buscador.dataset.autocompleteInit = 'true';
        }
      }
    }, 300);
  }
}

function focusMobileSearch() {
  // Cerrar drawer de filtros si está abierto
  const drawer = document.getElementById('mobile-drawer');
  if (drawer && drawer.classList.contains('active')) {
    toggleMobileDrawer();
  }
  
  // Abrir popup de búsqueda
  toggleMobileSearchPopup();
}

// Toggle panel admin móvil
function toggleMobileAdmin() {
  // Por ahora, mostrar opciones de exportar/imprimir
  const drawer = document.getElementById('mobile-drawer');
  if (drawer && !drawer.classList.contains('active')) {
    toggleMobileDrawer();
  }
  
  // Scroll a controles de filtros
  setTimeout(() => {
    const filterControls = document.querySelector('.mobile-drawer-body .filter-controls');
    if (filterControls) {
      filterControls.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 300);
}

// Manejar salida móvil
function handleMobileExit() {
  if (confirm('¿Deseas salir de la aplicación?')) {
    // Aquí puedes agregar lógica de logout o cerrar
    window.close();
  }
}

// Scroll al inicio
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Si hay drawer abierto, cerrarlo
  const drawer = document.getElementById('mobile-drawer');
  if (drawer && drawer.classList.contains('active')) {
    toggleMobileDrawer();
  }
}

// Actualizar barra superior móvil
function actualizarBarraSuperiorMovil() {
  const filterCount = document.getElementById('mobile-filter-count');
  const statusIndicator = document.getElementById('mobile-status-indicator');
  const searchHint = document.getElementById('mobile-search-hint');
  
  if (filterCount) {
    const totalActivos = Object.values(filtrosActivos).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    filterCount.textContent = totalActivos > 0 ? `${totalActivos} filtros` : '0';
  }
  
  if (statusIndicator) {
    const estadosActivos = filtrosActivos.estados || [];
    if (estadosActivos.length > 0) {
      statusIndicator.textContent = estadosActivos[0];
    } else {
      statusIndicator.textContent = 'Todos';
    }
  }
  
  if (searchHint) {
    const busqueda = document.getElementById('buscar-lugar')?.value || '';
    if (busqueda) {
      searchHint.textContent = busqueda.substring(0, 15) + (busqueda.length > 15 ? '...' : '');
    } else {
      searchHint.textContent = 'Buscar...';
    }
  }
}

// Exponer funciones globalmente
window.toggleMobileDrawer = toggleMobileDrawer;
window.toggleMobileSearchPopup = toggleMobileSearchPopup;
window.focusMobileSearch = focusMobileSearch;
window.toggleMobileAdmin = toggleMobileAdmin;
window.handleMobileExit = handleMobileExit;
window.scrollToTop = scrollToTop;
