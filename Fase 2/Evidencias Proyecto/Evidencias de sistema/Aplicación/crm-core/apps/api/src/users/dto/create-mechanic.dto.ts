// src/users/dto/create-mechanic.dto.ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
export class CreateMechanicDto {
  @IsString() nombre_completo!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() rut?: string;
  @IsString() @MinLength(6) password!: string;
}