import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PENDIENTE', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'LISTO', 'APROBADO', 'COMPLETADO', 'CANCELADA', 'PENDIENTE_AUTORIZACION_SUPERVISOR', 'PENDIENTE_VERIFICACION'])
  estado?: string;

  @IsOptional()
  @IsString()
  @IsIn(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'])
  prioridad?: string;

  @IsOptional()
  @IsISO8601()
  fechaInicioPlan?: string;

  @IsOptional()
  @IsISO8601()
  fechaEstimadaTermino?: string;
}
