const express = require('express');
const cors = require('cors');
const path = require('path');
const { getLugares, clearCache, SHEET_ID, HOJAS } = require('./googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ API ROUTES ============

// Obtener todos los lugares desde Google Sheets
app.get('/api/lugares', async (req, res) => {
  try {
    const { estado, localidad, partido, distribuidora } = req.query;
    let lugares = await getLugares();
    
    // Aplicar filtros
    if (estado) {
      const estadoLower = estado.toLowerCase();
      if (estadoLower === 'abierto') {
        lugares = lugares.filter(l => l.estaAbierto === true);
      } else if (estadoLower === 'cerrado') {
        lugares = lugares.filter(l => l.estaAbierto === false);
      }
    }

    if (localidad) {
      lugares = lugares.filter(l => 
        l.localidad.toLowerCase().includes(localidad.toLowerCase())
      );
    }

    if (partido) {
      lugares = lugares.filter(l => 
        l.partido.toLowerCase().includes(partido.toLowerCase())
      );
    }

    if (distribuidora) {
      lugares = lugares.filter(l => 
        l.distribuidora.toLowerCase().includes(distribuidora.toLowerCase())
      );
    }

    res.json(lugares);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un lugar por ID
app.get('/api/lugares/:id', async (req, res) => {
  try {
    const lugares = await getLugares();
    const lugar = lugares.find(l => l.id == req.params.id);
    
    if (!lugar) {
      return res.status(404).json({ error: 'Lugar no encontrado' });
    }
    
    res.json(lugar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener valores únicos para filtros
app.get('/api/filtros', async (req, res) => {
  try {
    const lugares = await getLugares();
    
    const localidades = [...new Set(lugares.map(l => l.localidad).filter(Boolean))].sort();
    const partidos = [...new Set(lugares.map(l => l.partido).filter(Boolean))].sort();
    const distribuidoras = [...new Set(lugares.map(l => l.distribuidora).filter(Boolean))].sort();
    
    res.json({
      localidades,
      partidos,
      distribuidoras
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refrescar cache (forzar recarga desde Google Sheets)
app.post('/api/refresh', async (req, res) => {
  try {
    clearCache();
    const lugares = await getLugares(true);
    res.json({ 
      message: 'Cache actualizado',
      total: lugares.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Info del sistema
app.get('/api/info', (req, res) => {
  res.json({
    source: 'Google Sheets',
    sheetId: SHEET_ID,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}`
  });
});

// ============ INICIAR SERVIDOR ============

// Para desarrollo local
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`
    🗺️  Mapa de Kioscos - Google Sheets Edition
    ==========================================
    ✅ Servidor corriendo en: http://localhost:${PORT}
    📊 Datos desde: Google Sheets
    📍 API disponible en: http://localhost:${PORT}/api/lugares
    
    Endpoints disponibles:
    - GET  /api/lugares          - Listar todos los kioscos
    - GET  /api/lugares/:id      - Obtener un kiosco
    - GET  /api/filtros          - Obtener opciones de filtro
    - POST /api/refresh          - Refrescar datos del Sheet
    - GET  /api/info             - Info del sistema
    
    Filtros disponibles (query params):
    - estado=abierto|cerrado
    - localidad=nombre
    - partido=nombre
    - distribuidora=nombre
    `);
    
    // Cargar datos al iniciar
    try {
      const lugares = await getLugares();
      console.log(`  📍 ${lugares.length} kioscos cargados desde Google Sheets\n`);
    } catch (error) {
      console.error(`  ⚠️  Error cargando datos: ${error.message}`);
      console.log(`  ℹ️  Asegurate de que el Sheet esté compartido públicamente\n`);
    }
  });
}

// Exportar para Vercel
module.exports = app;
