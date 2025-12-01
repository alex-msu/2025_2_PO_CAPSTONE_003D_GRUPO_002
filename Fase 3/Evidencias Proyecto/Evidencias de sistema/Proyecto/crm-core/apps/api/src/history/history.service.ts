import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SolicitudRepuesto } from '../stock/entities/solicitud-repuesto.entity';
import { MovimientoRepuesto } from '../stock/entities/stock.entity';
import { WorkOrder } from '../workorders/entities/workorder.entity';
import { SolicitudMantenimiento } from '../solicitudes/entities/solicitud.entity';
import { Usuario } from '../users/entities/user.entity';
import { BreakMecanico } from '../users/entities/break-mecanico.entity';
import { HistoryFiltersDto, HistoryEntityType } from './dto/history-filters.dto';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(SolicitudRepuesto)
    private readonly solicitudRepuestoRepo: Repository<SolicitudRepuesto>,
    @InjectRepository(MovimientoRepuesto)
    private readonly movimientoRepo: Repository<MovimientoRepuesto>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
    @InjectRepository(SolicitudMantenimiento)
    private readonly solicitudMantenimientoRepo: Repository<SolicitudMantenimiento>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(BreakMecanico)
    private readonly breakMecanicoRepo: Repository<BreakMecanico>,
    private readonly ds: DataSource,
  ) {}

  /**
   * Obtener historial de solicitudes de repuestos
   */
  async getSolicitudesRepuestosHistory(filters: HistoryFiltersDto) {
    const query = this.solicitudRepuestoRepo
      .createQueryBuilder('sol')
      .leftJoinAndSelect('sol.orden_trabajo', 'ot')
      .leftJoinAndSelect('sol.repuesto', 'rep')
      .leftJoinAndSelect('sol.solicitado_por_user', 'usuario')
      .leftJoinAndSelect('ot.vehiculo', 'veh')
      .orderBy('sol.fecha_solicitud', 'DESC');

    if (filters.search) {
      query.andWhere(
        '(rep.nombre ILIKE :search OR rep.sku ILIKE :search OR ot.numero_ot::text ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.fechaDesde) {
      query.andWhere('sol.fecha_solicitud >= :fechaDesde', {
        fechaDesde: filters.fechaDesde,
      });
    }

    if (filters.fechaHasta) {
      query.andWhere('sol.fecha_solicitud <= :fechaHasta', {
        fechaHasta: filters.fechaHasta,
      });
    }

    if (filters.usuarioId) {
      query.andWhere('sol.solicitado_por = :usuarioId', {
        usuarioId: filters.usuarioId,
      });
    }

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      query.skip(skip).take(filters.limit);

      const [data, total] = await query.getManyAndCount();
      return {
        data: this.formatSolicitudesRepuestos(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await query.getMany();
    return {
      data: this.formatSolicitudesRepuestos(data),
    };
  }

  /**
   * Obtener historial de movimientos de repuestos
   */
  async getMovimientosRepuestosHistory(filters: HistoryFiltersDto) {
    const query = this.movimientoRepo
      .createQueryBuilder('mov')
      .leftJoinAndSelect('mov.repuesto', 'rep')
      .leftJoin('usuarios', 'usuario', 'usuario.id = mov.movido_por')
      .leftJoinAndSelect('mov.taller', 'taller')
      .leftJoin('ordenes_trabajo', 'ot', 'ot.id = mov.orden_trabajo_id')
      .addSelect(['usuario.id', 'usuario.nombre_completo'])
      .addSelect(['ot.id', 'ot.numero_ot'])
      .orderBy('mov.fecha_movimiento', 'DESC');

    if (filters.search) {
      query.andWhere(
        '(rep.nombre ILIKE :search OR rep.sku ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.fechaDesde) {
      query.andWhere('mov.fecha_movimiento >= :fechaDesde', {
        fechaDesde: filters.fechaDesde,
      });
    }

    if (filters.fechaHasta) {
      query.andWhere('mov.fecha_movimiento <= :fechaHasta', {
        fechaHasta: filters.fechaHasta,
      });
    }

    if (filters.usuarioId) {
      query.andWhere('mov.movido_por = :usuarioId', {
        usuarioId: filters.usuarioId,
      });
    }

    if (filters.tallerId) {
      query.andWhere('mov.taller_id = :tallerId', {
        tallerId: filters.tallerId,
      });
    }

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      query.skip(skip).take(filters.limit);

      const [data, total] = await query.getManyAndCount();
      return {
        data: this.formatMovimientosRepuestos(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await query.getMany();
    return {
      data: this.formatMovimientosRepuestos(data),
    };
  }

  /**
   * Obtener historial de órdenes de trabajo
   */
  async getOrdenesTrabajoHistory(filters: HistoryFiltersDto) {
    const query = this.workOrderRepo
      .createQueryBuilder('ot')
      .leftJoinAndSelect('ot.vehiculo', 'veh')
      .leftJoinAndSelect('ot.mecanico', 'mecanico')
      .leftJoinAndSelect('ot.taller', 'taller')
      .orderBy('ot.fecha_creacion', 'DESC');

    if (filters.search) {
      query.andWhere(
        '(ot.numero_ot::text ILIKE :search OR veh.patente ILIKE :search OR mecanico.nombre_completo ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.fechaDesde) {
      query.andWhere('ot.fecha_creacion >= :fechaDesde', {
        fechaDesde: filters.fechaDesde,
      });
    }

    if (filters.fechaHasta) {
      query.andWhere('ot.fecha_creacion <= :fechaHasta', {
        fechaHasta: filters.fechaHasta,
      });
    }

    if (filters.usuarioId) {
      query.andWhere('ot.mecanico_asignado_id = :usuarioId', {
        usuarioId: filters.usuarioId,
      });
    }

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      query.skip(skip).take(filters.limit);

      const [data, total] = await query.getManyAndCount();
      return {
        data: this.formatOrdenesTrabajo(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await query.getMany();
    return {
      data: this.formatOrdenesTrabajo(data),
    };
  }

  /**
   * Obtener historial de solicitudes de mantenimiento
   */
  async getSolicitudesMantenimientoHistory(filters: HistoryFiltersDto) {
    const query = this.solicitudMantenimientoRepo
      .createQueryBuilder('sol')
      .leftJoinAndSelect('sol.vehiculo', 'veh')
      .leftJoinAndSelect('sol.conductor', 'conductor')
      .orderBy('sol.fecha_solicitud', 'DESC');

    if (filters.search) {
      query.andWhere(
        '(sol.numero_solicitud ILIKE :search OR veh.patente ILIKE :search OR conductor.nombre_completo ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.fechaDesde) {
      query.andWhere('sol.fecha_solicitud >= :fechaDesde', {
        fechaDesde: filters.fechaDesde,
      });
    }

    if (filters.fechaHasta) {
      query.andWhere('sol.fecha_solicitud <= :fechaHasta', {
        fechaHasta: filters.fechaHasta,
      });
    }

    if (filters.usuarioId) {
      query.andWhere('sol.conductor_id = :usuarioId', {
        usuarioId: filters.usuarioId,
      });
    }

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      query.skip(skip).take(filters.limit);

      const [data, total] = await query.getManyAndCount();
      return {
        data: this.formatSolicitudesMantenimiento(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await query.getMany();
    return {
      data: this.formatSolicitudesMantenimiento(data),
    };
  }

  /**
   * Obtener historial de cambios de estado de OTs
   */
  async getLogEstadosOtHistory(filters: HistoryFiltersDto) {
    // Construir WHERE conditions con parámetros posicionales
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.search) {
      whereConditions.push(`ot.numero_ot::text ILIKE $${paramIndex}`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.fechaDesde) {
      whereConditions.push(`log.fecha_cambio >= $${paramIndex}`);
      params.push(filters.fechaDesde);
      paramIndex++;
    }

    if (filters.fechaHasta) {
      whereConditions.push(`log.fecha_cambio <= $${paramIndex}`);
      params.push(filters.fechaHasta);
      paramIndex++;
    }

    if (filters.usuarioId) {
      whereConditions.push(`log.cambiado_por = $${paramIndex}`);
      params.push(filters.usuarioId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Query para contar
    const countQuery = `
      SELECT COUNT(log.id) as count
      FROM log_estados_ot log
      LEFT JOIN ordenes_trabajo ot ON ot.id = log.orden_trabajo_id
      LEFT JOIN usuarios usuario ON usuario.id = log.cambiado_por
      ${whereClause}
    `;

    // Query para datos
    let dataQuery = `
      SELECT 
        log.id as log_id,
        log.orden_trabajo_id,
        log.estado_anterior as log_estado_anterior,
        log.estado_nuevo as log_estado_nuevo,
        log.motivo_cambio as log_motivo_cambio,
        log.fecha_cambio as log_fecha_cambio,
        ot.numero_ot as ot_numero_ot,
        usuario.id as usuario_id,
        usuario.nombre_completo as usuario_nombre_completo
      FROM log_estados_ot log
      LEFT JOIN ordenes_trabajo ot ON ot.id = log.orden_trabajo_id
      LEFT JOIN usuarios usuario ON usuario.id = log.cambiado_por
      ${whereClause}
      ORDER BY log.fecha_cambio DESC
    `;

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      dataQuery += ` LIMIT ${filters.limit} OFFSET ${skip}`;

      const [data, countResult] = await Promise.all([
        this.ds.query(dataQuery, params),
        this.ds.query(countQuery, params),
      ]);

      const total = parseInt(countResult[0]?.count || '0', 10);

      return {
        data: this.formatLogEstadosOt(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await this.ds.query(dataQuery, params);
    return {
      data: this.formatLogEstadosOt(data),
    };
  }

  /**
   * Obtener historial de entregas de vehículos
   */
  async getEntregasVehiculosHistory(filters: HistoryFiltersDto) {
    // Construir WHERE conditions con parámetros posicionales
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.search) {
      whereConditions.push(`ot.numero_ot::text ILIKE $${paramIndex}`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.fechaDesde) {
      whereConditions.push(`ent.fecha_firma >= $${paramIndex}`);
      params.push(filters.fechaDesde);
      paramIndex++;
    }

    if (filters.fechaHasta) {
      whereConditions.push(`ent.fecha_firma <= $${paramIndex}`);
      params.push(filters.fechaHasta);
      paramIndex++;
    }

    if (filters.usuarioId) {
      whereConditions.push(`(ent.conductor_id = $${paramIndex} OR ent.responsable_taller_id = $${paramIndex})`);
      params.push(filters.usuarioId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Query para contar
    const countQuery = `
      SELECT COUNT(ent.id) as count
      FROM entregas_vehiculos ent
      LEFT JOIN ordenes_trabajo ot ON ot.id = ent.orden_trabajo_id
      LEFT JOIN usuarios conductor ON conductor.id = ent.conductor_id
      LEFT JOIN usuarios responsable ON responsable.id = ent.responsable_taller_id
      ${whereClause}
    `;

    // Query para datos
    let dataQuery = `
      SELECT 
        ent.id as ent_id,
        ent.orden_trabajo_id,
        ent.tipo_entrega as ent_tipo_entrega,
        ent.fecha_firma as ent_fecha_firma,
        ent.condicion_vehiculo as ent_condicion_vehiculo,
        ent.observaciones as ent_observaciones,
        ot.numero_ot as ot_numero_ot,
        conductor.id as conductor_id,
        conductor.nombre_completo as conductor_nombre_completo,
        responsable.id as responsable_id,
        responsable.nombre_completo as responsable_nombre_completo
      FROM entregas_vehiculos ent
      LEFT JOIN ordenes_trabajo ot ON ot.id = ent.orden_trabajo_id
      LEFT JOIN usuarios conductor ON conductor.id = ent.conductor_id
      LEFT JOIN usuarios responsable ON responsable.id = ent.responsable_taller_id
      ${whereClause}
      ORDER BY ent.fecha_firma DESC
    `;

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      dataQuery += ` LIMIT ${filters.limit} OFFSET ${skip}`;

      const [data, countResult] = await Promise.all([
        this.ds.query(dataQuery, params),
        this.ds.query(countQuery, params),
      ]);

      const total = parseInt(countResult[0]?.count || '0', 10);

      return {
        data: this.formatEntregasVehiculos(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await this.ds.query(dataQuery, params);
    return {
      data: this.formatEntregasVehiculos(data),
    };
  }

  /**
   * Obtener historial de breaks de mecánicos
   */
  async getBreaksMecanicoHistory(filters: HistoryFiltersDto) {
    const params: any[] = [];
    let paramIndex = 1;
    const whereConditions: string[] = [];

    // Filtros
    if (filters.search) {
      whereConditions.push(`u.nombre_completo ILIKE $${paramIndex}`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.fechaDesde) {
      whereConditions.push(`b.hora_inicio >= $${paramIndex}`);
      params.push(filters.fechaDesde);
      paramIndex++;
    }

    if (filters.fechaHasta) {
      whereConditions.push(`b.hora_inicio <= $${paramIndex}`);
      params.push(filters.fechaHasta);
      paramIndex++;
    }

    if (filters.usuarioId) {
      whereConditions.push(`b.mecanico_id = $${paramIndex}`);
      params.push(filters.usuarioId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Query para contar
    const countQuery = `
      SELECT COUNT(b.id) as count
      FROM breaks_mecanico b
      LEFT JOIN usuarios u ON u.id = b.mecanico_id
      ${whereClause}
    `;

    // Query para datos
    let dataQuery = `
      SELECT 
        b.id as b_id,
        b.mecanico_id,
        b.hora_inicio as b_hora_inicio,
        b.hora_termino as b_hora_termino,
        b.mes as b_mes,
        b.anno as b_anno,
        b.fecha_creacion as b_fecha_creacion,
        b.fecha_actualizacion as b_fecha_actualizacion,
        u.id as mecanico_id,
        u.nombre_completo as mecanico_nombre_completo,
        u.email as mecanico_email
      FROM breaks_mecanico b
      LEFT JOIN usuarios u ON u.id = b.mecanico_id
      ${whereClause}
      ORDER BY b.hora_inicio DESC
    `;

    if (filters.page && filters.limit) {
      const skip = (filters.page - 1) * filters.limit;
      dataQuery += ` LIMIT ${filters.limit} OFFSET ${skip}`;

      const [data, countResult] = await Promise.all([
        this.ds.query(dataQuery, params),
        this.ds.query(countQuery, params),
      ]);

      const total = parseInt(countResult[0]?.count || '0', 10);

      return {
        data: this.formatBreaksMecanico(data),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    }

    const data = await this.ds.query(dataQuery, params);
    return {
      data: this.formatBreaksMecanico(data),
    };
  }

  /**
   * Obtener historial según tipo de entidad
   */
  async getHistory(filters: HistoryFiltersDto) {
    switch (filters.entityType) {
      case HistoryEntityType.SOLICITUDES_REPUESTOS:
        return this.getSolicitudesRepuestosHistory(filters);
      case HistoryEntityType.MOVIMIENTOS_REPUESTOS:
        return this.getMovimientosRepuestosHistory(filters);
      case HistoryEntityType.ORDENES_TRABAJO:
        return this.getOrdenesTrabajoHistory(filters);
      case HistoryEntityType.SOLICITUDES_MANTENIMIENTO:
        return this.getSolicitudesMantenimientoHistory(filters);
      case HistoryEntityType.LOG_ESTADOS_OT:
        return this.getLogEstadosOtHistory(filters);
      case HistoryEntityType.ENTREGAS_VEHICULOS:
        return this.getEntregasVehiculosHistory(filters);
      case HistoryEntityType.BREAKS_MECANICO:
        return this.getBreaksMecanicoHistory(filters);
      default:
        throw new Error('Tipo de entidad no válido');
    }
  }

  /**
   * Exportar historial a CSV
   */
  async exportHistoryToCSV(filters: HistoryFiltersDto): Promise<string> {
    // Obtener todos los datos sin paginación
    const allFilters = { ...filters, page: undefined, limit: undefined };
    const result = await this.getHistory(allFilters);
    const data = result.data;

    if (!data || data.length === 0) {
      return '';
    }

    // Obtener headers del primer objeto
    const headers = Object.keys(data[0]);
    
    // Crear CSV
    const csvRows = [];
    
    // Headers
    csvRows.push(headers.map(h => this.escapeCSV(h)).join(','));

    // Data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return this.escapeCSV(JSON.stringify(value));
        }
        return this.escapeCSV(String(value));
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Escapar valores para CSV
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // Formatters
  private formatSolicitudesRepuestos(data: SolicitudRepuesto[]): any[] {
    return data.map(item => ({
      id: item.id,
      numero_ot: item.orden_trabajo?.numero_ot || null,
      repuesto: item.repuesto?.nombre || null,
      sku: item.repuesto?.sku || null,
      cantidad_solicitada: item.cantidad_solicitada,
      urgencia: item.urgencia,
      estado: item.estado,
      comentarios: item.comentarios,
      solicitado_por: item.solicitado_por_user?.nombre_completo || null,
      fecha_solicitud: item.fecha_solicitud,
      fecha_aprobacion: item.fecha_aprobacion,
      fecha_estimada_entrega: item.fecha_estimada_entrega,
    }));
  }

  private formatMovimientosRepuestos(data: any[]): any[] {
    return data.map(item => ({
      id: item.id,
      repuesto: item.repuesto?.nombre || null,
      sku: item.repuesto?.sku || null,
      tipo_movimiento: item.tipo_movimiento,
      cantidad: item.cantidad,
      costo_unitario: item.costo_unitario,
      motivo: item.motivo,
      movido_por: item.usuario?.nombre_completo || null,
      taller: item.taller?.nombre || null,
      numero_ot: item.ot?.numero_ot || null,
      fecha_movimiento: item.fecha_movimiento,
    }));
  }

  private formatOrdenesTrabajo(data: WorkOrder[]): any[] {
    return data.map(item => ({
      id: item.id,
      numero_ot: item.numero_ot,
      vehiculo: item.vehiculo?.patente || null,
      mecanico: item.mecanico?.nombre_completo || null,
      estado: item.estado,
      prioridad: item.prioridad,
      descripcion_problema: item.descripcion_problema,
      taller: item.taller?.nombre || null,
      fecha_creacion: item.fecha_creacion,
      fecha_asignacion: item.fecha_asignacion,
      fecha_inicio_trabajo: item.fecha_inicio_trabajo,
      fecha_finalizacion: item.fecha_finalizacion,
      fecha_cierre: item.fecha_cierre,
    }));
  }

  private formatSolicitudesMantenimiento(data: SolicitudMantenimiento[]): any[] {
    return data.map(item => ({
      id: item.id,
      numero_solicitud: item.numero_solicitud,
      vehiculo: item.vehiculo?.patente || null,
      conductor: item.conductor?.nombre_completo || null,
      tipo_solicitud: item.tipo_solicitud,
      descripcion_problema: item.descripcion_problema,
      estado: item.estado,
      fecha_solicitud: item.fecha_solicitud,
      fecha_aprobacion: item.fecha_aprobacion,
    }));
  }

  private formatLogEstadosOt(data: any[]): any[] {
    return data.map(item => ({
      id: item.log_id || item.id,
      numero_ot: item.ot_numero_ot || item.numero_ot,
      estado_anterior: item.log_estado_anterior || item.estado_anterior,
      estado_nuevo: item.log_estado_nuevo || item.estado_nuevo,
      motivo_cambio: item.log_motivo_cambio || item.motivo_cambio,
      cambiado_por: item.usuario_nombre_completo || item.nombre_completo || item.cambiado_por,
      fecha_cambio: item.log_fecha_cambio || item.fecha_cambio,
    }));
  }

  private formatEntregasVehiculos(data: any[]): any[] {
    return data.map(item => ({
      id: item.ent_id || item.id,
      numero_ot: item.ot_numero_ot || item.numero_ot,
      tipo_entrega: item.ent_tipo_entrega || item.tipo_entrega,
      conductor: item.conductor_nombre_completo || item.nombre_completo || item.conductor,
      responsable: item.responsable_nombre_completo || item.responsable,
      condicion_vehiculo: item.ent_condicion_vehiculo || item.condicion_vehiculo,
      observaciones: item.ent_observaciones || item.observaciones,
      fecha_firma: item.ent_fecha_firma || item.fecha_firma,
    }));
  }

  private formatBreaksMecanico(data: any[]): any[] {
    return data.map(item => {
      const horaInicio = item.b_hora_inicio ? new Date(item.b_hora_inicio) : null;
      const horaTermino = item.b_hora_termino ? new Date(item.b_hora_termino) : null;
      
      // Calcular duración si hay hora de término
      let duracion = null;
      if (horaInicio && horaTermino) {
        const diffMs = horaTermino.getTime() - horaInicio.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const horas = Math.floor(diffMins / 60);
        const minutos = diffMins % 60;
        duracion = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
      } else if (horaInicio) {
        duracion = 'En curso';
      }

      return {
        id: item.b_id,
        mecanico: item.mecanico_nombre_completo || null,
        mecanico_email: item.mecanico_email || null,
        hora_inicio: item.b_hora_inicio,
        hora_termino: item.b_hora_termino,
        duracion: duracion,
        mes: item.b_mes,
        anno: item.b_anno,
        estado: item.b_hora_termino ? 'Finalizado' : 'En curso',
        fecha_creacion: item.b_fecha_creacion,
        fecha_actualizacion: item.b_fecha_actualizacion,
      };
    });
  }
}

