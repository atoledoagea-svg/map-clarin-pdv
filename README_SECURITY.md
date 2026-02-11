# Sistema de Seguridad

Este proyecto implementa un sistema de seguridad para proteger el acceso a los datos y ocultar información sensible del Google Sheet.

## Características de Seguridad

### 1. Autenticación con API Key
- Todas las rutas de API requieren una API key válida
- La API key se envía mediante el header `X-API-Key` o parámetro `apiKey`
- La API key se configura mediante la variable de entorno `API_KEY`

### 2. Rate Limiting
- Límite de 100 solicitudes por minuto por IP
- Previene abusos y ataques de fuerza bruta
- Respuesta HTTP 429 cuando se excede el límite

### 3. Protección de Información Sensible
- El Sheet ID no se expone en las respuestas de la API
- La URL del Sheet no se muestra en `/api/info`
- Los datos sensibles se sanitizan antes de enviarse al cliente

### 4. Variables de Entorno
- Configuración sensible mediante variables de entorno
- Archivo `.env` para configuración local (no se sube a git)
- `.env.example` como plantilla de configuración

## Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
API_KEY=tu-api-key-secreta-aqui
GOOGLE_SHEET_ID=tu-sheet-id
GOOGLE_SHEET_CSV_URL=tu-url-csv
PORT=3000
```

### 2. API Key

**IMPORTANTE**: Cambia la API key por defecto en producción.

La API key se puede configurar de dos formas:

1. **Variable de entorno del servidor** (recomendado):
   ```bash
   export API_KEY=tu-api-key-secreta
   ```

2. **Archivo .env**:
   ```
   API_KEY=tu-api-key-secreta
   ```

### 3. Uso en el Cliente

El cliente obtiene la API key automáticamente desde el servidor mediante `/config.js`. No es necesario configurarla manualmente en el frontend.

## Endpoints Protegidos

Todos los endpoints bajo `/api/*` requieren autenticación:

- `GET /api/lugares` - Listar lugares
- `GET /api/lugares/:id` - Obtener un lugar
- `GET /api/filtros` - Obtener opciones de filtro
- `POST /api/refresh` - Refrescar cache
- `GET /api/info` - Información del sistema (sin datos sensibles)

## Respuestas de Error

- **401 Unauthorized**: No se proporcionó API key
- **403 Forbidden**: API key inválida
- **429 Too Many Requests**: Se excedió el límite de solicitudes
- **500 Internal Server Error**: Error interno (mensaje genérico, sin detalles)

## Recomendaciones de Producción

1. **Cambiar la API key por defecto**: Nunca uses la API key de ejemplo en producción
2. **Usar HTTPS**: Siempre usa HTTPS en producción para proteger la API key en tránsito
3. **Rotar API keys**: Considera rotar las API keys periódicamente
4. **Monitoreo**: Implementa logging y monitoreo de intentos de acceso fallidos
5. **Rate limiting avanzado**: Para producción, considera usar Redis para rate limiting distribuido
6. **CORS**: Configura CORS apropiadamente para limitar orígenes permitidos

## Despliegue en Vercel

En Vercel, configura las variables de entorno en el dashboard:

1. Ve a Settings > Environment Variables
2. Agrega:
   - `API_KEY`: Tu API key secreta
   - `GOOGLE_SHEET_ID`: (opcional si está hardcodeado)
   - `GOOGLE_SHEET_CSV_URL`: (opcional si está hardcodeado)

## Notas de Seguridad

- El Sheet ID sigue siendo necesario para acceder a los datos, pero ya no se expone públicamente
- La API key se inyecta en el cliente mediante `/config.js`, pero esto es necesario para que el frontend funcione
- Considera implementar autenticación de usuario adicional si necesitas control de acceso más granular
- Para mayor seguridad, considera usar OAuth2 o JWT tokens en lugar de API keys simples

