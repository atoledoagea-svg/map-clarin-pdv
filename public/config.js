/**
 * Configuración del cliente
 * 
 * IMPORTANTE: En producción, la API_KEY debe configurarse desde el servidor
 * o mediante variables de entorno del cliente. NO hardcodear valores sensibles aquí.
 * 
 * Opciones:
 * 1. Inyectar desde el servidor en el HTML
 * 2. Usar variables de entorno del build (si usas un bundler)
 * 3. Obtener desde un endpoint seguro del servidor
 */

// API Key - Se puede inyectar desde el servidor o usar variable de entorno
window.API_KEY = window.API_KEY || process.env.API_KEY || 'clarin-secret-key-2024-change-in-production';


