import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInChecklistDto {
  @IsOptional()
  @IsBoolean()
  permisoCirculacion?: boolean;

  @IsOptional()
  @IsBoolean()
  seguroVigente?: boolean;
}

export class CheckInWorkOrderDto {
  @IsNotEmpty({ message: 'La fecha de llegada es requerida' })
  @IsISO8601()
  fechaLlegada!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckInChecklistDto)
  checklist?: CheckInChecklistDto;

  @IsOptional()
  @IsBoolean({ message: 'El campo checklistCompleto debe ser verdadero o falso' })
  checklistCompleto?: boolean;

  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser un texto' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder 500 caracteres' })
  observaciones?: string;

  @IsOptional()
  @IsArray({ message: 'Las evidencias deben ser un array' })
  @ArrayMaxSize(3, { message: 'No se pueden adjuntar más de 3 evidencias' })
  @IsString({ each: true, message: 'Cada evidencia debe ser una cadena de texto (base64)' })
  evidencias?: string[];
}

