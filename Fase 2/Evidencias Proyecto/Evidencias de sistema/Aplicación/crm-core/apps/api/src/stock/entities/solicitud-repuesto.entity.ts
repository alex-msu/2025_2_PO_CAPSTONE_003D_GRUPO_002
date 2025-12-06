// crm-core/apps/api/src/stock/entities/solicitud-repuesto.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { WorkOrder } from '../../workorders/entities/workorder.entity';
import { Repuesto } from './stock.entity';
import { Usuario } from '../../users/entities/user.entity';

@Entity('solicitudes_repuestos')
export class SolicitudRepuesto {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => WorkOrder)
  @JoinColumn({ name: 'orden_trabajo_id' })
  orden_trabajo!: WorkOrder;

  @ManyToOne(() => Repuesto)
  @JoinColumn({ name: 'repuesto_id' })
  repuesto!: Repuesto;

  @Column({ type: 'integer' })
  cantidad_solicitada!: number;

  @Column({ type: 'varchar', length: 10, default: 'NORMAL' })
  urgencia!: 'NORMAL' | 'URGENTE';

  @Column({ type: 'varchar', length: 20, default: 'SOLICITADA' })
  estado!: 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'COMPRADA' | 'RECIBIDA';

  @Column({ type: 'text', nullable: true })
  comentarios?: string | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'solicitado_por' })
  solicitado_por_user!: Usuario;

  @Column({ type: 'integer' })
  solicitado_por!: number; // usuario_id

  @CreateDateColumn({ name: 'fecha_solicitud' })
  fecha_solicitud!: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_aprobacion?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_estimada_entrega?: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion!: Date;
}

