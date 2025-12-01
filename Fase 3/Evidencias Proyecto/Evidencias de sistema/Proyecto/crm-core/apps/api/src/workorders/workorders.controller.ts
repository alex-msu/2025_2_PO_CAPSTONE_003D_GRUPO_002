import { Body, Controller, Get, Patch, Post, Query, Req, BadRequestException, UseGuards, Param, Delete } from '@nestjs/common';
import { WorkOrdersService } from './workorders.service';
import { CreateWorkOrderDto } from './dto/create-workorder.dto';
import { AssignMechanicDto } from './dto/assign-mechanic.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateWorkOrderDto } from './dto/update-workorder.dto';
import { CheckInWorkOrderDto } from './dto/checkin-workorder.dto';
import { StartDiagnosticDto } from './dto/start-diagnostic.dto';
import { ResolveDiscrepancyDto } from './dto/resolve-discrepancy.dto';
import { CloseWorkOrderDto } from './dto/close-workorder.dto';
import { ApproveWorkOrderDto } from './dto/approve-workorder.dto';
import { RejectWorkOrderDto } from './dto/reject-workorder.dto';
import { FinalizeRetiroDto } from './dto/finalize-retiro.dto';
import { ConfirmRetiroDto } from './dto/confirm-retiro.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workorders')
export class WorkOrdersController {
  constructor(private readonly svc: WorkOrdersService) {}

  // Crear OT (chofer o jefe de taller)
  @Post()
  @Roles('JEFE_TALLER', 'jefe_taller', 'CHOFER', 'chofer')
  async create(@Req() req: any, @Body() dto: CreateWorkOrderDto) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    const userRole = req.user?.rol;
    
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    
    // Si es jefe de taller, usar método específico
    if (userRole === 'JEFE_TALLER' || userRole === 'jefe_taller') {
      return this.svc.createFromJefeTaller(userId, dto);
    }
    
    // Si es chofer, usar método de chofer
    return this.svc.createFromDriver(userId, dto);
  }

  // Jefe aprueba y asigna mecánico
  @Post('assign')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async assign(@Req() req: any, @Body() dto: AssignMechanicDto) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.assignMechanic(jefeId, dto);
  }

  // Cambiar estado (mecánico / almacén / cierre)
  @Patch('status')
  @Roles('JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico', 'ADMIN', 'admin', 'RECEPCIONISTA', 'recepcionista')
  async setStatus(@Req() req: any, @Body() dto: { id: number } & UpdateStatusDto) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.updateStatus(userId, dto.id, { status: dto.status });
  }

  // Soporte para chofer.js
  @Get('/support/mechanics')
  async availableMechanics() {
    return this.svc.findAvailableMechanics();
  }

  @Get('/support/vehicles')
  async vehiclesIngresados() {
    return this.svc.findVehiclesIngresados();
  }

  // Listar todas las órdenes de trabajo (para jefe de taller)
  @Get()
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin', 'MECANICO', 'mecanico', 'RECEPCIONISTA', 'recepcionista')
  async list(
    @Req() req: any,
    @Query('mecanicoId') mecanicoId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('vehiculoPatente') vehiculoPatente?: string,
    @Query('chofer') chofer?: string,
  ) {
    const filters: { 
      mecanicoId?: number; 
      page?: number; 
      limit?: number;
      search?: string;
      estado?: string;
      fechaDesde?: string;
      fechaHasta?: string;
      vehiculoPatente?: string;
      chofer?: string;
    } = {};
    if (mecanicoId) {
      const parsed = Number(mecanicoId);
      if (!Number.isNaN(parsed)) {
        filters.mecanicoId = parsed;
      }
    }
    if (page) {
      const parsed = Number(page);
      if (!Number.isNaN(parsed) && parsed > 0) {
        filters.page = parsed;
      }
    }
    if (limit) {
      const parsed = Number(limit);
      if (!Number.isNaN(parsed) && parsed > 0) {
        filters.limit = parsed;
      }
    }
    if (search) {
      filters.search = search.trim();
    }
    if (estado) {
      filters.estado = estado;
    }
    if (fechaDesde) {
      filters.fechaDesde = fechaDesde;
    }
    if (fechaHasta) {
      filters.fechaHasta = fechaHasta;
    }
    if (vehiculoPatente) {
      filters.vehiculoPatente = vehiculoPatente.trim();
    }
    if (chofer) {
      filters.chofer = chofer.trim();
    }
    return this.svc.findAll(filters);
  }

  @Get(':id')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin', 'RECEPCIONISTA', 'recepcionista')
  async detail(@Param('id') id: string) {
    return this.svc.findOne(Number(id));
  }

  @Patch(':id')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto, @Req() req: any) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.updateWorkOrder(jefeId, Number(id), dto);
  }

  @Delete(':id')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async cancel(@Param('id') id: string, @Req() req: any) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.cancelWorkOrder(jefeId, Number(id));
  }

  @Post(':id/checkin')
  @Roles('RECEPCIONISTA', 'recepcionista', 'JEFE_TALLER', 'jefe_taller')
  async checkIn(@Param('id') id: string, @Body() dto: CheckInWorkOrderDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.checkInWorkOrder(userId, Number(id), dto);
  }

  @Post(':id/diagnostic')
  @Roles('MECANICO', 'mecanico', 'JEFE_TALLER', 'jefe_taller')
  async startDiagnostic(@Param('id') id: string, @Body() dto: StartDiagnosticDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.startDiagnostic(userId, Number(id), dto);
  }

  @Post(':id/discrepancy/resolve')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async resolveDiscrepancy(@Param('id') id: string, @Body() dto: ResolveDiscrepancyDto, @Req() req: any) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.resolveDiscrepancy(jefeId, Number(id), dto);
  }

  @Post(':id/pause')
  @Roles('MECANICO', 'mecanico', 'ADMIN', 'admin')
  async pauseWork(@Param('id') id: string, @Req() req: any) {
    const mechanicId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!mechanicId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.pauseWork(mechanicId, Number(id));
  }

  @Post(':id/resume')
  @Roles('MECANICO', 'mecanico', 'ADMIN', 'admin')
  async resumeWork(@Param('id') id: string, @Req() req: any) {
    const mechanicId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!mechanicId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.resumeWork(mechanicId, Number(id));
  }

  @Post(':id/close')
  @Roles('MECANICO', 'mecanico', 'ADMIN', 'admin')
  async closeWorkOrder(@Param('id') id: string, @Body() dto: CloseWorkOrderDto, @Req() req: any) {
    const mechanicId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!mechanicId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.closeWorkOrder(mechanicId, Number(id), dto);
  }

  @Post(':id/approve')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async approveWorkOrder(@Param('id') id: string, @Body() dto: ApproveWorkOrderDto, @Req() req: any) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.approveWorkOrder(jefeId, Number(id), dto);
  }

  @Post(':id/reject')
  @Roles('JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async rejectWorkOrder(@Param('id') id: string, @Body() dto: RejectWorkOrderDto, @Req() req: any) {
    const jefeId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!jefeId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.rejectWorkOrder(jefeId, Number(id), dto);
  }

  @Post(':id/finalize-retiro')
  @Roles('RECEPCIONISTA', 'recepcionista', 'ADMIN', 'admin')
  async finalizeRetiro(@Param('id') id: string, @Body() dto: FinalizeRetiroDto, @Req() req: any) {
    const recepcionistaId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!recepcionistaId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.finalizeRetiro(recepcionistaId, Number(id), dto);
  }

  @Post('vehicles/:vehiculoId/confirm-retiro')
  @Roles('CHOFER', 'chofer', 'ADMIN', 'admin')
  async confirmRetiro(@Param('vehiculoId') vehiculoId: string, @Body() dto: ConfirmRetiroDto, @Req() req: any) {
    const choferId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!choferId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.svc.confirmRetiro(choferId, Number(vehiculoId), dto);
  }
}
