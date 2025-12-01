import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveDiscrepancyDto {
  @IsBoolean({ message: 'El campo aprobar debe ser verdadero o falso' })
  aprobar!: boolean;

  @IsOptional()
  @IsString({ message: 'El detalle debe ser un texto' })
  @MaxLength(2000, { message: 'El detalle no puede exceder 2000 caracteres' })
  detalle?: string;
}

