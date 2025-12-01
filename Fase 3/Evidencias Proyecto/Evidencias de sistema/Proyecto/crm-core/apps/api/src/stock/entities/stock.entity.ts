// crm-core/apps/api/src/stock/entities/stock.entity.ts
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
import { Shop } from '../../workorders/entities/workorder.entity';

@Entity('repuestos')
export class Repuesto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'varchar', length: 20 })
  unidad!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  precio_costo?: number | null;

  @Column({ type: 'text', nullable: true })
  informacion_proveedor?: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;
}

@Entity('inventarios')
export class Inventario {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'taller_id' })
  taller!: Shop;

  @ManyToOne(() => Repuesto)
  @JoinColumn({ name: 'repuesto_id' })
  repuesto!: Repuesto;

  @Column({ type: 'integer', default: 0 })
  cantidad_disponible!: number;

  @Column({ type: 'integer', default: 5 })
  nivel_minimo_stock!: number;

  @Column({ type: 'integer', default: 50 })
  nivel_maximo_stock!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ubicacion_almacen?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_ultimo_reabastecimiento?: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion!: Date;
}

@Entity('movimientos_repuestos')
export class MovimientoRepuesto {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'taller_id' })
  taller!: Shop;

  @ManyToOne(() => Repuesto)
  @JoinColumn({ name: 'repuesto_id' })
  repuesto!: Repuesto;

  @Column({ type: 'integer', nullable: true })
  orden_trabajo_id?: number | null;

  @Column({ type: 'varchar', length: 10 })
  tipo_movimiento!: 'ENTRADA' | 'SALIDA' | 'AJUSTE';

  @Column({ type: 'integer' })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costo_unitario?: number | null;

  @Column({ type: 'text', nullable: true })
  motivo?: string | null;

  @Column({ type: 'integer' })
  movido_por!: number; // usuario_id

  @CreateDateColumn({ name: 'fecha_movimiento' })
  fecha_movimiento!: Date;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion!: Date;
}

