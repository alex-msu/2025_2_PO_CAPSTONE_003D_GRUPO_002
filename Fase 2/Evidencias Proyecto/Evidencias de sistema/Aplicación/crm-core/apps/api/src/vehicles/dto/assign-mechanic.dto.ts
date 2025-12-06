import { IsNumber, IsOptional, IsEmail } from 'class-validator';

export class AssignMechanicDto {
  @IsNumber()
  vehiculoId!: number;

  @IsOptional()
  @IsNumber()
  mecanicoId?: number;

  @IsOptional()
  @IsEmail()
  mecanicoEmail?: string;
}
