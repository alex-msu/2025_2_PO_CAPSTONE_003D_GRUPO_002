import { IsOptional, IsString, IsDateString, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum HistoryEntityType {
  SOLICITUDES_REPUESTOS = 'solicitudes_repuestos',
  MOVIMIENTOS_REPUESTOS = 'movimientos_repuestos',
  ORDENES_TRABAJO = 'ordenes_trabajo',
  SOLICITUDES_MANTENIMIENTO = 'solicitudes_mantenimiento',
  LOG_ESTADOS_OT = 'log_estados_ot',
  ENTREGAS_VEHICULOS = 'entregas_vehiculos',
  BREAKS_MECANICO = 'breaks_mecanico',
}

export class HistoryFiltersDto {
  @IsOptional()
  @IsEnum(HistoryEntityType)
  entityType?: HistoryEntityType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usuarioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tallerId?: number;
}

