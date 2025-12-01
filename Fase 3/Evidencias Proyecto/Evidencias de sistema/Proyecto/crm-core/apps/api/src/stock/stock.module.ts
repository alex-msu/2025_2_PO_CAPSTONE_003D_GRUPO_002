import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { Repuesto, Inventario, MovimientoRepuesto } from './entities/stock.entity';
import { SolicitudRepuesto } from './entities/solicitud-repuesto.entity';
import { Shop, WorkOrder } from '../workorders/entities/workorder.entity';
import { Usuario } from '../users/entities/user.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Repuesto, Inventario, MovimientoRepuesto, SolicitudRepuesto, Shop, WorkOrder, Usuario]),
    EventsModule,
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}

