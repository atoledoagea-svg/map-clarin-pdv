/**
 * Sistema de autenticación y seguridad
 */

// API Key - En producción, usar variable de entorno
const API_KEY = process.env.API_KEY || 'clarin-secret-key-2024-change-in-production';

// Rate limiting simple (en producción usar Redis o similar)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests por minuto

/**
 * Middleware de autenticación
 */
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'No autorizado',
      message: 'Se requiere API key. Envía el header X-API-Key o el parámetro apiKey'
    });
  }
  
  if (apiKey !== API_KEY) {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'API key inválida'
    });
  }
  
  next();
}

/**
 * Rate limiting básico
 */
function rateLimit(req, res, next) {
  const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  
  // Limpiar entradas antiguas
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }
  
  // Verificar límite
  const clientData = rateLimitMap.get(clientId);
  
  if (!clientData) {
    rateLimitMap.set(clientId, {
      count: 1,
      timestamp: now
    });
    return next();
  }
  
  if (now - clientData.timestamp > RATE_LIMIT_WINDOW) {
    // Resetear contador
    rateLimitMap.set(clientId, {
      count: 1,
      timestamp: now
    });
    return next();
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes',
      message: `Límite de ${RATE_LIMIT_MAX_REQUESTS} solicitudes por minuto excedido`
    });
  }
  
  clientData.count++;
  next();
}

/**
 * Middleware para ocultar información sensible en respuestas
 */
function sanitizeResponse(data) {
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    // Remover información sensible
    delete sanitized.sheetId;
    delete sanitized.sheetUrl;
    delete sanitized.BASE_CSV_URL;
    return sanitized;
  }
  return data;
}

module.exports = {
  authenticate,
  rateLimit,
  sanitizeResponse,
  API_KEY
};

