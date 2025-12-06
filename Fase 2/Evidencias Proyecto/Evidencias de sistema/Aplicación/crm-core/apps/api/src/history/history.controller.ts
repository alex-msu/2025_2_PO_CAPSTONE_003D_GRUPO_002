import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { HistoryFiltersDto } from './dto/history-filters.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @Roles('ADMIN', 'admin', 'BODEGUERO', 'bodeguero', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico')
  async getHistory(@Query() filters: HistoryFiltersDto) {
    return this.historyService.getHistory(filters);
  }

  @Get('export')
  @Roles('ADMIN', 'admin', 'BODEGUERO', 'bodeguero', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'JEFE_TALLER', 'jefe_taller', 'MECANICO', 'mecanico')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="historial.csv"')
  async exportHistory(@Query() filters: HistoryFiltersDto, @Res() res: Response) {
    const csv = await this.historyService.exportHistoryToCSV(filters);
    const entityType = filters.entityType || 'historial';
    const filename = `historial_${entityType}_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // BOM para Excel
  }
}

