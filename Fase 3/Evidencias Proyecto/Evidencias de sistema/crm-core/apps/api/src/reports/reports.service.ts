import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BreaksReportFiltersDto } from './dto/breaks-report-filters.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Reporte de breaks de mecánicos por mes
   * Excluye breaks dentro de la hora de colación (con margen de 10 minutos)
   */
  async getBreaksReport(filters: BreaksReportFiltersDto) {
    const mes = filters.mes || new Date().getMonth() + 1;
    const anno = filters.anno || new Date().getFullYear();

    console.log('[ReportsService] getBreaksReport llamado con:', { mes, anno });

    // Query para obtener breaks con información del mecánico y su horario
    const query = `
      SELECT 
        u.id as mecanico_id,
        u.rut as mecanico_rut,
        u.nombre_completo as mecanico_nombre,
        u.email as mecanico_email,
        b.id as break_id,
        b.hora_inicio,
        b.hora_termino,
        EXTRACT(DOW FROM b.hora_inicio) as dia_semana,
        EXTRACT(HOUR FROM b.hora_inicio) as hora_inicio_hora,
        EXTRACT(MINUTE FROM b.hora_inicio) as hora_inicio_minuto,
        -- Horarios de colación según el día de la semana
        CASE EXTRACT(DOW FROM b.hora_inicio)
          WHEN 1 THEN h.lunes_colacion_inicio
          WHEN 2 THEN h.martes_colacion_inicio
          WHEN 3 THEN h.miercoles_colacion_inicio
          WHEN 4 THEN h.jueves_colacion_inicio
          WHEN 5 THEN h.viernes_colacion_inicio
          ELSE NULL
        END as colacion_inicio,
        CASE EXTRACT(DOW FROM b.hora_inicio)
          WHEN 1 THEN h.lunes_colacion_salida
          WHEN 2 THEN h.martes_colacion_salida
          WHEN 3 THEN h.miercoles_colacion_salida
          WHEN 4 THEN h.jueves_colacion_salida
          WHEN 5 THEN h.viernes_colacion_salida
          ELSE NULL
        END as colacion_salida
      FROM breaks_mecanico b
      INNER JOIN usuarios u ON u.id = b.mecanico_id
      LEFT JOIN horarios_trabajo h ON h.usuario_id = u.id
      WHERE b.mes = $1
        AND b.anno = $2
        AND b.hora_termino IS NOT NULL
        AND u.rol = 'MECANICO'
      ORDER BY u.nombre_completo, b.hora_inicio
    `;

    const breaks = await this.ds.query(query, [mes, anno]);
    console.log('[ReportsService] Breaks encontrados:', breaks.length);
    if (breaks.length > 0) {
      console.log('[ReportsService] Primeros 3 breaks de ejemplo:');
      breaks.slice(0, 3).forEach((b: any, idx: number) => {
        console.log(`[ReportsService] Break ${idx + 1}:`, {
          break_id: b.break_id,
          mecanico: b.mecanico_nombre,
          hora_inicio: b.hora_inicio,
          dia_semana: b.dia_semana,
          hora_inicio_hora: b.hora_inicio_hora,
          hora_inicio_minuto: b.hora_inicio_minuto,
          colacion_inicio: b.colacion_inicio,
          colacion_salida: b.colacion_salida,
          tipos: {
            hora_inicio_hora: typeof b.hora_inicio_hora,
            hora_inicio_minuto: typeof b.hora_inicio_minuto,
            colacion_inicio: typeof b.colacion_inicio,
            colacion_salida: typeof b.colacion_salida
          }
        });
      });
    }

    // Procesar breaks y excluir los que están dentro de la colación (con margen de 10 min)
    const breaksFiltrados = breaks.filter((breakItem: any) => {
      // Si no tiene horario de colación para ese día, contar el break
      if (!breakItem.colacion_inicio || !breakItem.colacion_salida) {
        console.log('[ReportsService] Break sin colación, incluido:', breakItem.break_id);
        return true;
      }

      // Verificar que el break esté en un día laboral (lunes-viernes, DOW 1-5)
      const diaSemana = breakItem.dia_semana;
      if (diaSemana < 1 || diaSemana > 5) {
        // Si es fin de semana, contar el break (no hay colación programada)
        console.log('[ReportsService] Break en fin de semana, incluido:', breakItem.break_id, 'DOW:', diaSemana);
        return true;
      }

      // Convertir hora de colación a minutos desde medianoche
      // El formato puede ser 'HH:MM:SS' o 'HH:MM', así que tomamos solo los primeros 5 caracteres
      const colacionInicioStr = breakItem.colacion_inicio ? breakItem.colacion_inicio.toString().substring(0, 5) : '';
      const colacionInicioParts = colacionInicioStr.split(':');
      const colacionInicioMins = parseInt(colacionInicioParts[0], 10) * 60 + parseInt(colacionInicioParts[1], 10);
      
      const colacionSalidaStr = breakItem.colacion_salida ? breakItem.colacion_salida.toString().substring(0, 5) : '';
      const colacionSalidaParts = colacionSalidaStr.split(':');
      const colacionSalidaMins = parseInt(colacionSalidaParts[0], 10) * 60 + parseInt(colacionSalidaParts[1], 10);

      // Convertir hora de inicio del break a minutos desde medianoche
      // hora_inicio_hora y hora_inicio_minuto vienen como números de EXTRACT
      const breakInicioHora = typeof breakItem.hora_inicio_hora === 'string' 
        ? parseInt(breakItem.hora_inicio_hora, 10) 
        : (breakItem.hora_inicio_hora || 0);
      const breakInicioMinuto = typeof breakItem.hora_inicio_minuto === 'string'
        ? parseInt(breakItem.hora_inicio_minuto, 10)
        : (breakItem.hora_inicio_minuto || 0);
      const breakInicioMins = breakInicioHora * 60 + breakInicioMinuto;

      // Rango de colación con margen de 10 minutos antes y después
      const colacionInicioConMargen = colacionInicioMins - 10;
      const colacionSalidaConMargen = colacionSalidaMins + 10;

      // Excluir si está dentro del rango de colación (con margen)
      const estaEnColacion = breakInicioMins >= colacionInicioConMargen && breakInicioMins <= colacionSalidaConMargen;
      
      if (estaEnColacion) {
        console.log('[ReportsService] Break EXCLUIDO (dentro de colación):', {
          break_id: breakItem.break_id,
          mecanico: breakItem.mecanico_nombre,
          break_inicio: `${breakInicioHora}:${breakInicioMinuto}`,
          break_inicio_mins: breakInicioMins,
          colacion: `${colacionInicioStr} - ${colacionSalidaStr}`,
          colacion_mins: `${colacionInicioMins} - ${colacionSalidaMins}`,
          colacion_margen: `${colacionInicioConMargen} - ${colacionSalidaConMargen}`
        });
        return false;
      }

      console.log('[ReportsService] Break INCLUIDO (fuera de colación):', {
        break_id: breakItem.break_id,
        mecanico: breakItem.mecanico_nombre,
        break_inicio: `${breakInicioHora}:${breakInicioMinuto}`,
        break_inicio_mins: breakInicioMins,
        colacion: `${colacionInicioStr} - ${colacionSalidaStr}`,
        colacion_mins: `${colacionInicioMins} - ${colacionSalidaMins}`,
        colacion_margen: `${colacionInicioConMargen} - ${colacionSalidaConMargen}`
      });
      return true;
    });

    console.log('[ReportsService] Breaks después del filtrado:', breaksFiltrados.length);

    // Agrupar por mecánico y calcular total de horas
    const reportePorMecanico: Record<number, {
      mecanico_id: number;
      mecanico_rut: string;
      mecanico_nombre: string;
      mecanico_email: string;
      total_breaks: number;
      total_minutos: number; // Total de minutos de breaks
      total_horas_formateado: string; // Formato "X Horas Y Minutos"
      breaks: any[];
    }> = {};

    breaksFiltrados.forEach((breakItem: any) => {
      if (!reportePorMecanico[breakItem.mecanico_id]) {
        reportePorMecanico[breakItem.mecanico_id] = {
          mecanico_id: breakItem.mecanico_id,
          mecanico_rut: breakItem.mecanico_rut || '',
          mecanico_nombre: breakItem.mecanico_nombre,
          mecanico_email: breakItem.mecanico_email,
          total_breaks: 0,
          total_minutos: 0,
          total_horas_formateado: '',
          breaks: [],
        };
      }

      // Calcular duración del break en minutos
      if (breakItem.hora_inicio && breakItem.hora_termino) {
        const inicio = new Date(breakItem.hora_inicio);
        const termino = new Date(breakItem.hora_termino);
        const diffMs = termino.getTime() - inicio.getTime();
        const diffMins = Math.round(diffMs / 60000); // Redondear a minutos
        reportePorMecanico[breakItem.mecanico_id].total_minutos += diffMins;
      }

      reportePorMecanico[breakItem.mecanico_id].total_breaks++;
      reportePorMecanico[breakItem.mecanico_id].breaks.push({
        id: breakItem.break_id,
        hora_inicio: breakItem.hora_inicio,
        hora_termino: breakItem.hora_termino,
      });
    });

    // Formatear total de horas para cada mecánico
    Object.values(reportePorMecanico).forEach((mecanico) => {
      const horas = Math.floor(mecanico.total_minutos / 60);
      const minutos = mecanico.total_minutos % 60;
      mecanico.total_horas_formateado = `${horas} Horas ${minutos} Minutos`;
    });

    // Convertir a array y ordenar por total de minutos (descendente)
    const resultado = Object.values(reportePorMecanico).sort((a, b) => b.total_minutos - a.total_minutos);

    console.log('[ReportsService] Resultado final:', {
      total_mecanicos: resultado.length,
      total_breaks: breaksFiltrados.length,
      mecanicos_count: resultado.length
    });

    return {
      mes,
      anno,
      total_mecanicos: resultado.length,
      total_breaks: breaksFiltrados.length,
      mecanicos: resultado,
    };
  }

  /**
   * Exportar reporte de breaks a CSV
   */
  async exportBreaksReportToCSV(filters: BreaksReportFiltersDto): Promise<string> {
    const reporte = await this.getBreaksReport(filters);
    
    if (!reporte.mecanicos || reporte.mecanicos.length === 0) {
      return 'Mecánico,Email,Total Breaks,Total Horas\n';
    }

    // Headers
    const headers = ['ID', 'RUT', 'Mecánico', 'Email', 'Total Breaks', 'Total Horas'];
    const csvRows = [headers.map(h => this.escapeCSV(h)).join(',')];

    // Data rows
    reporte.mecanicos.forEach((mecanico) => {
      const row = [
        mecanico.mecanico_id.toString(),
        mecanico.mecanico_rut || '',
        mecanico.mecanico_nombre || '',
        mecanico.mecanico_email || '',
        mecanico.total_breaks.toString(),
        mecanico.total_horas_formateado || '0 Horas 0 Minutos',
      ];
      csvRows.push(row.map(cell => this.escapeCSV(cell)).join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Escapar valores para CSV
   */
  private escapeCSV(value: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

