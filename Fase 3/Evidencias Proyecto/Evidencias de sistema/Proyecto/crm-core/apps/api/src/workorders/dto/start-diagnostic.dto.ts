import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class DiagnosticChecklistDto {
  @IsOptional()
  @IsBoolean()
  inspeccionVisual?: boolean;

  @IsOptional()
  @IsBoolean()
  escanerElectronico?: boolean;

  @IsOptional()
  @IsBoolean()
  pruebaRuta?: boolean;

  @IsOptional()
  @IsBoolean()
  seguridadOperativa?: boolean;
}

export class StartDiagnosticDto {
  @IsNotEmpty({ message: 'La fecha de inicio es requerida' })
  @IsISO8601()
  fechaInicio!: string;

  @IsNotEmpty({ message: 'El diagnóstico inicial es requerido' })
  @IsString({ message: 'El diagnóstico inicial debe ser un texto' })
  @MinLength(10, { message: 'El diagnóstico inicial debe tener al menos 10 caracteres' })
  @MaxLength(5000, { message: 'El diagnóstico inicial no puede exceder 5000 caracteres' })
  diagnosticoInicial!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean({ message: 'La discrepancia de diagnóstico debe ser verdadero o falso' })
  discrepanciaDiagnostico?: boolean;

  // Si hay discrepancia, la prioridad diagnosticada es requerida
  @ValidateIf((o) => o.discrepanciaDiagnostico === true)
  @IsNotEmpty({ message: 'La prioridad diagnosticada es requerida cuando hay discrepancia' })
  @IsString({ message: 'La prioridad diagnosticada debe ser un texto' })
  @IsIn(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'], { message: 'La prioridad diagnosticada debe ser BAJA, NORMAL, ALTA o URGENTE' })
  prioridadDiagnosticada?: string;

  // Si hay discrepancia, el detalle es requerido
  @ValidateIf((o) => o.discrepanciaDiagnostico === true)
  @IsNotEmpty({ message: 'El detalle de discrepancia es requerido cuando hay discrepancia' })
  @IsString({ message: 'El detalle de discrepancia debe ser un texto' })
  @MinLength(10, { message: 'El detalle de discrepancia debe tener al menos 10 caracteres' })
  @MaxLength(2000, { message: 'El detalle de discrepancia no puede exceder 2000 caracteres' })
  discrepanciaDiagnosticoDetalle?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosticChecklistDto)
  checklist?: DiagnosticChecklistDto;

  @IsOptional()
  @IsBoolean()
  checklistCompleto?: boolean;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto' })
  @MaxLength(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
  notas?: string;

  @IsOptional()
  @IsArray({ message: 'Las evidencias deben ser un array' })
  @ArrayMaxSize(5, { message: 'No se pueden adjuntar más de 5 evidencias' })
  @IsString({ each: true, message: 'Cada evidencia debe ser una cadena de texto (base64)' })
  evidencias?: string[];
}

