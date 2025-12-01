import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('admin', 'jefe_taller')
  async list(@Query('rol') rol?: string) {
    if (rol) return this.users.listByRole(rol);
    return this.users.findAll();
  }

  @Post('mechanics')
  @Roles('admin','jefe_taller')
  async createMechanic(@Body() dto: {
    nombre_completo: string; email: string; password: string;
    rut?: string; telefono?: string; taller_id?: number;
  }) {
    return this.users.createMechanic(dto);
  }

  @Post()
  @Roles('admin','jefe_taller')
  async createWithRole(@Body() dto: {
    nombre_completo: string; email: string; password: string; rol: string;
    rut?: string; telefono?: string;
  }) {
    return this.users.createWithRole(dto);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: number, @Body() dto: {
    nombre_completo?: string;
    email?: string;
    rol?: string;
    rut?: string;
    telefono?: string;
    activo?: boolean;
    password?: string;
  }) {
    return this.users.update(id, dto);
  }

  @Patch(':id/schedule')
  @Roles('admin')
  async updateSchedule(@Param('id') id: number, @Body() dto: UpdateScheduleDto) {
    return this.users.updateSchedule(Number(id), dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(@Param('id') id: number) {
    return this.users.delete(Number(id));
  }
}
