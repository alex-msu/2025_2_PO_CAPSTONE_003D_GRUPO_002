CREATE TABLE "usuarios" (
  "id" serial PRIMARY KEY,
  "rut" varchar(12) UNIQUE NOT NULL,
  "nombre_completo" varchar(100) NOT NULL,
  "email" varchar(100) UNIQUE NOT NULL,
  "telefono" varchar(20),
  "rol" varchar(20) NOT NULL,
  "hash_contrasena" varchar(255) NOT NULL,
  "activo" boolean DEFAULT true,
  "fecha_creacion" timestamp DEFAULT (now()),
  "fecha_actualizacion" timestamp DEFAULT (now())
);

CREATE TABLE "talleres" (
  "id" serial PRIMARY KEY,
  "nombre" varchar(100) NOT NULL,
  "codigo" varchar(10) UNIQUE NOT NULL,
  "region" varchar(50) NOT NULL,
  "direccion" text,
  "telefono" varchar(20),
  "activo" boolean DEFAULT true,
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "vehiculos" (
  "id" serial PRIMARY KEY,
  "patente" varchar(10) UNIQUE NOT NULL,
  "marca" varchar(50) NOT NULL,
  "modelo" varchar(50) NOT NULL,
  "año_modelo" integer,
  "vin" varchar(50),
  "conductor_actual_id" integer,
  "estado" varchar(20) DEFAULT 'OPERATIVO',
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "reservas_vehiculos" (
  "id" serial PRIMARY KEY,
  "vehiculo_id" integer NOT NULL,
  "taller_id" integer NOT NULL,
  "fecha_inicio_programada" timestamp NOT NULL,
  "fecha_fin_programada" timestamp NOT NULL,
  "proposito" text,
  "estado" varchar(20) DEFAULT 'PROGRAMADO',
  "creado_por" integer NOT NULL,
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "ordenes_trabajo" (
  "id" serial PRIMARY KEY,
  "numero_ot" varchar(20) UNIQUE NOT NULL,
  "vehiculo_id" integer NOT NULL,
  "taller_id" integer NOT NULL,
  "usuario_solicitante_id" integer NOT NULL,
  "mecanico_asignado_id" integer,
  "jefe_taller_id" integer,
  "estado" varchar(20) NOT NULL DEFAULT 'PENDIENTE',
  "prioridad" varchar(10) DEFAULT 'NORMAL',
  "emergencia" boolean DEFAULT false,
  "descripcion_problema" text NOT NULL,
  "diagnostico_inicial" text,
  "fecha_apertura" timestamp DEFAULT (now()),
  "fecha_programada" timestamp,
  "fecha_pausa" timestamp,
  "fecha_reanudacion" timestamp,
  "fecha_finalizacion" timestamp,
  "fecha_cierre" timestamp,
  "bloqueado_por_repuestos" boolean DEFAULT false,
  "fecha_creacion" timestamp DEFAULT (now()),
  "fecha_actualizacion" timestamp DEFAULT (now())
);

CREATE TABLE "log_estados_ot" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "estado_anterior" varchar(20),
  "estado_nuevo" varchar(20) NOT NULL,
  "cambiado_por" integer NOT NULL,
  "motivo_cambio" text,
  "fecha_cambio" timestamp DEFAULT (now())
);

CREATE TABLE "tareas_ot" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "titulo" varchar(200) NOT NULL,
  "descripcion" text,
  "estado" varchar(20) DEFAULT 'PENDIENTE',
  "mecanico_asignado_id" integer,
  "horas_estimadas" decimal(4,2),
  "horas_reales" decimal(4,2),
  "fecha_inicio" timestamp,
  "fecha_fin" timestamp,
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "repuestos" (
  "id" serial PRIMARY KEY,
  "sku" varchar(50) UNIQUE NOT NULL,
  "nombre" varchar(200) NOT NULL,
  "descripcion" text,
  "unidad" varchar(20) NOT NULL,
  "precio_costo" decimal(10,2),
  "informacion_proveedor" text,
  "activo" boolean DEFAULT true,
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "inventarios" (
  "id" serial PRIMARY KEY,
  "taller_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "cantidad_disponible" integer NOT NULL DEFAULT 0,
  "nivel_minimo_stock" integer DEFAULT 0,
  "nivel_maximo_stock" integer,
  "fecha_ultimo_reabastecimiento" timestamp,
  "fecha_creacion" timestamp DEFAULT (now()),
  "fecha_actualizacion" timestamp DEFAULT (now())
);

CREATE TABLE "movimientos_repuestos" (
  "id" serial PRIMARY KEY,
  "taller_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "orden_trabajo_id" integer,
  "tipo_movimiento" varchar(10) NOT NULL,
  "cantidad" integer NOT NULL,
  "costo_unitario" decimal(10,2),
  "motivo" text,
  "movido_por" integer NOT NULL,
  "fecha_movimiento" timestamp DEFAULT (now()),
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "solicitudes_repuestos" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "cantidad_solicitada" integer NOT NULL,
  "urgente" boolean DEFAULT false,
  "estado" varchar(20) DEFAULT 'SOLICITADA',
  "numero_oc" varchar(50),
  "nombre_proveedor" varchar(200),
  "fecha_entrega_estimada" date,
  "creado_por" integer NOT NULL,
  "fecha_creacion" timestamp DEFAULT (now()),
  "fecha_actualizacion" timestamp DEFAULT (now())
);

CREATE TABLE "archivos_adjuntos" (
  "id" serial PRIMARY KEY,
  "tipo_entidad" varchar(20) NOT NULL,
  "entidad_id" integer NOT NULL,
  "tipo_archivo" varchar(20) NOT NULL,
  "nombre_archivo" varchar(255) NOT NULL,
  "ruta_archivo" varchar(500) NOT NULL,
  "tamaño_archivo" integer,
  "tipo_mime" varchar(100),
  "subido_por" integer NOT NULL,
  "fecha_subida" timestamp DEFAULT (now())
);

CREATE TABLE "entregas_vehiculos" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "direccion" varchar(10) NOT NULL,
  "conductor_id" integer NOT NULL,
  "recepcionista_id" integer NOT NULL,
  "datos_firma" text,
  "fecha_firma" timestamp DEFAULT (now()),
  "condicion_vehiculo" text,
  "lectura_odometro" integer,
  "nivel_combustible" varchar(20),
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "emergencias" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "descripcion_ubicacion" text NOT NULL,
  "latitud" decimal(10,8),
  "longitud" decimal(11,8),
  "mecanico_asignado_id" integer,
  "eta_minutos" integer,
  "fecha_llegada_real" timestamp,
  "diagnostico_inicial" text,
  "nivel_emergencia" varchar(10) DEFAULT 'MEDIA',
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "notificaciones" (
  "id" serial PRIMARY KEY,
  "usuario_id" integer NOT NULL,
  "titulo" varchar(200) NOT NULL,
  "mensaje" text NOT NULL,
  "tipo_notificacion" varchar(30) NOT NULL,
  "tipo_entidad_relacionada" varchar(20),
  "entidad_relacionada_id" integer,
  "leida" boolean DEFAULT false,
  "fecha_lectura" timestamp,
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE TABLE "log_auditoria" (
  "id" serial PRIMARY KEY,
  "usuario_id" integer,
  "accion" varchar(50) NOT NULL,
  "tipo_entidad" varchar(50),
  "entidad_id" integer,
  "valores_anteriores" jsonb,
  "valores_nuevos" jsonb,
  "direccion_ip" inet,
  "agente_usuario" text,
  "fecha_creacion" timestamp DEFAULT (now())
);

CREATE UNIQUE INDEX ON "usuarios" ("email");

CREATE UNIQUE INDEX ON "usuarios" ("rut");

CREATE INDEX ON "usuarios" ("rol");

CREATE UNIQUE INDEX ON "talleres" ("codigo");

CREATE INDEX ON "talleres" ("region");

CREATE UNIQUE INDEX ON "vehiculos" ("patente");

CREATE INDEX ON "vehiculos" ("conductor_actual_id");

CREATE INDEX ON "vehiculos" ("estado");

CREATE INDEX ON "reservas_vehiculos" ("vehiculo_id");

CREATE INDEX ON "reservas_vehiculos" ("taller_id");

CREATE INDEX ON "reservas_vehiculos" ("fecha_inicio_programada", "fecha_fin_programada");

CREATE INDEX ON "reservas_vehiculos" ("creado_por");

CREATE UNIQUE INDEX ON "ordenes_trabajo" ("numero_ot");

CREATE INDEX ON "ordenes_trabajo" ("vehiculo_id");

CREATE INDEX ON "ordenes_trabajo" ("taller_id");

CREATE INDEX ON "ordenes_trabajo" ("estado");

CREATE INDEX ON "ordenes_trabajo" ("mecanico_asignado_id");

CREATE INDEX ON "ordenes_trabajo" ("fecha_apertura", "fecha_cierre");

CREATE INDEX ON "ordenes_trabajo" ("emergencia");

CREATE INDEX ON "log_estados_ot" ("orden_trabajo_id");

CREATE INDEX ON "log_estados_ot" ("fecha_cambio");

CREATE INDEX ON "log_estados_ot" ("cambiado_por");

CREATE INDEX ON "tareas_ot" ("orden_trabajo_id");

CREATE INDEX ON "tareas_ot" ("mecanico_asignado_id");

CREATE INDEX ON "tareas_ot" ("estado");

CREATE UNIQUE INDEX ON "repuestos" ("sku");

CREATE INDEX ON "repuestos" ("nombre");

CREATE UNIQUE INDEX ON "inventarios" ("taller_id", "repuesto_id");

CREATE INDEX ON "inventarios" ("taller_id");

CREATE INDEX ON "inventarios" ("repuesto_id");

CREATE INDEX ON "movimientos_repuestos" ("taller_id");

CREATE INDEX ON "movimientos_repuestos" ("repuesto_id");

CREATE INDEX ON "movimientos_repuestos" ("orden_trabajo_id");

CREATE INDEX ON "movimientos_repuestos" ("fecha_movimiento");

CREATE INDEX ON "movimientos_repuestos" ("tipo_movimiento");

CREATE INDEX ON "solicitudes_repuestos" ("orden_trabajo_id");

CREATE INDEX ON "solicitudes_repuestos" ("repuesto_id");

CREATE INDEX ON "solicitudes_repuestos" ("estado");

CREATE INDEX ON "solicitudes_repuestos" ("numero_oc");

CREATE INDEX ON "archivos_adjuntos" ("tipo_entidad", "entidad_id");

CREATE INDEX ON "archivos_adjuntos" ("tipo_archivo");

CREATE INDEX ON "archivos_adjuntos" ("subido_por");

CREATE INDEX ON "entregas_vehiculos" ("orden_trabajo_id");

CREATE INDEX ON "entregas_vehiculos" ("conductor_id");

CREATE INDEX ON "entregas_vehiculos" ("recepcionista_id");

CREATE INDEX ON "entregas_vehiculos" ("direccion");

CREATE UNIQUE INDEX ON "emergencias" ("orden_trabajo_id");

CREATE INDEX ON "emergencias" ("mecanico_asignado_id");

CREATE INDEX ON "emergencias" ("nivel_emergencia");

CREATE INDEX ON "notificaciones" ("usuario_id");

CREATE INDEX ON "notificaciones" ("leida");

CREATE INDEX ON "notificaciones" ("fecha_creacion");

CREATE INDEX ON "notificaciones" ("tipo_notificacion");

CREATE INDEX ON "log_auditoria" ("usuario_id");

CREATE INDEX ON "log_auditoria" ("tipo_entidad");

CREATE INDEX ON "log_auditoria" ("fecha_creacion");

CREATE INDEX ON "log_auditoria" ("accion");

ALTER TABLE "vehiculos" ADD FOREIGN KEY ("conductor_actual_id") REFERENCES "usuarios" ("id");

ALTER TABLE "reservas_vehiculos" ADD FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos" ("id");

ALTER TABLE "reservas_vehiculos" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "reservas_vehiculos" ADD FOREIGN KEY ("creado_por") REFERENCES "usuarios" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("usuario_solicitante_id") REFERENCES "usuarios" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("mecanico_asignado_id") REFERENCES "usuarios" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("jefe_taller_id") REFERENCES "usuarios" ("id");

ALTER TABLE "log_estados_ot" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "log_estados_ot" ADD FOREIGN KEY ("cambiado_por") REFERENCES "usuarios" ("id");

ALTER TABLE "tareas_ot" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "tareas_ot" ADD FOREIGN KEY ("mecanico_asignado_id") REFERENCES "usuarios" ("id");

ALTER TABLE "inventarios" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "inventarios" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("movido_por") REFERENCES "usuarios" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("creado_por") REFERENCES "usuarios" ("id");

ALTER TABLE "archivos_adjuntos" ADD FOREIGN KEY ("subido_por") REFERENCES "usuarios" ("id");

ALTER TABLE "entregas_vehiculos" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "entregas_vehiculos" ADD FOREIGN KEY ("conductor_id") REFERENCES "usuarios" ("id");

ALTER TABLE "entregas_vehiculos" ADD FOREIGN KEY ("recepcionista_id") REFERENCES "usuarios" ("id");

ALTER TABLE "emergencias" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "emergencias" ADD FOREIGN KEY ("mecanico_asignado_id") REFERENCES "usuarios" ("id");

ALTER TABLE "notificaciones" ADD FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id");

ALTER TABLE "log_auditoria" ADD FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id");
