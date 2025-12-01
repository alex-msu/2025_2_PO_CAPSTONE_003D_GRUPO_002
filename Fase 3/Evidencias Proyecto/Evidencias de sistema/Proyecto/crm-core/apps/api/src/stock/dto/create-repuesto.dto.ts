import { IsString, IsOptional, IsNumber, IsBoolean, MaxLength } from 'class-validator';

export class CreateRepuestoDto {
  @IsString()
  @MaxLength(50)
  sku!: string;

  @IsString()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  @MaxLength(20)
  unidad!: string;

  @IsOptional()
  @IsNumber()
  precio_costo?: number;

  @IsOptional()
  @IsString()
  informacion_proveedor?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

