import { IsNumber, IsString, IsIn, IsOptional, Min, IsInt, MaxLength } from 'class-validator';

export class CreateSolicitudRepuestoDto {
  @IsNumber({}, { message: 'El ID de la orden de trabajo debe ser un número' })
  @IsInt({ message: 'El ID de la orden de trabajo debe ser un número entero' })
  orden_trabajo_id!: number;

  @IsNumber({}, { message: 'El ID del repuesto debe ser un número' })
  @IsInt({ message: 'El ID del repuesto debe ser un número entero' })
  repuesto_id!: number;

  @IsNumber({}, { message: 'La cantidad solicitada debe ser un número' })
  @IsInt({ message: 'La cantidad solicitada debe ser un número entero' })
  @Min(1, { message: 'La cantidad solicitada debe ser al menos 1' })
  cantidad_solicitada!: number;

  @IsOptional()
  @IsString({ message: 'La urgencia debe ser un texto' })
  @IsIn(['NORMAL', 'URGENTE'], { message: 'La urgencia debe ser NORMAL o URGENTE' })
  urgencia?: 'NORMAL' | 'URGENTE';

  @IsOptional()
  @IsString({ message: 'Los comentarios deben ser un texto' })
  @MaxLength(1000, { message: 'Los comentarios no pueden exceder 1000 caracteres' })
  comentarios?: string;
}

