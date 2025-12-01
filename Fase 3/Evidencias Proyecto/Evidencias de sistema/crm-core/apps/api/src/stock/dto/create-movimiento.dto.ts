import { IsNumber, IsString, IsIn, IsOptional, MaxLength, IsInt, Min } from 'class-validator';

export class CreateMovimientoDto {
  @IsNumber({}, { message: 'El ID del repuesto debe ser un número' })
  @IsInt({ message: 'El ID del repuesto debe ser un número entero' })
  repuesto_id!: number;

  @IsNumber({}, { message: 'El ID del taller debe ser un número' })
  @IsInt({ message: 'El ID del taller debe ser un número entero' })
  taller_id!: number;

  @IsOptional()
  @IsNumber({}, { message: 'El ID de la orden de trabajo debe ser un número' })
  @IsInt({ message: 'El ID de la orden de trabajo debe ser un número entero' })
  orden_trabajo_id?: number;

  @IsString({ message: 'El tipo de movimiento debe ser un texto' })
  @IsIn(['ENTRADA', 'SALIDA', 'AJUSTE'], { message: 'El tipo de movimiento debe ser ENTRADA, SALIDA o AJUSTE' })
  tipo_movimiento!: 'ENTRADA' | 'SALIDA' | 'AJUSTE';

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  cantidad!: number;

  @IsOptional()
  @IsNumber({}, { message: 'El costo unitario debe ser un número' })
  @Min(0, { message: 'El costo unitario no puede ser negativo' })
  costo_unitario?: number;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser un texto' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  motivo?: string;
}

