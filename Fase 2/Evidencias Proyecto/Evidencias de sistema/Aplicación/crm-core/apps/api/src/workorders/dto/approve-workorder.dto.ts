import { IsNotEmpty, IsString } from 'class-validator';

export class ApproveWorkOrderDto {
  @IsNotEmpty()
  @IsString()
  password!: string; // Contraseña para confirmar la aprobación
}

