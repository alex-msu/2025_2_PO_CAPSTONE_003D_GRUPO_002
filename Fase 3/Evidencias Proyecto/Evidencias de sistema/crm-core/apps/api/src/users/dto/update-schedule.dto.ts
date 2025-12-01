import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

class DayScheduleDto {
  @IsBoolean()
  activo!: boolean;

  @IsOptional()
  @IsString()
  hora_inicio?: string | null;

  @IsOptional()
  @IsString()
  hora_salida?: string | null;

  @IsOptional()
  @IsString()
  colacion_inicio?: string | null;

  @IsOptional()
  @IsString()
  colacion_salida?: string | null;
}

export class UpdateScheduleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  lunes?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  martes?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  miercoles?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  jueves?: DayScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  viernes?: DayScheduleDto;
}

