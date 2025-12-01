// src/users/dto/create-user-with-role.dto.ts
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
export class CreateUserWithRoleDto {
  @IsString() nombre_completo!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() rut?: string;
  @IsString() @MinLength(6) password!: string;
  @IsString()
  @IsIn(['admin','jefe_taller','mecanico','coordinador_zona','guardia','recepcion','repuestos','ventas','supervisor','llaves','recepcionista'])
  rol!: string;
}