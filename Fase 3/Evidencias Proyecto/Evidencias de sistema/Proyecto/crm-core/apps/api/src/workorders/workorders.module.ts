import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrdersController } from './workorders.controller';
import { WorkOrdersService } from './workorders.service';
import { WorkOrder, Vehicle, User, Shop } from './entities/workorder.entity';
import { SolicitudMantenimiento } from '../solicitudes/entities/solicitud.entity';
import { BreakMecanico } from '../users/entities/break-mecanico.entity';
import { EventsModule } from '../events/events.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkOrder, Vehicle, User, Shop, SolicitudMantenimiento, BreakMecanico]), EventsModule, FilesModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
