import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

@Entity('usuarios') // Conecta a la tabla "usuarios" de tu SQL
export class Usuario { // <-- CLASE EN ESPAÑOL
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  rut!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre_completo!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 20 })
  rol!: string;

  @Column({ type: 'varchar', length: 255 })
  hash_contrasena!: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVO', name: 'estado_usuario' })
  estado_usuario!: 'ACTIVO' | 'EN_BREAK' | 'INACTIVO';
  
  // NOTA: Los mecánicos ya no se asignan directamente a vehículos.
  // La asignación de mecánicos se hace a través de órdenes de trabajo.
  // Si necesitas obtener los vehículos asignados a un mecánico, consulta las órdenes de trabajo.
  
  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion!: Date;
}