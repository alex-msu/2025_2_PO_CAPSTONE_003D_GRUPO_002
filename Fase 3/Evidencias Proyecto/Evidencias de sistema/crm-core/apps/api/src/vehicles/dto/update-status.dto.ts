import { IsIn } from 'class-validator';
export class UpdateStatusDto {
  @IsIn(['PENDIENTE','PROCESO','COMPLETADO','APROBACION'])
  estado!: 'PENDIENTE' | 'PROCESO' | 'COMPLETADO' | 'APROBACION';
}
