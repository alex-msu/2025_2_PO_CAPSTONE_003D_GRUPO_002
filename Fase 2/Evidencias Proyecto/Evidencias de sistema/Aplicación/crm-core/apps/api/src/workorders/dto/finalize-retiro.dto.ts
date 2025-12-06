import { IsNotEmpty, IsOptional, IsString, IsArray, MaxLength } from 'class-validator';

export class FinalizeRetiroDto {
  @IsNotEmpty()
  @IsString()
  password!: string; // Contraseña del recepcionista

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencias?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  condicionVehiculo?: string; // Condición descriptiva del vehículo (ej: "Excelente estado, trabajo completado")
}

