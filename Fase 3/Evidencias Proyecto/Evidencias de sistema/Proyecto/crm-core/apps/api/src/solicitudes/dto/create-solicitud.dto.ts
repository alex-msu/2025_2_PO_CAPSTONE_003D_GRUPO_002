import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSolicitudDto {
  @IsString()
  descripcion!: string;

  @IsBoolean()
  @IsOptional()
  emergencia?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  imagenes!: string[];
}

