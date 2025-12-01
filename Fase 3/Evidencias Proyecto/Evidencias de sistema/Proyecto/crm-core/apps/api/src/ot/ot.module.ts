import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtService } from './ot.service';
import { OtController } from './ot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])], // no requiere entidad fija
  providers: [OtService],
  controllers: [OtController],
})
export class OtModule {}
