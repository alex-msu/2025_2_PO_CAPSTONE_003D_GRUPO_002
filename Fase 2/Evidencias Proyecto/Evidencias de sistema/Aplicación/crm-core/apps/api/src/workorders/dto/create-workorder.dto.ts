import { IsInt, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsISO8601, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateWorkOrderDto {
  @IsInt({ message: 'El ID del vehículo debe ser un número entero' })
  vehiculoId!: number;

  @IsNotEmpty({ message: 'La descripción del problema es requerida' })
  @IsString({ message: 'La descripción del problema debe ser un texto' })
  @MinLength(10, { message: 'La descripción del problema debe tener al menos 10 caracteres' })
  @MaxLength(5000, { message: 'La descripción del problema no puede exceder 5000 caracteres' })
  descripcion!: string;

  @IsOptional()
  @IsString({ message: 'La prioridad debe ser un texto' })
  @IsIn(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'], { message: 'La prioridad debe ser BAJA, NORMAL, ALTA o URGENTE' })
  prioridad?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

  @IsOptional()
  @IsBoolean({ message: 'El campo emergencia debe ser verdadero o falso' })
  emergencia?: boolean;

  @IsOptional()
  @IsISO8601()
  fechaProgramada?: string; // ISO 8601

  @IsOptional()
  @IsISO8601()
  fechaInicioPlan?: string;

  @IsOptional()
  @IsISO8601()
  fechaFinPlan?: string;

  @IsOptional()
  @IsISO8601()
  fechaEstimadaTermino?: string;

  @IsOptional()
  @IsString({ message: 'El estado debe ser un texto' })
  @IsIn(['PENDIENTE', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'LISTO', 'PENDIENTE_AUTORIZACION_SUPERVISOR'], { 
    message: 'El estado debe ser PENDIENTE, EN_PROCESO, ESPERA_REPUESTOS, LISTO o PENDIENTE_AUTORIZACION_SUPERVISOR' 
  })
  estado?: string; // Estado inicial (solo para jefe de taller)

  @IsOptional()
  @IsInt({ message: 'El ID de la solicitud debe ser un número entero' })
  solicitudId?: number;

  @IsOptional()
  @IsInt({ message: 'El ID del mecánico debe ser un número entero' })
  mecanicoId?: number;
}
