import { IsString, IsIn, IsOptional, IsDateString } from 'class-validator';

export class RespondSolicitudRepuestoDto {
  @IsString()
  @IsIn(['APROBADA', 'RECHAZADA'])
  accion!: 'APROBADA' | 'RECHAZADA';

  @IsOptional()
  @IsString()
  comentarios?: string;

  @IsOptional()
  @IsDateString()
  fecha_estimada_entrega?: string;
}

