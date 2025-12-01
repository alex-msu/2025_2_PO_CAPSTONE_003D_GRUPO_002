import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { BreaksReportFiltersDto } from './dto/breaks-report-filters.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('breaks')
  @Roles('ADMIN', 'admin', 'JEFE_TALLER', 'jefe_taller')
  async getBreaksReport(@Query() filters: BreaksReportFiltersDto) {
    return this.reportsService.getBreaksReport(filters);
  }

  @Get('breaks/export')
  @Roles('ADMIN', 'admin', 'JEFE_TALLER', 'jefe_taller')
  async exportBreaksReport(@Query() filters: BreaksReportFiltersDto, @Res() res: Response) {
    const csv = await this.reportsService.exportBreaksReportToCSV(filters);
    const mes = filters.mes || new Date().getMonth() + 1;
    const anno = filters.anno || new Date().getFullYear();
    const filename = `reporte_breaks_${mes}_${anno}_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // BOM para Excel
  }
}

