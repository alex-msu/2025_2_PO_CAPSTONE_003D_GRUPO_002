import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudMantenimiento } from './entities/solicitud.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { Vehiculo } from '../vehicles/entities/vehicle.entity';
import { Usuario } from '../users/entities/user.entity';
import { WorkOrder } from '../workorders/entities/workorder.entity';
import { FilesModule } from '../files/files.module';
import { EventsModule } from '../events/events.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudMantenimiento, Vehiculo, Usuario, WorkOrder]), FilesModule, EventsModule, ConfigModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}

