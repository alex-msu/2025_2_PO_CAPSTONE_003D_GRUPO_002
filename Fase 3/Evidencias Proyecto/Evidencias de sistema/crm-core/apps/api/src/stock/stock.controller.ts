import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateRepuestoDto } from './dto/create-repuesto.dto';
import { UpdateInventarioDto } from './dto/update-inventario.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { CreateSolicitudRepuestoDto } from './dto/create-solicitud-repuesto.dto';
import { RespondSolicitudRepuestoDto } from './dto/respond-solicitud-repuesto.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ========== REPUESTOS ==========
  @Get('repuestos')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico', 'ADMIN', 'admin')
  async listRepuestos() {
    return this.stockService.findAllRepuestos();
  }

  @Get('repuestos/:id')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async getRepuesto(@Param('id') id: string) {
    return this.stockService.findOneRepuesto(Number(id));
  }

  @Post('repuestos')
  @Roles('BODEGUERO', 'bodeguero', 'ADMIN', 'admin')
  async createRepuesto(@Body() dto: CreateRepuestoDto) {
    return this.stockService.createRepuesto(dto);
  }

  // ========== INVENTARIOS ==========
  @Get('inventarios')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico', 'ADMIN', 'admin')
  async listInventarios(
    @Query('tallerId') tallerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('busqueda') busqueda?: string,
    @Query('estado') estado?: string,
  ) {
    const id = tallerId ? Number(tallerId) : undefined;
    const pageNum = page ? (Number(page) > 0 ? Number(page) : undefined) : undefined;
    const limitNum = limit ? (Number(limit) > 0 ? Number(limit) : undefined) : undefined;
    const busquedaTrim = busqueda ? busqueda.trim() : undefined;
    const estadoTrim = estado ? estado.trim() : undefined;
    return this.stockService.findAllInventarios(id, pageNum, limitNum, busquedaTrim, estadoTrim);
  }

  @Get('inventarios/stock-bajo')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico', 'ADMIN', 'admin')
  async getStockBajo(@Query('tallerId') tallerId?: string) {
    const id = tallerId ? Number(tallerId) : undefined;
    return this.stockService.getStockBajo(id);
  }

  @Get('inventarios/:tallerId/:repuestoId')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async getInventario(
    @Param('tallerId') tallerId: string,
    @Param('repuestoId') repuestoId: string,
  ) {
    return this.stockService.findOneInventario(Number(tallerId), Number(repuestoId));
  }

  @Patch('inventarios/:tallerId/:repuestoId')
  @Roles('BODEGUERO', 'bodeguero', 'ADMIN', 'admin')
  async updateInventario(
    @Param('tallerId') tallerId: string,
    @Param('repuestoId') repuestoId: string,
    @Body() dto: UpdateInventarioDto,
  ) {
    return this.stockService.updateInventario(Number(tallerId), Number(repuestoId), dto);
  }

  // ========== MOVIMIENTOS ==========
  @Post('movimientos')
  @Roles('BODEGUERO', 'bodeguero', 'ADMIN', 'admin')
  async createMovimiento(@Req() req: any, @Body() dto: CreateMovimientoDto) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.stockService.createMovimiento(userId, dto);
  }

  @Get('movimientos')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async listMovimientos(
    @Query('tallerId') tallerId?: string,
    @Query('repuestoId') repuestoId?: string,
    @Query('limit') limit?: string,
    @Query('busqueda') busqueda?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.stockService.findMovimientos(
      tallerId ? Number(tallerId) : undefined,
      repuestoId ? Number(repuestoId) : undefined,
      limit ? Number(limit) : 50,
      busqueda ? busqueda.trim() : undefined,
      fechaDesde ? fechaDesde : undefined,
      fechaHasta ? fechaHasta : undefined,
      tipo ? tipo.trim() : undefined,
    );
  }

  // ========== SOLICITUDES DE REPUESTOS ==========
  @Post('solicitudes')
  @Roles('MECANICO', 'mecanico', 'ADMIN', 'admin')
  async createSolicitudRepuesto(@Req() req: any, @Body() dto: CreateSolicitudRepuestoDto) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.stockService.createSolicitudRepuesto(userId, dto);
  }

  @Get('solicitudes')
  @Roles('BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico', 'ADMIN', 'admin')
  async listSolicitudesRepuestos(
    @Query('estado') estado?: string,
    @Query('urgencia') urgencia?: string,
  ) {
    return this.stockService.findAllSolicitudesRepuestos(estado, urgencia);
  }

  @Get('solicitudes/ot/:otId')
  @Roles('MECANICO', 'mecanico', 'BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'ADMIN', 'admin')
  async getSolicitudesByOt(@Param('otId') otId: string) {
    return this.stockService.findSolicitudesRepuestosByOt(Number(otId));
  }

  @Patch('solicitudes/:id/respond')
  @Roles('BODEGUERO', 'bodeguero', 'ADMIN', 'admin')
  async respondSolicitudRepuesto(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RespondSolicitudRepuestoDto,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.stockService.respondSolicitudRepuesto(userId, Number(id), dto);
  }

  @Patch('solicitudes/:id/confirmar-recepcion')
  @Roles('MECANICO', 'mecanico', 'ADMIN', 'admin')
  async confirmarRecepcionRepuestos(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.stockService.confirmarRecepcionRepuestos(userId, Number(id));
  }
}

