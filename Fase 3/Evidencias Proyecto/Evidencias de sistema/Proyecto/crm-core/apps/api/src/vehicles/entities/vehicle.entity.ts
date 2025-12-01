import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index
} from 'typeorm';
import { Usuario } from '../../users/entities/user.entity';

@Entity('vehiculos') // Conecta a la tabla "vehiculos" de tu SQL
export class Vehiculo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10 })
  patente!: string;

  @Column({ type: 'varchar', length: 50 })
  marca!: string;

  @Column({ type: 'varchar', length: 50 })
  modelo!: string;

  @Column({ type: 'int', nullable: true, name: 'año_modelo' })
  anio_modelo!: number | null; // Mapea a "año_modelo" en SQL

  @Column({ type: 'varchar', length: 50, nullable: true })
  vin!: string | null;

  @Column({ type: 'int', nullable: true, name: 'conductor_actual_id' })
  conductor_actual_id!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'OPERATIVO' })
  estado!: string; // OPERATIVO, EN_TALLER, MANTENCION, INACTIVO

  @Column({ type: 'varchar', length: 150, nullable: true, name: 'ultima_novedad' })
  ultima_novedad!: string | null;

  @Column({ type: 'text', nullable: true, name: 'ultima_novedad_detalle' })
  ultima_novedad_detalle!: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'ultima_novedad_fecha' })
  ultima_novedad_fecha!: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;
}