// Script para generar hashes bcrypt para usuarios dummy
// Ejecutar con: node scripts/generate-user-hashes.js
const bcrypt = require('bcrypt');

const password = 'password123';
const rounds = 10;

const users = [
  { rut: '12.345.678-9', nombre: 'Administrador Sistema', email: 'admin@pepsico.cl', telefono: '+56912345678', rol: 'ADMIN' },
  { rut: '13.456.789-0', nombre: 'Carlos Rodríguez', email: 'jefe.taller@pepsico.cl', telefono: '+56923456789', rol: 'JEFE_TALLER' },
  { rut: '14.567.890-1', nombre: 'María González', email: 'mecanico@pepsico.cl', telefono: '+56934567890', rol: 'MECANICO' },
  { rut: '15.678.901-2', nombre: 'Juan Pérez', email: 'chofer@pepsico.cl', telefono: '+56945678901', rol: 'CHOFER' },
  { rut: '16.789.012-3', nombre: 'Ana Silva', email: 'logistica@pepsico.cl', telefono: '+56956789012', rol: 'LOGISTICA' }
];

async function generateHashes() {
  console.log('-- Generando hashes bcrypt para usuarios dummy');
  console.log('-- Contraseña: password123');
  console.log('-- Rounds: 10\n');
  
  console.log('INSERT INTO usuarios (rut, nombre_completo, email, telefono, rol, hash_contrasena, activo) VALUES');
  
  for (let i = 0; i < users.length; i++) {
    const hash = await bcrypt.hash(password, rounds);
    const user = users[i];
    const comma = i < users.length - 1 ? ',' : ';';
    console.log(`-- ${user.rol}`);
    console.log(`('${user.rut}', '${user.nombre}', '${user.email}', '${user.telefono}', '${user.rol}', '${hash}', true)${comma}`);
  }
}

generateHashes().catch(console.error);

