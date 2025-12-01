import { IsNotEmpty, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmRetiroDto {
  @IsNotEmpty()
  @IsBoolean()
  vehiculoOperativo!: boolean; // Confirmación de que el vehículo está operativo

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}

