import { IsIn } from 'class-validator';

export class UpdateSolicitudDto {
  @IsIn(['APROBADA', 'RECHAZADA', 'CONVERTIDA_OT', 'CITA_MANTENCION'])
  estado!: 'APROBADA' | 'RECHAZADA' | 'CONVERTIDA_OT' | 'CITA_MANTENCION';
}

