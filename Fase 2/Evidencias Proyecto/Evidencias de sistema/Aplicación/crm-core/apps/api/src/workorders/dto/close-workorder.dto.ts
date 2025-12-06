import { IsNotEmpty, IsString, IsOptional, IsArray, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';

export class CloseWorkOrderDto {
  @IsNotEmpty({ message: 'La descripción del proceso realizado es requerida' })
  @IsString({ message: 'La descripción del proceso realizado debe ser un texto' })
  @MinLength(10, { message: 'La descripción del proceso realizado debe tener al menos 10 caracteres' })
  @MaxLength(5000, { message: 'La descripción del proceso realizado no puede exceder 5000 caracteres' })
  descripcionProcesoRealizado!: string;

  @IsOptional()
  @IsArray({ message: 'Las evidencias deben ser un array' })
  @ArrayMaxSize(10, { message: 'No se pueden adjuntar más de 10 evidencias' })
  @IsString({ each: true, message: 'Cada evidencia debe ser una cadena de texto (base64)' })
  evidencias?: string[]; // Array de base64 o URLs de imágenes
}

