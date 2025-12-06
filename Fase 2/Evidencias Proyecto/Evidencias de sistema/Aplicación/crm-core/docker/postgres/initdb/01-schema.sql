-- 01-schema.sql
-- Esquema reorganizado para CRM Flota PepsiCo
-- Flujo: Chofer → Solicitud → Jefe Taller → OT → Mecánico → Repuestos → Finalización

-- Eliminar tablas existentes en orden inverso (por dependencias)
DROP TABLE IF EXISTS log_auditoria CASCADE;
DROP TABLE IF EXISTS notificaciones CASCADE;
DROP TABLE IF EXISTS emergencias CASCADE;
DROP TABLE IF EXISTS entregas_vehiculos CASCADE;
DROP TABLE IF EXISTS archivos_adjuntos CASCADE;
DROP TABLE IF EXISTS movimientos_repuestos CASCADE;
DROP TABLE IF EXISTS solicitudes_repuestos CASCADE;
DROP TABLE IF EXISTS inventarios CASCADE;
DROP TABLE IF EXISTS tareas_ot CASCADE;
DROP TABLE IF EXISTS log_estados_ot CASCADE;
DROP TABLE IF EXISTS ot_items CASCADE;
DROP TABLE IF EXISTS ordenes_trabajo CASCADE;
DROP TABLE IF EXISTS reservas_vehiculos CASCADE;
DROP TABLE IF EXISTS vehiculos CASCADE;
DROP TABLE IF EXISTS talleres CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS repuestos CASCADE;

-- ========================================================
-- TABLAS MAESTRAS (Core)
-- ========================================================

CREATE TABLE usuarios (
  id serial PRIMARY KEY,
  rut varchar(12) UNIQUE NOT NULL,
  nombre_completo varchar(100) NOT NULL,
  email varchar(100) UNIQUE NOT NULL,
  telefono varchar(20),
  rol varchar(20) NOT NULL CHECK (rol IN ('CHOFER', 'MECANICO', 'JEFE_TALLER', 'ADMIN', 'LOGISTICA', 'RECEPCIONISTA', 'BODEGUERO')),
  hash_contrasena varchar(255) NOT NULL,
  activo boolean DEFAULT true,
  estado_usuario varchar(20) DEFAULT 'ACTIVO' CHECK (estado_usuario IN ('ACTIVO', 'EN_BREAK', 'INACTIVO')),
  fecha_creacion timestamp DEFAULT (now()),
  fecha_actualizacion timestamp DEFAULT (now())
);

CREATE TABLE talleres (
  id serial PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  codigo varchar(10) UNIQUE NOT NULL,
  region varchar(50) NOT NULL,
  direccion text,
  telefono varchar(20),
  activo boolean DEFAULT true,
  fecha_creacion timestamp DEFAULT (now())
);

CREATE TABLE horarios_trabajo (
  id serial PRIMARY KEY,
  usuario_id integer UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  lunes_activo boolean DEFAULT false,
  lunes_hora_inicio time,
  lunes_hora_salida time,
  lunes_colacion_inicio time,
  lunes_colacion_salida time,
  martes_activo boolean DEFAULT false,
  martes_hora_inicio time,
  martes_hora_salida time,
  martes_colacion_inicio time,
  martes_colacion_salida time,
  miercoles_activo boolean DEFAULT false,
  miercoles_hora_inicio time,
  miercoles_hora_salida time,
  miercoles_colacion_inicio time,
  miercoles_colacion_salida time,
  jueves_activo boolean DEFAULT false,
  jueves_hora_inicio time,
  jueves_hora_salida time,
  jueves_colacion_inicio time,
  jueves_colacion_salida time,
  viernes_activo boolean DEFAULT false,
  viernes_hora_inicio time,
  viernes_hora_salida time,
  viernes_colacion_inicio time,
  viernes_colacion_salida time
);

CREATE TABLE vehiculos (
  id serial PRIMARY KEY,
  patente varchar(10) UNIQUE NOT NULL,
  marca varchar(50) NOT NULL,
  modelo varchar(50) NOT NULL,
  año_modelo integer,
  vin varchar(50) UNIQUE,
  conductor_actual_id integer REFERENCES usuarios(id),
  estado varchar(20) DEFAULT 'OPERATIVO' CHECK (estado IN ('OPERATIVO', 'EN_REVISION', 'STANDBY', 'CITA_MANTENCION', 'EN_TALLER', 'MANTENCION', 'COMPLETADO', 'LISTO_PARA_RETIRO', 'INACTIVO')),
  ultima_novedad varchar(150),
  ultima_novedad_detalle text,
  ultima_novedad_fecha timestamp,
  fecha_creacion timestamp DEFAULT (now())
);

CREATE TABLE repuestos (
  id serial PRIMARY KEY,
  sku varchar(50) UNIQUE NOT NULL,
  nombre varchar(200) NOT NULL,
  descripcion text,
  unidad varchar(20) NOT NULL,
  precio_costo decimal(10,2),
  informacion_proveedor text,
  activo boolean DEFAULT true,
  fecha_creacion timestamp DEFAULT (now())
);

-- ========================================================
-- TABLAS DE SOLICITUDES (Flujo inicial)
-- ========================================================

CREATE TABLE solicitudes_mantenimiento (
  id serial PRIMARY KEY,
  numero_solicitud varchar(20) UNIQUE NOT NULL,
  vehiculo_id integer NOT NULL REFERENCES vehiculos(id),
  conductor_id integer REFERENCES usuarios(id),
  tipo_solicitud varchar(20) NOT NULL CHECK (tipo_solicitud IN ('REVISION', 'EMERGENCIA')),
  descripcion_problema text NOT NULL,
  urgencia varchar(10) DEFAULT 'NORMAL' CHECK (urgencia IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
  evidencia_foto_principal text NOT NULL,
  evidencia_foto_adicional_1 text,
  evidencia_foto_adicional_2 text,
  evidencia_foto_adicional_3 text,
  evidencia_foto_adicional_4 text,
  evidencia_foto_adicional_5 text,
  estado varchar(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CONVERTIDA_OT', 'CITA_MANTENCION')),
  fecha_solicitud timestamp DEFAULT (now()),
  fecha_aprobacion timestamp,
  aprobado_por integer REFERENCES usuarios(id),
  comentarios_aprobacion text,
  visible boolean DEFAULT true,
  fecha_creacion timestamp DEFAULT (now()),
  fecha_actualizacion timestamp DEFAULT (now())
);

-- ========================================================
-- TABLAS DE ÓRDENES DE TRABAJO (Núcleo del sistema)
-- ========================================================

CREATE TABLE ordenes_trabajo (
  id serial PRIMARY KEY,
  numero_ot varchar(20) UNIQUE NOT NULL,
  solicitud_id integer REFERENCES solicitudes_mantenimiento(id),
  vehiculo_id integer NOT NULL REFERENCES vehiculos(id),
  taller_id integer NOT NULL REFERENCES talleres(id),
  jefe_taller_id integer NOT NULL REFERENCES usuarios(id),
  mecanico_asignado_id integer REFERENCES usuarios(id),
  
  -- Información del problema
  descripcion_problema text NOT NULL,
  diagnostico_inicial text,
  prioridad varchar(10) DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
  prioridad_diagnosticada varchar(10) DEFAULT 'NORMAL' CHECK (prioridad_diagnosticada IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),

  discrepancia_diagnostico boolean DEFAULT false,
  discrepancia_diagnostico_detalle text,
  discrepancia_diagnostico_fecha timestamp,
  discrepancia_diagnostico_por integer REFERENCES usuarios(id),

  discrepancia_diagnostico_aprobada boolean DEFAULT false,
  discrepancia_diagnostico_aprobada_detalle text,
  discrepancia_diagnostico_aprobada_fecha timestamp,
  discrepancia_diagnostico_aprobada_por integer REFERENCES usuarios(id),

  discrepancia_diagnostico_rechazada boolean DEFAULT false,
  discrepancia_diagnostico_rechazada_detalle text,
  discrepancia_diagnostico_rechazada_fecha timestamp,
  discrepancia_diagnostico_rechazada_por integer REFERENCES usuarios(id),

  -- Estados y fechas
  estado varchar(40) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'LISTO', 'APROBADO', 'COMPLETADO', 'CANCELADA', 'PENDIENTE_AUTORIZACION_SUPERVISOR', 'PENDIENTE_VERIFICACION'
  )),
  fecha_apertura timestamp DEFAULT (now()),
  fecha_asignacion timestamp,
  fecha_inicio_trabajo timestamp,
  fecha_estimada_termino timestamp,
  fecha_ingreso_recepcion timestamp,
  fecha_finalizacion timestamp,
  fecha_aprobacion timestamp,
  fecha_cierre timestamp,
  
  -- Control de repuestos
  bloqueado_por_repuestos boolean DEFAULT false,
  
  -- Cierre de trabajo (mecánico)
  descripcion_proceso_realizado text,
  cierre_evidencias text[],
  comentario_rechazo text,
  
  -- Auditoría
  fecha_creacion timestamp DEFAULT (now()),
  fecha_actualizacion timestamp DEFAULT (now())
);

CREATE TABLE tareas_ot (
  id serial PRIMARY KEY,
  orden_trabajo_id integer NOT NULL REFERENCES ordenes_trabajo(id),
  titulo varchar(200) NOT NULL,
  descripcion text,
  estado varchar(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA')),
  mecanico_asignado_id integer REFERENCES usuarios(id),
  horas_estimadas decimal(4,2),
  horas_reales decimal(4,2),
  fecha_inicio timestamp,
  fecha_fin timestamp,
  fecha_creacion timestamp DEFAULT (now())
);

CREATE TABLE ot_items (
  id serial PRIMARY KEY,
  orden_trabajo_id integer NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  repuesto_id integer NOT NULL REFERENCES repuestos(id),
  cantidad_solicitada numeric(12,2) NOT NULL CHECK (cantidad_solicitada > 0),
  cantidad_aprobada numeric(12,2) DEFAULT 0,
  cantidad_utilizada numeric(12,2) DEFAULT 0,
  estado varchar(20) DEFAULT 'SOLICITADO' CHECK (estado IN ('SOLICITADO', 'APROBADO', 'RECHAZADO', 'ENTREGADO', 'UTILIZADO')),
  fecha_creacion timestamp DEFAULT (now())
);

-- ========================================================
-- TABLAS DE INVENTARIO Y REPUESTOS
-- ========================================================

CREATE TABLE inventarios (
  id serial PRIMARY KEY,
  taller_id integer NOT NULL REFERENCES talleres(id),
  repuesto_id integer NOT NULL REFERENCES repuestos(id),
  cantidad_disponible integer NOT NULL DEFAULT 0,
  nivel_minimo_stock integer DEFAULT 5,
  nivel_maximo_stock integer DEFAULT 50,
  ubicacion_almacen varchar(100),
  fecha_ultimo_reabastecimiento timestamp,
  fecha_creacion timestamp DEFAULT (now()),
  fecha_actualizacion timestamp DEFAULT (now()),
  UNIQUE(taller_id, repuesto_id)
);

CREATE TABLE movimientos_repuestos (
  id serial PRIMARY KEY,
  taller_id integer NOT NULL REFERENCES talleres(id),
  repuesto_id integer NOT NULL REFERENCES repuestos(id),
  orden_trabajo_id integer REFERENCES ordenes_trabajo(id),
  tipo_movimiento varchar(10) NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  cantidad integer NOT NULL,
  costo_unitario decimal(10,2),
  motivo text,
  movido_por integer NOT NULL REFERENCES usuarios(id),
  fecha_movimiento timestamp DEFAULT (now()),
  fecha_creacion timestamp DEFAULT (now())
);

CREATE TABLE solicitudes_repuestos (
  id serial PRIMARY KEY,
  orden_trabajo_id integer NOT NULL REFERENCES ordenes_trabajo(id),
  repuesto_id integer NOT NULL REFERENCES repuestos(id),
  cantidad_solicitada integer NOT NULL,
  urgencia varchar(10) DEFAULT 'NORMAL' CHECK (urgencia IN ('NORMAL', 'URGENTE')),
  estado varchar(20) DEFAULT 'SOLICITADA' CHECK (estado IN ('SOLICITADA', 'APROBADA', 'RECHAZADA', 'COMPRADA', 'RECIBIDA')),
  comentarios text,
  solicitado_por integer NOT NULL REFERENCES usuarios(id),
  fecha_solicitud timestamp DEFAULT (now()),
  fecha_aprobacion timestamp,
  fecha_estimada_entrega date,
  fecha_creacion timestamp DEFAULT (now()),
  fecha_actualizacion timestamp DEFAULT (now())
);

-- ========================================================
-- TABLAS DE SEGUIMIENTO Y AUDITORÍA
-- ========================================================

CREATE TABLE log_estados_ot (
  id serial PRIMARY KEY,
  orden_trabajo_id integer NOT NULL REFERENCES ordenes_trabajo(id),
  estado_anterior varchar(40),
  estado_nuevo varchar(40) NOT NULL,
  cambiado_por integer NOT NULL REFERENCES usuarios(id),
  motivo_cambio text,
  fecha_cambio timestamp DEFAULT (now())
);

CREATE TABLE entregas_vehiculos (
  id serial PRIMARY KEY,
  orden_trabajo_id integer NOT NULL REFERENCES ordenes_trabajo(id),
  tipo_entrega varchar(10) NOT NULL CHECK (tipo_entrega IN ('ENTRADA', 'SALIDA')),
  conductor_id integer NOT NULL REFERENCES usuarios(id),
  responsable_taller_id integer NOT NULL REFERENCES usuarios(id),
  datos_firma text,
  fecha_firma timestamp DEFAULT (now()),
  condicion_vehiculo text,
  observaciones text,
  fecha_creacion timestamp DEFAULT (now())
);

CREATE TABLE archivos_adjuntos (
  id serial PRIMARY KEY,
  tipo_entidad varchar(20) NOT NULL CHECK (tipo_entidad IN ('SOLICITUD', 'ORDEN_TRABAJO', 'VEHICULO')),
  entidad_id integer NOT NULL,
  tipo_archivo varchar(20) NOT NULL,
  nombre_archivo varchar(255) NOT NULL,
  ruta_archivo varchar(500) NOT NULL,
  tamaño_archivo integer,
  tipo_mime varchar(100),
  subido_por integer NOT NULL REFERENCES usuarios(id),
  fecha_subida timestamp DEFAULT (now())
);

CREATE TABLE breaks_mecanico (
  id serial PRIMARY KEY,
  mecanico_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hora_inicio timestamp NOT NULL DEFAULT (now()),
  hora_termino timestamp,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  anno integer NOT NULL CHECK (anno >= 2000 AND anno <= 2100),
  fecha_creacion timestamp DEFAULT (now()),
  fecha_actualizacion timestamp DEFAULT (now())
);

CREATE INDEX idx_breaks_mecanico_mecanico ON breaks_mecanico(mecanico_id);
CREATE INDEX idx_breaks_mecanico_mes_anno ON breaks_mecanico(mecanico_id, mes, anno);
CREATE INDEX idx_breaks_mecanico_hora_inicio ON breaks_mecanico(mecanico_id, hora_inicio DESC);

CREATE TABLE notificaciones (
  id serial PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id),
  titulo varchar(200) NOT NULL,
  mensaje text NOT NULL,
  tipo_notificacion varchar(30) NOT NULL,
  tipo_entidad_relacionada varchar(20),
  entidad_relacionada_id integer,
  leida boolean DEFAULT false,
  fecha_lectura timestamp,
  fecha_creacion timestamp DEFAULT (now())
);

CREATE TABLE log_auditoria (
  id serial PRIMARY KEY,
  usuario_id integer REFERENCES usuarios(id),
  accion varchar(50) NOT NULL,
  tipo_entidad varchar(50),
  entidad_id integer,
  valores_anteriores jsonb,
  valores_nuevos jsonb,
  direccion_ip inet,
  agente_usuario text,
  fecha_creacion timestamp DEFAULT (now())
);

-- ========================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ========================================================

-- Usuarios
CREATE UNIQUE INDEX uq_usuarios_email ON usuarios(email);
CREATE UNIQUE INDEX uq_usuarios_rut ON usuarios(rut);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- Vehículos
CREATE UNIQUE INDEX uq_vehiculos_patente ON vehiculos(patente);
CREATE UNIQUE INDEX uq_vehiculos_vin ON vehiculos(vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_vehiculos_estado ON vehiculos(estado);
CREATE INDEX idx_vehiculos_conductor ON vehiculos(conductor_actual_id);

-- Solicitudes
CREATE UNIQUE INDEX uq_solicitudes_numero ON solicitudes_mantenimiento(numero_solicitud);
CREATE INDEX idx_solicitudes_vehiculo ON solicitudes_mantenimiento(vehiculo_id);
CREATE INDEX idx_solicitudes_conductor ON solicitudes_mantenimiento(conductor_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes_mantenimiento(estado);
CREATE INDEX idx_solicitudes_tipo ON solicitudes_mantenimiento(tipo_solicitud);
CREATE INDEX idx_solicitudes_fecha ON solicitudes_mantenimiento(fecha_solicitud);

-- Órdenes de Trabajo
CREATE UNIQUE INDEX uq_ordenes_numero ON ordenes_trabajo(numero_ot);
CREATE INDEX idx_ordenes_vehiculo ON ordenes_trabajo(vehiculo_id);
CREATE INDEX idx_ordenes_taller ON ordenes_trabajo(taller_id);
CREATE INDEX idx_ordenes_estado ON ordenes_trabajo(estado);
CREATE INDEX idx_ordenes_mecanico ON ordenes_trabajo(mecanico_asignado_id);
CREATE INDEX idx_ordenes_jefe_taller ON ordenes_trabajo(jefe_taller_id);
CREATE INDEX idx_ordenes_fecha_apertura ON ordenes_trabajo(fecha_apertura);
CREATE INDEX idx_ordenes_solicitud ON ordenes_trabajo(solicitud_id);

-- Tareas OT
CREATE INDEX idx_tareas_orden ON tareas_ot(orden_trabajo_id);
CREATE INDEX idx_tareas_mecanico ON tareas_ot(mecanico_asignado_id);
CREATE INDEX idx_tareas_estado ON tareas_ot(estado);

-- Items OT
CREATE INDEX idx_ot_items_orden ON ot_items(orden_trabajo_id);
CREATE INDEX idx_ot_items_repuesto ON ot_items(repuesto_id);
CREATE INDEX idx_ot_items_estado ON ot_items(estado);

-- Inventarios
CREATE UNIQUE INDEX uq_inventarios_taller_repuesto ON inventarios(taller_id, repuesto_id);
CREATE INDEX idx_inventarios_taller ON inventarios(taller_id);
CREATE INDEX idx_inventarios_repuesto ON inventarios(repuesto_id);
CREATE INDEX idx_inventarios_stock ON inventarios(cantidad_disponible);

-- Movimientos Repuestos
CREATE INDEX idx_movimientos_taller ON movimientos_repuestos(taller_id);
CREATE INDEX idx_movimientos_repuesto ON movimientos_repuestos(repuesto_id);
CREATE INDEX idx_movimientos_orden ON movimientos_repuestos(orden_trabajo_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_repuestos(fecha_movimiento);
CREATE INDEX idx_movimientos_tipo ON movimientos_repuestos(tipo_movimiento);

-- Solicitudes Repuestos
CREATE INDEX idx_solicitudes_rep_orden ON solicitudes_repuestos(orden_trabajo_id);
CREATE INDEX idx_solicitudes_rep_repuesto ON solicitudes_repuestos(repuesto_id);
CREATE INDEX idx_solicitudes_rep_estado ON solicitudes_repuestos(estado);

-- Log Estados OT
CREATE INDEX idx_log_estados_orden ON log_estados_ot(orden_trabajo_id);
CREATE INDEX idx_log_estados_fecha ON log_estados_ot(fecha_cambio);
CREATE INDEX idx_log_estados_usuario ON log_estados_ot(cambiado_por);

-- Entregas Vehículos
CREATE INDEX idx_entregas_orden ON entregas_vehiculos(orden_trabajo_id);
CREATE INDEX idx_entregas_conductor ON entregas_vehiculos(conductor_id);
CREATE INDEX idx_entregas_responsable ON entregas_vehiculos(responsable_taller_id);
CREATE INDEX idx_entregas_fecha ON entregas_vehiculos(fecha_firma);

-- Archivos Adjuntos
CREATE INDEX idx_archivos_entidad ON archivos_adjuntos(tipo_entidad, entidad_id);
CREATE INDEX idx_archivos_tipo ON archivos_adjuntos(tipo_archivo);
CREATE INDEX idx_archivos_usuario ON archivos_adjuntos(subido_por);

-- Notificaciones
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_notificaciones_fecha ON notificaciones(fecha_creacion);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo_notificacion);

-- Log Auditoría
CREATE INDEX idx_auditoria_usuario ON log_auditoria(usuario_id);
CREATE INDEX idx_auditoria_entidad ON log_auditoria(tipo_entidad);
CREATE INDEX idx_auditoria_fecha ON log_auditoria(fecha_creacion);
CREATE INDEX idx_auditoria_accion ON log_auditoria(accion);

-- ========================================================
-- VISTAS ÚTILES
-- ========================================================

-- Vista para mecánicos disponibles (sin OT activas)
CREATE OR REPLACE VIEW mecanicos_disponibles AS
SELECT u.id,
       u.nombre_completo,
       u.email,
       h.lunes_activo,
       h.lunes_hora_inicio,
       h.lunes_hora_salida,
       h.lunes_colacion_inicio,
       h.lunes_colacion_salida,
       h.martes_activo,
       h.martes_hora_inicio,
       h.martes_hora_salida,
       h.martes_colacion_inicio,
       h.martes_colacion_salida,
       h.miercoles_activo,
       h.miercoles_hora_inicio,
       h.miercoles_hora_salida,
       h.miercoles_colacion_inicio,
       h.miercoles_colacion_salida,
       h.jueves_activo,
       h.jueves_hora_inicio,
       h.jueves_hora_salida,
       h.jueves_colacion_inicio,
       h.jueves_colacion_salida,
       h.viernes_activo,
       h.viernes_hora_inicio,
       h.viernes_hora_salida,
       h.viernes_colacion_inicio,
       h.viernes_colacion_salida
FROM usuarios u
LEFT JOIN horarios_trabajo h ON h.usuario_id = u.id
WHERE u.rol = 'MECANICO'
  AND u.activo = true
  AND NOT EXISTS (
    SELECT 1
    FROM ordenes_trabajo ot
    WHERE ot.mecanico_asignado_id = u.id
      AND ot.estado IN ('PENDIENTE', 'EN_PROCESO', 'ESPERA_REPUESTOS')
  )
ORDER BY u.nombre_completo;

-- Vista para stock bajo
CREATE OR REPLACE VIEW stock_bajo AS
SELECT 
  t.nombre as taller,
  r.sku,
  r.nombre as repuesto,
  i.cantidad_disponible,
  i.nivel_minimo_stock
FROM inventarios i
JOIN talleres t ON i.taller_id = t.id
JOIN repuestos r ON i.repuesto_id = r.id
WHERE i.cantidad_disponible <= i.nivel_minimo_stock
  AND r.activo = true
ORDER BY t.nombre, i.cantidad_disponible ASC;

-- Vista para dashboard del jefe de taller
CREATE OR REPLACE VIEW dashboard_jefe_taller AS
SELECT 
  COUNT(*) as total_ots,
  COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as ots_pendientes,
  COUNT(*) FILTER (WHERE estado = 'EN_PROCESO') as ots_en_proceso,
  COUNT(*) FILTER (WHERE estado = 'ESPERA_REPUESTOS') as ots_espera_repuestos,
  COUNT(*) FILTER (WHERE estado = 'LISTO') as ots_listas,
  COUNT(*) FILTER (WHERE estado = 'APROBADO') as ots_aprobadas,
  COUNT(*) FILTER (WHERE fecha_cierre >= CURRENT_DATE) as ots_completadas_hoy
FROM ordenes_trabajo;

-- ========================================================
-- DATOS INICIALES (Dummy Data)
-- ========================================================

-- Insertar talleres básicos
INSERT INTO talleres (nombre, codigo, region, direccion, telefono) VALUES
('Taller Central Santiago', 'TCS', 'Metropolitana', 'Av. Principal 123, Santiago', '+56228888888'),
('Taller Norte Antofagasta', 'TNA', 'Antofagasta', 'Camino Costera 456, Antofagasta', '+55225555555'),
('Taller Sur Concepción', 'TSC', 'Biobío', 'Ruta 160 789, Concepción', '+56227777777');

-- Insertar usuarios dummy para cada rol
-- Contraseña para todos: "password123" (hasheada con bcrypt, rounds 10)
-- IMPORTANTE: Todos estos usuarios tienen la contraseña "password123"
-- Los hashes bcrypt fueron generados con: bcrypt.hash('password123', 10)
-- Cada hash es único debido al salt aleatorio, pero todos validan la misma contraseña
INSERT INTO usuarios (rut, nombre_completo, email, telefono, rol, hash_contrasena, activo) VALUES
-- Sistema
('0-0', 'Sistema', 'sistema@pepsico.cl', '+56911111111', 'ADMIN', 
 '$2a$10$vNAv4qCBedO6tet1AtCosOC1ZNGY/PdZFfrAbduP64Itctd.62OT6', false),
-- Administrador
('12.345.678-9', 'Administrador Sistema', 'admin@pepsico.cl', '+56912345678', 'ADMIN', 
 '$2b$10$MRC3dc5TmitW2RKyomIMxe0ipYy9kRVZoYdE28oOgj9PDjBhOj6Y.', true),
-- Jefe de Taller  
('13.456.789-0', 'Carlos Rodríguez', 'jefe.taller@pepsico.cl', '+56923456789', 'JEFE_TALLER', 
 '$2b$10$q3.C9vOsvGS35NUY4Qp8EOtqkFmA/O4amlyYXgWFui9624xEqjRcq', true),
-- Mecánico
('14.567.890-1', 'María González', 'mecanico@pepsico.cl', '+56934567890', 'MECANICO', 
 '$2b$10$x1jEGx1s1oXYYeFVJiXvKusqGc2YJ5wdfG3Sl/0j7ns2hW1qS7ygS', true),
-- Chofer
('15.678.901-2', 'Juan Pérez', 'chofer@pepsico.cl', '+56945678901', 'CHOFER', 
 '$2b$10$FK9D8fqBrKr1Uo9.ro0cuulbEjBABcD6Xl2J.1mFS63NM.9Okm1ye', true),

('21.116.422-0', 'Alexis Martinez', 'chofer2@pepsico.cl', '+56965849129', 'CHOFER', 
 '$2a$10$zwr2cq2Lh128wGaHgzt6B.UvXzZK7TM8a6U5S87vkGi3vDpAL5gIS', true),
-- Logística
('16.789.012-3', 'Ana Silva', 'logistica@pepsico.cl', '+56956789012', 'LOGISTICA', 
 '$2b$10$w5j15iA2uCRQ9kWZ0cM0n.KLuVqkUgwImlH4l7vDEN/nnD8mzB9ji', true),
-- Recepcionista
('18.901.234-5', 'Lucía Herrera', 'recepcionista@pepsico.cl', '+56967890011', 'RECEPCIONISTA',
 '$2a$10$KrNvNVncyiCAfu3ZzEsLA.Vc5jDmfKpL.6QQr44M1ovDDQUQ5xOZ2', true),
-- Bodeguero
('19.012.345-6', 'Roberto Vargas', 'bodeguero@pepsico.cl', '+56978901234', 'BODEGUERO',
 '$2a$10$ScgtrE2naLUJ5HFc7lBfDu5rg8OSVl/DiRgeBkmofG8cW/pNRy2vy', true);

INSERT INTO horarios_trabajo (
  usuario_id,
  lunes_activo, lunes_hora_inicio, lunes_hora_salida, lunes_colacion_inicio, lunes_colacion_salida,
  martes_activo, martes_hora_inicio, martes_hora_salida, martes_colacion_inicio, martes_colacion_salida,
  miercoles_activo, miercoles_hora_inicio, miercoles_hora_salida, miercoles_colacion_inicio, miercoles_colacion_salida,
  jueves_activo, jueves_hora_inicio, jueves_hora_salida, jueves_colacion_inicio, jueves_colacion_salida,
  viernes_activo, viernes_hora_inicio, viernes_hora_salida, viernes_colacion_inicio, viernes_colacion_salida
)
SELECT
  id,
  true, '09:00', '17:00', '13:00', '14:00',
  true, '09:00', '17:00', '13:00', '14:00',
  true, '09:00', '17:00', '13:00', '14:00',
  true, '09:00', '17:00', '13:00', '14:00',
  true, '09:00', '17:00', '13:00', '14:00'
FROM usuarios
WHERE email IN (
  'admin@pepsico.cl',
  'jefe.taller@pepsico.cl',
  'mecanico@pepsico.cl',
  'chofer@pepsico.cl',
  'chofer2@pepsico.cl',
  'logistica@pepsico.cl',
  'recepcionista@pepsico.cl',
  'bodeguero@pepsico.cl'
);

-- Insertar repuestos dummy (mínimo 8)
INSERT INTO repuestos (sku, nombre, descripcion, unidad, precio_costo, informacion_proveedor, activo) VALUES
('REP-001', 'Filtro de Aceite Motor', 'Filtro de aceite estándar para motores diésel', 'Unidad', 12500.00, 'Proveedor: AutoParts Chile - Contacto: +56912345678', true),
('REP-002', 'Pastillas de Freno Delanteras', 'Juego de pastillas de freno delanteras para camiones pesados', 'Juego', 45000.00, 'Proveedor: Frenos Premium - Contacto: +56923456789', true),
('REP-003', 'Aceite Motor 15W-40', 'Aceite lubricante para motores diésel, bidón 20L', 'Bidón', 35000.00, 'Proveedor: Lubricantes SA - Contacto: +56934567890', true),
('REP-004', 'Batería 12V 200Ah', 'Batería de plomo-ácido para vehículos pesados', 'Unidad', 85000.00, 'Proveedor: Energía Total - Contacto: +56945678901', true),
('REP-005', 'Neumático 315/80R22.5', 'Neumático radial para camiones, carga pesada', 'Unidad', 180000.00, 'Proveedor: Neumáticos Pro - Contacto: +56956789012', true),
('REP-006', 'Filtro de Aire', 'Filtro de aire para motores diésel de alto flujo', 'Unidad', 18500.00, 'Proveedor: Filtros Industriales - Contacto: +56967890123', true),
('REP-007', 'Correa de Distribución', 'Correa de distribución reforzada para motores diésel', 'Unidad', 32000.00, 'Proveedor: Transmisiones SA - Contacto: +56978901234', true),
('REP-008', 'Radiador de Refrigerante', 'Radiador completo para sistema de refrigeración', 'Unidad', 125000.00, 'Proveedor: Refrigeración Industrial - Contacto: +56989012345', true),
('REP-009', 'Amortiguador Delantero', 'Amortiguador hidráulico para suspensión delantera', 'Unidad', 65000.00, 'Proveedor: Suspensiones Pro - Contacto: +56990123456', true),
('REP-010', 'Bomba de Combustible', 'Bomba de combustible eléctrica para motores diésel', 'Unidad', 95000.00, 'Proveedor: Sistemas de Combustible - Contacto: +56901234567', true);

-- Insertar inventarios para el taller principal (taller_id = 1)
-- Asumiendo que el taller con id=1 es "Taller Central Santiago"
INSERT INTO inventarios (taller_id, repuesto_id, cantidad_disponible, nivel_minimo_stock, nivel_maximo_stock, ubicacion_almacen, fecha_ultimo_reabastecimiento) VALUES
(1, 1, 25, 10, 50, 'Estante A-01', NOW() - INTERVAL '5 days'),
(1, 2, 8, 5, 30, 'Estante B-02', NOW() - INTERVAL '10 days'),
(1, 3, 15, 8, 40, 'Estante C-03', NOW() - INTERVAL '3 days'),
(1, 4, 6, 3, 20, 'Estante D-04', NOW() - INTERVAL '15 days'),
(1, 5, 12, 4, 25, 'Estante E-05', NOW() - INTERVAL '7 days'),
(1, 6, 20, 10, 50, 'Estante A-06', NOW() - INTERVAL '2 days'),
(1, 7, 4, 2, 15, 'Estante B-07', NOW() - INTERVAL '20 days'),  -- Stock bajo
(1, 8, 2, 3, 10, 'Estante C-08', NOW() - INTERVAL '30 days'),  -- Stock crítico
(1, 9, 10, 5, 25, 'Estante D-09', NOW() - INTERVAL '12 days'),
(1, 10, 7, 4, 20, 'Estante E-10', NOW() - INTERVAL '8 days');

-- Insertar vehículos de ejemplo
-- IMPORTANTE: Cada vehículo debe tener un chofer único (relación 1:1)
-- Los choferes se insertan después de los talleres y otros usuarios:
-- - Talleres: IDs 1, 2, 3
-- - Admin: ID 4
-- - Jefe Taller: ID 5
-- - Mecánico: ID 6
-- - Chofer Juan Pérez: ID 7
-- - Chofer Alexis Martinez: ID 8
-- Usamos los IDs de los choferes directamente para garantizar asignación única
INSERT INTO vehiculos (patente, marca, modelo, año_modelo, vin, conductor_actual_id, estado) VALUES
('BKXL45', 'Volvo', 'FH16', 2022, '1HGCM82633A123456', 
    (SELECT id FROM usuarios WHERE email = 'chofer@pepsico.cl' LIMIT 1), 
    'OPERATIVO'),
('AFGH78', 'Mercedes-Benz', 'Actros', 2021, '2FMDK3GC5DBA65432', 
    (SELECT id FROM usuarios WHERE email = 'chofer2@pepsico.cl' LIMIT 1), 
    'OPERATIVO');

COMMENT ON TABLE solicitudes_mantenimiento IS 'Solicitudes de mantenimiento realizadas por choferes (emergencias o revisiones programadas)';
COMMENT ON TABLE ordenes_trabajo IS 'Órdenes de trabajo generadas por jefes de taller a partir de las solicitudes';
COMMENT ON TABLE ot_items IS 'Items de repuestos solicitados para una orden de trabajo';

-- ========================================================
-- TABLA DE CONFIGURACIÓN
-- ========================================================
CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración inicial de debug (desactivado por defecto)
INSERT INTO config (key, value, updated_at) 
VALUES ('debugMode', 'false', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
COMMENT ON TABLE inventarios IS 'Control de stock de repuestos por taller';