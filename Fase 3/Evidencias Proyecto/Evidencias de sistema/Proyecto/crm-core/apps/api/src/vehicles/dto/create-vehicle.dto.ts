import { IsString, Matches, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @Matches(/^[A-Z0-9-]{5,10}$/i, { message: 'Patente inválida' })
  patente!: string;

  @IsString() // <-- 1. "marca must be a string" (AHORA SÍ LA ACEPTA)
  marca!: string;

  @IsString()
  modelo!: string;

  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2030)
  anio_modelo?: number; // Mapea a "año_modelo"

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString() // <-- 2. AHORA ACEPTA "problema"
  problema?: string;

  // "taller" y "estado" ya no se envían al crear.
}