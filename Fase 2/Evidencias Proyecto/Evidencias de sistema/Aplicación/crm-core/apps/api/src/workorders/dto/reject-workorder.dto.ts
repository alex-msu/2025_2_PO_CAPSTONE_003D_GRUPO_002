import { IsNotEmpty, IsString } from 'class-validator';

export class RejectWorkOrderDto {
  @IsNotEmpty()
  @IsString()
  comentario!: string; // Comentario explicando por qué se rechaza
}

