import { Body, Controller, Post, Req, UseGuards, BadRequestException, Get, Param, Patch, Delete } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { CreateSolicitudInternalDto } from './dto/create-solicitud-internal.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly service: SolicitudesService) {}

  @Post()
  @Roles('chofer', 'CHOFER')
  async create(@Req() req: any, @Body() dto: CreateSolicitudDto) {
    const driverId = req.user?.userId || req.user?.sub || req.user?.id;
    console.log('[SOLICITUDES CONTROLLER] ===== RECEPCIÓN DE SOLICITUD =====');
    console.log('[SOLICITUDES CONTROLLER] Driver ID extraído:', driverId);
    console.log('[SOLICITUDES CONTROLLER] Usuario completo:', {
      userId: req.user?.userId,
      sub: req.user?.sub,
      id: req.user?.id,
      userCompleto: req.user
    });
    console.log('[SOLICITUDES CONTROLLER] DTO recibido:', {
      descripcion: dto.descripcion?.substring(0, 50) + '...',
      emergencia: dto.emergencia,
      numImagenes: dto.imagenes?.length || 0
    });
    
    if (!driverId) {
      console.error('[SOLICITUDES CONTROLLER] ERROR: Usuario no autenticado');
      throw new BadRequestException('Usuario no autenticado');
    }
    
    const resultado = await this.service.createFromDriver(driverId, dto);
    console.log('[SOLICITUDES CONTROLLER] Solicitud creada, retornando:', {
      id: resultado.id,
      numero_solicitud: resultado.numero_solicitud,
      estado: resultado.estado
    });
    console.log('[SOLICITUDES CONTROLLER] ===== FIN RECEPCIÓN DE SOLICITUD =====');
    return resultado;
  }

  @Get()
  @Roles('JEFE_TALLER', 'jefe_taller')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('JEFE_TALLER', 'jefe_taller')
  findOne(@Param('id') id: number) {
    return this.service.findOne(Number(id));
  }

  @Patch(':id')
  @Roles('JEFE_TALLER', 'jefe_taller')
  updateStatus(@Param('id') id: number, @Body() dto: UpdateSolicitudDto, @Req() req: any) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.service.updateStatus(Number(id), dto, jefeId);
  }

  @Get('vehicle/:vehiculoId')
  @Roles('JEFE_TALLER', 'jefe_taller')
  findApprovedByVehicle(@Param('vehiculoId') vehiculoId: number) {
    return this.service.findApprovedByVehicle(Number(vehiculoId));
  }

  @Post('internal')
  @Roles('JEFE_TALLER', 'jefe_taller')
  async createInternal(@Req() req: any, @Body() dto: CreateSolicitudInternalDto) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.service.createFromJefe(jefeId, dto);
  }

  @Delete(':id')
  @Roles('JEFE_TALLER', 'jefe_taller')
  remove(@Param('id') id: number) {
    return this.service.remove(Number(id));
  }
}

