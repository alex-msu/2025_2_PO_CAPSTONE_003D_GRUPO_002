CREATE TABLE "usuarios" (
  "id" serial PRIMARY KEY,
  "rut" varchar(12) UNIQUE NOT NULL,
  "nombre_completo" varchar(100) NOT NULL,
  "email" varchar(100) UNIQUE NOT NULL,
  "telefono" varchar(20),
  "rol_id" integer NOT NULL,
  "hash_contrasena" varchar(255) NOT NULL,
  "estado_usuario_id" integer,
  "activo" boolean DEFAULT true,
  "fecha_creacion" timestamp DEFAULT now(),
  "fecha_actualizacion" timestamp DEFAULT now()
);

CREATE TABLE "roles" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text,
  "activo" boolean DEFAULT true
);

CREATE TABLE "estados_usuario" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text
);

CREATE TABLE "dias_semana" (
  "id" serial PRIMARY KEY,
  "numero_dia" integer NOT NULL,
  "nombre" varchar(10) NOT NULL,
  "activo" boolean DEFAULT true
);

CREATE TABLE "horarios_trabajo" (
  "id" serial PRIMARY KEY,
  "usuario_id" integer NOT NULL,
  "dia_semana_id" integer NOT NULL,
  "activo" boolean DEFAULT false,
  "hora_inicio" time NOT NULL,
  "hora_salida" time NOT NULL,
  "colacion_inicio" time,
  "colacion_salida" time,
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "regiones" (
  "id" serial PRIMARY KEY,
  "nombre" varchar(50) UNIQUE NOT NULL,
  "codigo" varchar(10) UNIQUE NOT NULL,
  "activo" boolean DEFAULT true
);

CREATE TABLE "talleres" (
  "id" serial PRIMARY KEY,
  "nombre" varchar(100) NOT NULL,
  "codigo" varchar(10) UNIQUE NOT NULL,
  "region_id" integer NOT NULL,
  "direccion" text,
  "telefono" varchar(20),
  "activo" boolean DEFAULT true,
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "marcas_vehiculos" (
  "id" serial PRIMARY KEY,
  "nombre" varchar(50) UNIQUE NOT NULL,
  "activo" boolean DEFAULT true
);

CREATE TABLE "modelos_vehiculos" (
  "id" serial PRIMARY KEY,
  "marca_id" integer NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "año" integer,
  "activo" boolean DEFAULT true
);

CREATE TABLE "estados_vehiculo" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text,
  "permite_operacion" boolean DEFAULT false
);

CREATE TABLE "vehiculos" (
  "id" serial PRIMARY KEY,
  "patente" varchar(10) UNIQUE NOT NULL,
  "modelo_id" integer NOT NULL,
  "vin" varchar(50) UNIQUE,
  "conductor_actual_id" integer,
  "estado_id" integer NOT NULL,
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "novedades_vehiculos" (
  "id" serial PRIMARY KEY,
  "vehiculo_id" integer NOT NULL,
  "tipo_novedad" varchar(50) NOT NULL,
  "descripcion_corta" varchar(150),
  "descripcion_detallada" text,
  "fecha_novedad" timestamp DEFAULT now(),
  "reportada_por" integer
);

CREATE TABLE "categorias_repuestos" (
  "id" serial PRIMARY KEY,
  "nombre" varchar(100) NOT NULL,
  "descripcion" text,
  "activo" boolean DEFAULT true
);

CREATE TABLE "unidades_medida" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(10) UNIQUE NOT NULL,
  "nombre" varchar(20) NOT NULL,
  "descripcion" text
);

CREATE TABLE "repuestos" (
  "id" serial PRIMARY KEY,
  "sku" varchar(50) UNIQUE NOT NULL,
  "nombre" varchar(200) NOT NULL,
  "descripcion" text,
  "categoria_id" integer,
  "unidad_id" integer NOT NULL,
  "precio_costo" decimal(10,2),
  "informacion_proveedor" text,
  "activo" boolean DEFAULT true,
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "tipos_movimiento_inventario" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(10) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "afecta_stock" boolean DEFAULT true,
  "signo" integer NOT NULL
);

CREATE TABLE "tipos_solicitud" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text,
  "requiere_aprobacion" boolean DEFAULT true
);

CREATE TABLE "niveles_urgencia" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(10) UNIQUE NOT NULL,
  "nombre" varchar(20) NOT NULL,
  "descripcion" text,
  "nivel_prioridad" integer NOT NULL,
  "color_alerta" varchar(10)
);

CREATE TABLE "estados_solicitud" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text,
  "permite_edicion" boolean DEFAULT true
);

CREATE TABLE "solicitudes_mantenimiento" (
  "id" serial PRIMARY KEY,
  "numero_solicitud" varchar(20) UNIQUE NOT NULL,
  "vehiculo_id" integer NOT NULL,
  "conductor_id" integer NOT NULL,
  "tipo_solicitud_id" integer NOT NULL,
  "descripcion_problema" text NOT NULL,
  "urgencia_id" integer NOT NULL,
  "estado_id" integer NOT NULL,
  "fecha_solicitud" timestamp DEFAULT now(),
  "fecha_aprobacion" timestamp,
  "aprobado_por" integer,
  "comentarios_aprobacion" text,
  "fecha_creacion" timestamp DEFAULT now(),
  "fecha_actualizacion" timestamp DEFAULT now()
);

CREATE TABLE "evidencias_solicitud" (
  "id" serial PRIMARY KEY,
  "solicitud_id" integer NOT NULL,
  "tipo_evidencia" varchar(10) NOT NULL,
  "ruta_archivo" text NOT NULL,
  "descripcion" varchar(200),
  "orden_visual" integer DEFAULT 1,
  "fecha_subida" timestamp DEFAULT now()
);

CREATE TABLE "estados_ot" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(40) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text,
  "grupo_estado" varchar(20) NOT NULL,
  "permite_trabajo" boolean DEFAULT false,
  "orden_flujo" integer NOT NULL
);

CREATE TABLE "ordenes_trabajo" (
  "id" serial PRIMARY KEY,
  "numero_ot" varchar(20) UNIQUE NOT NULL,
  "solicitud_id" integer,
  "vehiculo_id" integer NOT NULL,
  "taller_id" integer NOT NULL,
  "jefe_taller_id" integer NOT NULL,
  "mecanico_asignado_id" integer,
  "descripcion_problema" text NOT NULL,
  "diagnostico_inicial" text,
  "prioridad_id" integer NOT NULL,
  "prioridad_diagnosticada_id" integer,
  "estado_id" integer NOT NULL,
  "fecha_apertura" timestamp DEFAULT now(),
  "fecha_asignacion" timestamp,
  "fecha_inicio_trabajo" timestamp,
  "fecha_estimada_termino" timestamp,
  "fecha_ingreso_recepcion" timestamp,
  "fecha_finalizacion" timestamp,
  "fecha_aprobacion" timestamp,
  "fecha_cierre" timestamp,
  "bloqueado_por_repuestos" boolean DEFAULT false,
  "descripcion_proceso_realizado" text,
  "comentario_rechazo" text,
  "fecha_creacion" timestamp DEFAULT now(),
  "fecha_actualizacion" timestamp DEFAULT now()
);

CREATE TABLE "discrepancias_diagnostico" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "descripcion_diferencia" text NOT NULL,
  "prioridad_sugerida_id" integer,
  "reportada_por" integer NOT NULL,
  "fecha_reporte" timestamp DEFAULT now(),
  "aprobada" boolean DEFAULT false,
  "fecha_aprobacion" timestamp,
  "aprobada_por" integer,
  "comentarios_aprobacion" text,
  "rechazada" boolean DEFAULT false,
  "fecha_rechazo" timestamp,
  "rechazada_por" integer,
  "comentarios_rechazo" text
);

CREATE TABLE "tareas_ot" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "titulo" varchar(200) NOT NULL,
  "descripcion" text,
  "estado_tarea_id" integer NOT NULL,
  "mecanico_asignado_id" integer,
  "horas_estimadas" decimal(4,2),
  "horas_reales" decimal(4,2),
  "fecha_inicio_estimada" timestamp,
  "fecha_fin_estimada" timestamp,
  "fecha_inicio_real" timestamp,
  "fecha_fin_real" timestamp,
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "estados_tarea" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text
);

CREATE TABLE "inventarios" (
  "id" serial PRIMARY KEY,
  "taller_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "cantidad_disponible" integer DEFAULT 0 NOT NULL,
  "nivel_minimo_stock" integer DEFAULT 5,
  "nivel_maximo_stock" integer DEFAULT 50,
  "punto_reorden" integer,
  "ubicacion_almacen" varchar(100),
  "fecha_ultimo_reabastecimiento" timestamp,
  "fecha_creacion" timestamp DEFAULT now(),
  "fecha_actualizacion" timestamp DEFAULT now()
);

CREATE TABLE "movimientos_repuestos" (
  "id" serial PRIMARY KEY,
  "taller_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "orden_trabajo_id" integer,
  "tipo_movimiento_id" integer NOT NULL,
  "cantidad" integer NOT NULL,
  "costo_unitario" decimal(10,2),
  "motivo" text,
  "movido_por" integer NOT NULL,
  "fecha_movimiento" timestamp DEFAULT now(),
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "ot_items" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "cantidad_solicitada" numeric(12,2) NOT NULL,
  "cantidad_aprobada" numeric(12,2) DEFAULT 0,
  "cantidad_utilizada" numeric(12,2) DEFAULT 0,
  "estado_item_id" integer NOT NULL,
  "fecha_creacion" timestamp DEFAULT now()
);

CREATE TABLE "estados_item_ot" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text
);

CREATE TABLE "solicitudes_repuestos" (
  "id" serial PRIMARY KEY,
  "orden_trabajo_id" integer NOT NULL,
  "repuesto_id" integer NOT NULL,
  "cantidad_solicitada" integer NOT NULL,
  "urgencia_id" integer,
  "estado_solicitud_id" integer,
  "comentarios" text,
  "solicitado_por" integer NOT NULL,
  "fecha_solicitud" timestamp DEFAULT now(),
  "fecha_aprobacion" timestamp,
  "fecha_estimada_entrega" date,
  "fecha_creacion" timestamp DEFAULT now(),
  "fecha_actualizacion" timestamp DEFAULT now()
);

CREATE TABLE "estados_solicitud_repuesto" (
  "id" serial PRIMARY KEY,
  "codigo" varchar(20) UNIQUE NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "descripcion" text
);

ALTER TABLE "usuarios" ADD FOREIGN KEY ("rol_id") REFERENCES "roles" ("id");

ALTER TABLE "usuarios" ADD FOREIGN KEY ("estado_usuario_id") REFERENCES "estados_usuario" ("id");

ALTER TABLE "horarios_trabajo" ADD FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id");

ALTER TABLE "horarios_trabajo" ADD FOREIGN KEY ("dia_semana_id") REFERENCES "dias_semana" ("id");

ALTER TABLE "talleres" ADD FOREIGN KEY ("region_id") REFERENCES "regiones" ("id");

ALTER TABLE "modelos_vehiculos" ADD FOREIGN KEY ("marca_id") REFERENCES "marcas_vehiculos" ("id");

ALTER TABLE "vehiculos" ADD FOREIGN KEY ("modelo_id") REFERENCES "modelos_vehiculos" ("id");

ALTER TABLE "vehiculos" ADD FOREIGN KEY ("conductor_actual_id") REFERENCES "usuarios" ("id");

ALTER TABLE "vehiculos" ADD FOREIGN KEY ("estado_id") REFERENCES "estados_vehiculo" ("id");

ALTER TABLE "novedades_vehiculos" ADD FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos" ("id");

ALTER TABLE "novedades_vehiculos" ADD FOREIGN KEY ("reportada_por") REFERENCES "usuarios" ("id");

ALTER TABLE "repuestos" ADD FOREIGN KEY ("categoria_id") REFERENCES "categorias_repuestos" ("id");

ALTER TABLE "repuestos" ADD FOREIGN KEY ("unidad_id") REFERENCES "unidades_medida" ("id");

ALTER TABLE "solicitudes_mantenimiento" ADD FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos" ("id");

ALTER TABLE "solicitudes_mantenimiento" ADD FOREIGN KEY ("conductor_id") REFERENCES "usuarios" ("id");

ALTER TABLE "solicitudes_mantenimiento" ADD FOREIGN KEY ("tipo_solicitud_id") REFERENCES "tipos_solicitud" ("id");

ALTER TABLE "solicitudes_mantenimiento" ADD FOREIGN KEY ("urgencia_id") REFERENCES "niveles_urgencia" ("id");

ALTER TABLE "solicitudes_mantenimiento" ADD FOREIGN KEY ("estado_id") REFERENCES "estados_solicitud" ("id");

ALTER TABLE "solicitudes_mantenimiento" ADD FOREIGN KEY ("aprobado_por") REFERENCES "usuarios" ("id");

ALTER TABLE "evidencias_solicitud" ADD FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_mantenimiento" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_mantenimiento" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("jefe_taller_id") REFERENCES "usuarios" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("mecanico_asignado_id") REFERENCES "usuarios" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("prioridad_id") REFERENCES "niveles_urgencia" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("prioridad_diagnosticada_id") REFERENCES "niveles_urgencia" ("id");

ALTER TABLE "ordenes_trabajo" ADD FOREIGN KEY ("estado_id") REFERENCES "estados_ot" ("id");

ALTER TABLE "discrepancias_diagnostico" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "discrepancias_diagnostico" ADD FOREIGN KEY ("prioridad_sugerida_id") REFERENCES "niveles_urgencia" ("id");

ALTER TABLE "discrepancias_diagnostico" ADD FOREIGN KEY ("reportada_por") REFERENCES "usuarios" ("id");

ALTER TABLE "discrepancias_diagnostico" ADD FOREIGN KEY ("aprobada_por") REFERENCES "usuarios" ("id");

ALTER TABLE "discrepancias_diagnostico" ADD FOREIGN KEY ("rechazada_por") REFERENCES "usuarios" ("id");

ALTER TABLE "tareas_ot" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "tareas_ot" ADD FOREIGN KEY ("estado_tarea_id") REFERENCES "estados_tarea" ("id");

ALTER TABLE "tareas_ot" ADD FOREIGN KEY ("mecanico_asignado_id") REFERENCES "usuarios" ("id");

ALTER TABLE "inventarios" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "inventarios" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("taller_id") REFERENCES "talleres" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("tipo_movimiento_id") REFERENCES "tipos_movimiento_inventario" ("id");

ALTER TABLE "movimientos_repuestos" ADD FOREIGN KEY ("movido_por") REFERENCES "usuarios" ("id");

ALTER TABLE "ot_items" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "ot_items" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "ot_items" ADD FOREIGN KEY ("estado_item_id") REFERENCES "estados_item_ot" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("orden_trabajo_id") REFERENCES "ordenes_trabajo" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("repuesto_id") REFERENCES "repuestos" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("urgencia_id") REFERENCES "niveles_urgencia" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("estado_solicitud_id") REFERENCES "estados_solicitud_repuesto" ("id");

ALTER TABLE "solicitudes_repuestos" ADD FOREIGN KEY ("solicitado_por") REFERENCES "usuarios" ("id");
