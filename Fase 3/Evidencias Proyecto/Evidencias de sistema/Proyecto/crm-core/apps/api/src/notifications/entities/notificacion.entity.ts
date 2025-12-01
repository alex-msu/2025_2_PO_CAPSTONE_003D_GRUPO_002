import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../../users/entities/user.entity';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'usuario_id' })
  usuarioId!: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Column({ type: 'varchar', length: 200 })
  titulo!: string;

  @Column({ type: 'text' })
  mensaje!: string;

  @Column({ name: 'tipo_notificacion', type: 'varchar', length: 30 })
  tipoNotificacion!: string;

  @Column({ name: 'tipo_entidad_relacionada', type: 'varchar', length: 20, nullable: true })
  tipoEntidadRelacionada?: string | null;

  @Column({ name: 'entidad_relacionada_id', type: 'integer', nullable: true })
  entidadRelacionadaId?: number | null;

  @Column({ type: 'boolean', default: false })
  leida!: boolean;

  @Column({ name: 'fecha_lectura', type: 'timestamp', nullable: true })
  fechaLectura?: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;
}

