const express = require('express');
const cors = require('cors');
const path = require('path');
const { getLugares, clearCache } = require('./googleSheets');
const { authenticate, rateLimit, sanitizeResponse } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint para servir config.js con API_KEY inyectada (antes de servir archivos estáticos)
app.get('/config.js', (req, res) => {
  const apiKey = process.env.API_KEY || 'clarin-secret-key-2024-change-in-production';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.API_KEY = '${apiKey}';`);
});

// Servir archivos estáticos desde /public
// Esto funciona tanto en desarrollo como en Vercel
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, // No servir index.html automáticamente
  setHeaders: (res, filePath) => {
    // Cache headers para archivos estáticos
    if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// En Vercel, servir index.html para rutas no encontradas (SPA fallback)
// Solo para rutas que no sean archivos estáticos
app.get('*', (req, res, next) => {
  // Si es una ruta de API, continuar
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Si es config.js, ya está manejado arriba
  if (req.path === '/config.js') {
    return next();
  }
  // Si es un archivo estático (extensión), express.static ya lo manejó
  // Si llegamos aquí y es un archivo estático, no se encontró
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
    return res.status(404).send('File not found');
  }
  // Para otras rutas (SPA), servir index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rate limiting global
app.use('/api', rateLimit);

// ============ API ROUTES ============

// Todas las rutas de API requieren autenticación
app.use('/api', authenticate);

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

    // Sanitizar respuesta (no exponer información sensible)
    const sanitized = lugares.map(lugar => sanitizeResponse(lugar));
    res.json(sanitized);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
    
    // Sanitizar respuesta
    const sanitized = sanitizeResponse(lugar);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('Error refrescando cache:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Info del sistema (sin información sensible)
app.get('/api/info', (req, res) => {
  res.json({
    source: 'Google Sheets',
    version: '1.0.0',
    // No exponer sheetId ni sheetUrl por seguridad
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
