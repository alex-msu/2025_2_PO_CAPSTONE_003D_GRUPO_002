import { IsString, Matches, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

// Estados basados en tu update-status.dto.ts
const ESTADOS_VALIDOS = [
  'OPERATIVO',
  'EN_REVISION',
  'STANDBY',
  'CITA_MANTENCION',
  'EN_TALLER',
  'MANTENCION',
  'COMPLETADO',
  'LISTO_PARA_RETIRO',
  'INACTIVO',
];

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]{5,10}$/i, { message: 'Patente inválida' })
  patente?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2030)
  anio_modelo?: number; // Mapea a "año_modelo"

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  problema?: string;
  
  @IsOptional()
  @IsString()
  @IsIn(ESTADOS_VALIDOS) // Valida contra la lista de estados
  estado?: string;
}