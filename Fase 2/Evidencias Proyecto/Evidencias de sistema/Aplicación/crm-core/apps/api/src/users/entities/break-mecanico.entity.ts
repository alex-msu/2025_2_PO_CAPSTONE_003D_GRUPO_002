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
import { Usuario } from './user.entity';

@Entity('breaks_mecanico')
export class BreakMecanico {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'mecanico_id' })
  mecanico!: Usuario;

  @Column({ type: 'integer' })
  mecanico_id!: number; // usuario_id

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  hora_inicio!: Date;

  @Column({ type: 'timestamp', nullable: true })
  hora_termino?: Date | null;

  @Index()
  @Column({ type: 'integer' })
  mes!: number; // 1-12

  @Index()
  @Column({ type: 'integer' })
  anno!: number; // 2000-2100

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion!: Date;
}

