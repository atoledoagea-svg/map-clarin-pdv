/**
 * Módulo para leer datos desde Google Sheets
 * 
 * Usa la URL de exportación CSV pública de Google Sheets
 */

const SHEET_ID = '13Ht_fOQuLHDMNYqKFr3FjedtU9ZkKOp_2_zCOnjHKm8';

// Hojas a cargar con sus gid
const HOJAS = [
  { nombre: 'Yamila', gid: '1090663139' },
  { nombre: 'Romina', gid: '822617376' },
  { nombre: 'Gisela', gid: '1787134852' },
  { nombre: 'Fabiana', gid: '1588954480' },
  { nombre: 'Anabella', gid: '2145568967' },
];

// Base URL para exportar CSV
const BASE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRRLfaWpmwj_Hl2kHFkbAjgJiypqi4CNidmKqRyUqmdRNpVKDZNIeWU9-Vg0VCUHA0YhPtNXJFIrKOr/pub?output=csv&gid=';

// Mapeo de columnas del Sheet a nuestro modelo
const COLUMN_MAP = {
  'ID': 'id',
  'Estado Kiosco': 'estado',
  'Paquete': 'paquete',
  'Domicilio': 'direccion',
  'Entre Calle 1': 'entre_calle_1',
  'Entre Calle 2': 'entre_calle_2',
  'Pais': 'pais',
  'Provincia': 'provincia',
  'Partido': 'partido',
  'Localidad / Barrio': 'localidad',
  'N° Vendedor': 'num_vendedor',
  'Distribuidora': 'distribuidora',
  'Dias de atención': 'dias_atencion',
  'Horario': 'horario',
  'Escaparate': 'escaparate',
  'Ubicación': 'ubicacion',
  'Fachada puesto': 'fachada',
  'Venta productos no editoriales': 'venta_no_editorial',
  'Reparto': 'reparto',
  'Suscripciones': 'suscripciones',
  'Nombre y Apellido': 'contacto_nombre',
  'Mayor venta': 'mayor_venta',
  'Utiliza Parada Online': 'usa_parada_online',
  'Teléfono': 'telefono',
  'Correo electrónico': 'email',
  'Relevado por': 'relevado_por',
  'Observaciones': 'observaciones',
  'Comentarios': 'comentarios',
  'IMG': 'imagen',
  'Latitud': 'latitud',
  'Longitud': 'longitud',
  'DISPOSITIVO': 'dispositivo'
};

/**
 * Parsea CSV a array de objetos
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = parseCSVLine(lines[i]);
    const row = {};
    
    headers.forEach((header, index) => {
      const mappedKey = COLUMN_MAP[header] || header;
      row[mappedKey] = values[index] || '';
    });
    
    data.push(row);
  }

  return data;
}

/**
 * Parsea una línea CSV respetando comillas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Obtiene los lugares desde una hoja específica
 */
async function fetchLugaresFromHoja(hoja) {
  try {
    const url = BASE_CSV_URL + hoja.gid;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`⚠️ No se pudo cargar hoja ${hoja.nombre}: ${response.status}`);
      return [];
    }
    
    const csvText = await response.text();
    const rawData = parseCSV(csvText);
    
    // Filtrar y transformar los datos
    const lugares = rawData
      .filter(row => {
        // Solo incluir si tiene coordenadas válidas
        const lat = parseFloat(row.latitud);
        const lng = parseFloat(row.longitud);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .filter(row => {
        // Excluir cerrados definitivamente
        return row.estado !== 'Cerrado definitivamente';
      })
      .map(row => ({
        id: row.id || Math.random().toString(36).substr(2, 9),
        nombre: row.paquete || 'Sin nombre',
        paquete: row.paquete || '',
        tipo: 'kiosco',
        descripcion: [row.ubicacion, row.escaparate, row.fachada].filter(Boolean).join(' - '),
        latitud: parseFloat(row.latitud),
        longitud: parseFloat(row.longitud),
        direccion: row.direccion || '',
        localidad: row.localidad || '',
        partido: row.partido || '',
        provincia: row.provincia || '',
        telefono: row.telefono || '',
        email: row.email || '',
        contacto_nombre: row.contacto_nombre || '',
        dias_atencion: row.dias_atencion || '',
        horario: row.horario || '',
        estado: row.estado || 'Abierto',
        distribuidora: row.distribuidora || '',
        num_vendedor: row.num_vendedor || '',
        imagen: row.imagen || '',
        // Campos adicionales para filtros
        escaparate: row.escaparate || '',
        ubicacion: row.ubicacion || '',
        fachada: row.fachada || '',
        venta_no_editorial: row.venta_no_editorial || '',
        reparto: row.reparto || '',
        suscripciones: row.suscripciones || '',
        mayor_venta: row.mayor_venta || '',
        usa_parada_online: row.usa_parada_online || '',
        relevadoPor: hoja.nombre,
        estaAbierto: determinarSiAbierto(row)
      }));

    console.log(`  📋 ${hoja.nombre}: ${lugares.length} lugares`);
    return lugares;
    
  } catch (error) {
    console.warn(`⚠️ Error cargando hoja ${hoja.nombre}:`, error.message);
    return [];
  }
}

/**
 * Obtiene los lugares desde todas las hojas de Google Sheets
 */
async function fetchLugaresFromSheet() {
  try {
    console.log('📊 Cargando datos de todas las hojas...');
    
    // Cargar todas las hojas en paralelo
    const resultados = await Promise.all(
      HOJAS.map(hoja => fetchLugaresFromHoja(hoja))
    );
    
    // Combinar todos los resultados
    const todosLosLugares = resultados.flat();
    
    // Eliminar duplicados por ID (si hay)
    const lugaresUnicos = [];
    const idsVistos = new Set();
    
    for (const lugar of todosLosLugares) {
      const key = `${lugar.latitud}-${lugar.longitud}`;
      if (!idsVistos.has(key)) {
        idsVistos.add(key);
        lugaresUnicos.push(lugar);
      }
    }

    console.log(`✅ Total: ${lugaresUnicos.length} lugares únicos desde ${HOJAS.length} hojas`);
    return lugaresUnicos;
    
  } catch (error) {
    console.error('❌ Error cargando desde Google Sheets:', error.message);
    throw error;
  }
}

/**
 * Determina si un kiosco está abierto basado en su estado
 */
function determinarSiAbierto(row) {
  const estado = (row.estado || '').toLowerCase();
  
  if (estado.includes('cerrado')) {
    return false;
  }
  
  if (estado === 'abierto') {
    return true;
  }
  
  return null; // Desconocido
}

/**
 * Cache de datos para no hacer requests constantes
 */
let cacheData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

async function getLugares(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && cacheData && (now - cacheTimestamp) < CACHE_DURATION) {
    return cacheData;
  }
  
  cacheData = await fetchLugaresFromSheet();
  cacheTimestamp = now;
  
  return cacheData;
}

function clearCache() {
  cacheData = null;
  cacheTimestamp = 0;
}

module.exports = {
  getLugares,
  clearCache,
  SHEET_ID,
  HOJAS
};

