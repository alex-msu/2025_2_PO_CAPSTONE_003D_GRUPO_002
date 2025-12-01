import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { DebugLoggerService } from './debug-logger.service';
import { Config } from './entities/config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Config])],
  controllers: [ConfigController],
  providers: [ConfigService, DebugLoggerService],
  exports: [ConfigService, DebugLoggerService],
})
export class ConfigModule {}

