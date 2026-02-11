# 🗺️ MapaVivo - Mapa Interactivo

Un mapa interactivo para visualizar puntos de interés con información de horarios y estado de apertura.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-brightgreen)

## ✨ Características

- 🗺️ Mapa interactivo con estilo oscuro
- 📍 Marcadores personalizados por tipo de lugar
- 🕐 Detección automática de si un lugar está abierto o cerrado
- 🔍 Filtros por tipo y estado (abierto/cerrado)
- ➕ Agregar, editar y eliminar lugares
- 📱 Diseño responsive
- 💾 Base de datos SQLite (sin configuración adicional)

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar el servidor
npm start

# O en modo desarrollo (auto-reload)
npm run dev
```

El servidor se iniciará en `http://localhost:3000`

## 📋 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/lugares` | Listar todos los lugares |
| GET | `/api/lugares/:id` | Obtener un lugar |
| POST | `/api/lugares` | Crear nuevo lugar |
| PUT | `/api/lugares/:id` | Actualizar lugar |
| DELETE | `/api/lugares/:id` | Eliminar lugar |
| GET | `/api/tipos` | Listar tipos únicos |

### Filtros disponibles (query params)

- `tipo`: Filtrar por tipo de lugar
- `activo`: Filtrar por estado activo (true/false)

### Ejemplo de uso de la API

```bash
# Crear un nuevo lugar
curl -X POST http://localhost:3000/api/lugares \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Kiosco Mi Barrio",
    "tipo": "kiosco",
    "descripcion": "Kiosco con golosinas y bebidas",
    "latitud": -34.677237,
    "longitud": -58.347364,
    "direccion": "Av. Mitre 1234",
    "telefono": "011-4444-5555",
    "horario_apertura": "08:00",
    "horario_cierre": "22:00",
    "dias_atencion": "Lunes a Sábado",
    "activo": 1
  }'
```

## 🎨 Tipos de lugares soportados

El sistema reconoce automáticamente estos tipos y asigna iconos:

| Tipo | Icono |
|------|-------|
| kiosco | 🏪 |
| farmacia | 💊 |
| supermercado | 🛒 |
| panaderia | 🥖 |
| restaurant | 🍽️ |
| cafe | ☕ |
| banco | 🏦 |
| hospital | 🏥 |
| escuela | 🏫 |
| (otros) | 📍 |

Podés agregar cualquier tipo personalizado, se mostrará con el icono por defecto.

## 📁 Estructura del proyecto

```
map/
├── server.js           # Servidor Express
├── database.js         # Configuración SQLite
├── package.json        # Dependencias
├── lugares.db          # Base de datos (se crea automáticamente)
├── README.md           # Este archivo
└── public/
    ├── index.html      # Página principal
    ├── styles.css      # Estilos
    └── app.js          # Lógica del frontend
```

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **Base de datos**: SQLite (better-sqlite3)
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Mapa**: Leaflet.js con tiles de CartoDB Dark Matter

## 📝 Notas

- La base de datos se crea automáticamente al iniciar el servidor
- Se incluyen datos de ejemplo para probar
- Hacé clic en el mapa cuando el formulario está abierto para seleccionar coordenadas
- Los marcadores cambian de color según si el lugar está abierto (verde) o cerrado (rojo)


