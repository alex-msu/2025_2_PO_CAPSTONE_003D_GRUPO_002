import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { SolicitudRepuesto } from '../stock/entities/solicitud-repuesto.entity';
import { MovimientoRepuesto } from '../stock/entities/stock.entity';
import { WorkOrder } from '../workorders/entities/workorder.entity';
import { SolicitudMantenimiento } from '../solicitudes/entities/solicitud.entity';
import { Usuario } from '../users/entities/user.entity';
import { BreakMecanico } from '../users/entities/break-mecanico.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudRepuesto,
      MovimientoRepuesto,
      WorkOrder,
      SolicitudMantenimiento,
      Usuario,
      BreakMecanico,
    ]),
  ],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}

