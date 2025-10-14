import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { User } from './users/entities/user.entity';
import { DevController } from './dev.controller';
import { OtModule } from './ot/ot.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,   // viene del docker-compose
        autoLoadEntities: true,
        synchronize: false,              // usamos tu SQL inicial
      }),
    }),
    TypeOrmModule.forFeature([User]),
    UsersModule,
    AuthModule,
    FilesModule,
    OtModule,
  ],
  controllers: [HealthController, DevController],
})
export class AppModule {}
