import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateInventarioDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad_disponible?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nivel_minimo_stock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nivel_maximo_stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ubicacion_almacen?: string;
}

