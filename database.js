const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'lugares.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Intentar cargar base de datos existente
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Base de datos cargada');
  } else {
    db = new SQL.Database();
    console.log('✅ Base de datos creada');
  }

  // Crear tabla de lugares
  db.run(`
    CREATE TABLE IF NOT EXISTS lugares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descripcion TEXT,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      direccion TEXT,
      telefono TEXT,
      horario_apertura TEXT,
      horario_cierre TEXT,
      dias_atencion TEXT,
      activo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insertar datos de ejemplo si la tabla está vacía
  const countResult = db.exec('SELECT COUNT(*) as total FROM lugares');
  const count = countResult[0]?.values[0][0] || 0;

  if (count === 0) {
    // Datos de ejemplo en la zona de Buenos Aires
    const lugaresEjemplo = [
      ['Kiosco Don Pedro', 'kiosco', 'Kiosco de barrio con golosinas y bebidas', -34.677237, -58.347364, 'Av. Mitre 1234', '011-4444-5555', '08:00', '22:00', 'Lunes a Sábado', 1],
      ['Kiosco La Esquina', 'kiosco', 'Kiosco 24 horas', -34.678500, -58.349100, 'Calle San Martín 567', '011-4444-6666', '00:00', '23:59', 'Todos los días', 1],
      ['Farmacia Central', 'farmacia', 'Farmacia con turnos nocturnos', -34.676800, -58.345900, 'Av. Rivadavia 890', '011-4444-7777', '08:00', '21:00', 'Lunes a Viernes', 1],
      ['Supermercado Express', 'supermercado', 'Mini super con productos frescos', -34.679100, -58.348200, 'Calle Belgrano 321', '011-4444-8888', '07:00', '23:00', 'Todos los días', 1],
      ['Panadería El Trigal', 'panaderia', 'Pan artesanal y facturas', -34.677800, -58.346500, 'Av. Mayo 456', '011-4444-9999', '06:00', '20:00', 'Lunes a Domingo', 1],
    ];

    const insertStmt = db.prepare(`
      INSERT INTO lugares (nombre, tipo, descripcion, latitud, longitud, direccion, telefono, horario_apertura, horario_cierre, dias_atencion, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lugar of lugaresEjemplo) {
      insertStmt.run(lugar);
    }
    insertStmt.free();

    saveDatabase();
    console.log('✅ Datos de ejemplo insertados');
  }

  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDatabase() {
  return db;
}

// Helpers para queries
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

function get(sql, params = []) {
  const results = all(sql, params);
  return results[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  
  // Obtener el último ID insertado
  const lastIdResult = db.exec('SELECT last_insert_rowid()');
  const lastId = lastIdResult[0]?.values[0][0] || 0;
  
  // Obtener cambios
  const changesResult = db.exec('SELECT changes()');
  const changes = changesResult[0]?.values[0][0] || 0;
  
  return { lastInsertRowid: lastId, changes };
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  all,
  get,
  run
};
