import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { SolicitudMantenimiento } from '../../solicitudes/entities/solicitud.entity';

// Entidades mínimas para Foreign Key
@Entity('vehiculos')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  patente!: string;

  @Column({ nullable: true })
  marca?: string;

  @Column({ nullable: true })
  modelo?: string;

  @Column({ default: 'PENDIENTE' })
  estado!: string;

  @Column({ type: 'integer', nullable: true, name: 'conductor_actual_id' })
  conductor_actual_id?: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  ultima_novedad?: string | null;

  @Column({ type: 'text', nullable: true })
  ultima_novedad_detalle?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  ultima_novedad_fecha?: Date | null;
}

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nombre_completo!: string;

  @Column()
  email!: string;

  @Column()
  rol!: string; // 'CHOFER' | 'MECANICO' | 'JEFE_TALLER' | ...

  @Column({ type: 'varchar', length: 20, default: 'ACTIVO', name: 'estado_usuario' })
  estado_usuario!: 'ACTIVO' | 'EN_BREAK' | 'INACTIVO';

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'hash_contrasena' })
  hash_contrasena?: string | null;
}

@Entity('talleres')
export class Shop {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  codigo!: string;

  @Column()
  nombre!: string;
}

@Entity('ordenes_trabajo')
export class WorkOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  numero_ot!: string; // OT-YYYY-000001

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo!: Vehicle;

  @ManyToOne(() => SolicitudMantenimiento, { nullable: true })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud?: SolicitudMantenimiento | null;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'taller_id' })
  taller!: Shop;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'jefe_taller_id' })
  jefe_taller!: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'mecanico_asignado_id' })
  mecanico?: User | null;

  @Column({ type: 'varchar', length: 10, default: 'NORMAL' })
  prioridad!: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

  @Column({ type: 'varchar', length: 10, default: 'NORMAL', name: 'prioridad_diagnosticada' })
  prioridad_diagnosticada?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

  @Column({ type: 'varchar', length: 40, default: 'PENDIENTE' })
  estado!: 'PENDIENTE' | 'EN_PROCESO' | 'ESPERA_REPUESTOS' | 'LISTO' | 'APROBADO' | 'COMPLETADO' | 'CANCELADA' | 'PENDIENTE_AUTORIZACION_SUPERVISOR' | 'PENDIENTE_VERIFICACION';

  @Column({ type: 'text' })
  descripcion_problema!: string;

  @Column({ type: 'text', nullable: true })
  diagnostico_inicial?: string | null;

  @Column({ type: 'boolean', default: false, name: 'discrepancia_diagnostico' })
  discrepancia_diagnostico?: boolean;

  @Column({ type: 'text', nullable: true, name: 'discrepancia_diagnostico_detalle' })
  discrepancia_diagnostico_detalle?: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'discrepancia_diagnostico_fecha' })
  discrepancia_diagnostico_fecha?: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'discrepancia_diagnostico_por' })
  discrepancia_diagnostico_por?: User | null;

  @Column({ type: 'boolean', default: false, name: 'discrepancia_diagnostico_aprobada' })
  discrepancia_diagnostico_aprobada?: boolean;

  @Column({ type: 'text', nullable: true, name: 'discrepancia_diagnostico_aprobada_detalle' })
  discrepancia_diagnostico_aprobada_detalle?: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'discrepancia_diagnostico_aprobada_fecha' })
  discrepancia_diagnostico_aprobada_fecha?: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'discrepancia_diagnostico_aprobada_por' })
  discrepancia_diagnostico_aprobada_por?: User | null;

  @Column({ type: 'boolean', default: false, name: 'discrepancia_diagnostico_rechazada' })
  discrepancia_diagnostico_rechazada?: boolean;

  @Column({ type: 'text', nullable: true, name: 'discrepancia_diagnostico_rechazada_detalle' })
  discrepancia_diagnostico_rechazada_detalle?: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'discrepancia_diagnostico_rechazada_fecha' })
  discrepancia_diagnostico_rechazada_fecha?: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'discrepancia_diagnostico_rechazada_por' })
  discrepancia_diagnostico_rechazada_por?: User | null;

  @Column({ type: 'boolean', default: false, name: 'bloqueado_por_repuestos' })
  bloqueado_por_repuestos!: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_apertura' })
  fecha_apertura?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_asignacion' })
  fecha_asignacion?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_inicio_trabajo' })
  fecha_inicio_trabajo?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_estimada_termino' })
  fecha_estimada_termino?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_ingreso_recepcion' })
  fecha_ingreso_recepcion?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_finalizacion' })
  fecha_finalizacion?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_aprobacion' })
  fecha_aprobacion?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'fecha_cierre' })
  fecha_cierre?: Date | null;

  @Column({ type: 'jsonb', nullable: true, name: 'diagnostico_checklist' })
  diagnostico_checklist?: Record<string, any> | null;

  @Column({ type: 'text', array: true, nullable: true, name: 'diagnostico_evidencias' })
  diagnostico_evidencias?: string[] | null;

  @Column({ type: 'text', nullable: true, name: 'descripcion_proceso_realizado' })
  descripcion_proceso_realizado?: string | null;

  @Column({ type: 'text', array: true, nullable: true, name: 'cierre_evidencias' })
  cierre_evidencias?: string[] | null;

  @Column({ type: 'text', nullable: true, name: 'comentario_rechazo' })
  comentario_rechazo?: string | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion!: Date;
}
