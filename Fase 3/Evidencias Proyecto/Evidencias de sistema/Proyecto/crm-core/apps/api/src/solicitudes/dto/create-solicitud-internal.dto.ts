import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSolicitudInternalDto {
  @IsInt()
  vehiculoId!: number;

  @IsBoolean()
  @IsOptional()
  emergencia?: boolean;

  @IsNotEmpty()
  @IsString()
  descripcion!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  imagenes!: string[];
}

