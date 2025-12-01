import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { AssignMechanicDto } from './dto/assign-mechanic.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) { }

  @Post()
  @Roles('admin', 'jefe_taller')
  create(@Body() dto: CreateVehicleDto) {
    return this.service.create(dto as any);
  }

  @Get()
  @Roles('admin', 'jefe_taller', 'mecanico', 'supervisor')
  list() {
    return this.service.findAll();
  }

  @Get('my/assigned')
  @Roles('chofer', 'CHOFER')
  assignedToDriver(@Req() req: any) {
    const driverId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!driverId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.service.getAssignedVehicleForDriver(driverId);
  }

  @Get('my/history')
  @Roles('chofer', 'CHOFER')
  historyForDriver(@Req() req: any) {
    const driverId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!driverId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.service.getHistoryForDriver(driverId);
  }

  @Get(':id')
  @Roles('admin', 'jefe_taller', 'mecanico', 'supervisor')
  getOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'jefe_taller')
  update(@Param('id') id: number, @Body() dto: UpdateVehicleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'jefe_taller')
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}