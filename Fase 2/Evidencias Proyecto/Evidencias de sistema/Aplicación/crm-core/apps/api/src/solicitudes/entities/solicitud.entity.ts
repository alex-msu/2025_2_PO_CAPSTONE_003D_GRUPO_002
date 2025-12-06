import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vehiculo } from '../../vehicles/entities/vehicle.entity';
import { Usuario } from '../../users/entities/user.entity';

@Entity('solicitudes_mantenimiento')
export class SolicitudMantenimiento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'numero_solicitud', unique: true })
  numero_solicitud!: string;

  @ManyToOne(() => Vehiculo)
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo!: Vehiculo;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'conductor_id' })
  conductor!: Usuario | null;

  @Column({ name: 'tipo_solicitud', type: 'varchar', length: 20 })
  tipo_solicitud!: 'REVISION' | 'EMERGENCIA';

  @Column({ name: 'descripcion_problema', type: 'text' })
  descripcion_problema!: string;

  @Column({ type: 'varchar', length: 10, default: 'NORMAL' })
  urgencia!: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

  @Column({ name: 'evidencia_foto_principal', type: 'text' })
  evidencia_foto_principal!: string;

  @Column({ name: 'evidencia_foto_adicional_1', type: 'text', nullable: true })
  evidencia_foto_adicional_1?: string | null;

  @Column({ name: 'evidencia_foto_adicional_2', type: 'text', nullable: true })
  evidencia_foto_adicional_2?: string | null;

  @Column({ name: 'evidencia_foto_adicional_3', type: 'text', nullable: true })
  evidencia_foto_adicional_3?: string | null;

  @Column({ name: 'evidencia_foto_adicional_4', type: 'text', nullable: true })
  evidencia_foto_adicional_4?: string | null;

  @Column({ name: 'evidencia_foto_adicional_5', type: 'text', nullable: true })
  evidencia_foto_adicional_5?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estado!: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CONVERTIDA_OT' | 'CITA_MANTENCION';

  @Column({ name: 'fecha_solicitud', type: 'timestamp', default: () => 'now()' })
  fecha_solicitud!: Date;

  @Column({ name: 'fecha_aprobacion', type: 'timestamp', nullable: true })
  fecha_aprobacion?: Date | null;

  @Column({ name: 'aprobado_por', type: 'int', nullable: true })
  aprobado_por?: number | null;

  @Column({ name: 'comentarios_aprobacion', type: 'text', nullable: true })
  comentarios_aprobacion?: string | null;

  @Column({ type: 'boolean', default: true })
  visible!: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion!: Date;
}

