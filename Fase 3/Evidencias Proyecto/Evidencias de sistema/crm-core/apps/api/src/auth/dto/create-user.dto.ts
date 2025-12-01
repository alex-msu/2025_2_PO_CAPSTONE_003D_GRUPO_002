// src/auth/dto/create-user.dto.ts
import { IsEmail, IsString, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString()
  rut!: string;

  @IsString()
  nombre_completo!: string;

  @IsEmail()
  email!: string;

  @IsString()
  telefono?: string;

  @IsString()
  rol!: string;

  @IsNumber()
  taller_id!: number;

  @IsString()
  password!: string;
}
