import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DevController } from './dev.controller';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { Usuario } from './users/entities/user.entity'; // <-- Usando "Usuario", ¡correcto!
import { VehiclesModule } from './vehicles/vehicles.module';
import { APP_GUARD } from '@nestjs/core';
import { WorkOrdersModule } from './workorders/workorders.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { EventsModule } from './events/events.module';
import { StockModule } from './stock/stock.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HistoryModule } from './history/history.module';
import { ReportsModule } from './reports/reports.module';
import { ConfigModule as AppConfigModule } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false, // Desactivado para evitar modificaciones a la base de datos existente
      }),
    }),
    TypeOrmModule.forFeature([Usuario]), 
    AuthModule,
    UsersModule,
    VehiclesModule,
    WorkOrdersModule,
    SolicitudesModule,
    EventsModule,
    StockModule,
    NotificationsModule,
    HistoryModule,
    ReportsModule,
    AppConfigModule,
  ],
  controllers: [HealthController, DevController],

  providers: [
  ],
})
export class AppModule {}