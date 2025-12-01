import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DataSource } from 'typeorm';
import { Vehiculo } from './entities/vehicle.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehiculo) private readonly repo: Repository<Vehiculo>,
    private readonly users: UsersService,
    private readonly ds: DataSource,
  ) { }

  async create(data: Partial<Vehiculo>) {
    const dup = await this.repo.findOne({ where: { patente: data.patente! } as FindOptionsWhere<Vehiculo> });
    if (dup) throw new BadRequestException('Patente ya registrada');

    const v = this.repo.create({
      ...data,
      estado: data.estado || 'OPERATIVO',
    });
    return this.repo.save(v);
  }

  async findAll() {
    const vehiculos = await this.repo.find({
      order: { id: 'DESC' },
    });
    const pendientes: Array<{ vehiculo_id: number; pendientes: number }> = await this.ds.query(
      `
      SELECT vehiculo_id, COUNT(*)::int AS pendientes
      FROM solicitudes_mantenimiento
      WHERE estado IN ('APROBADA', 'CITA_MANTENCION')
      GROUP BY vehiculo_id
      `,
    );
    const map = new Map<number, number>();
    for (const row of pendientes) {
      map.set(Number(row.vehiculo_id), Number(row.pendientes));
    }
    return vehiculos.map((vehiculo) => ({
      ...vehiculo,
      solicitudesPendientes: map.get(vehiculo.id) || 0,
    }));
  }

  async updateStatus(id: number, estado: Vehiculo['estado']) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    v.estado = estado;
    return this.repo.save(v);
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, patch: Partial<Vehiculo>) {
    if (patch.patente) {
      const exists = await this.repo.findOne({
        where: { patente: patch.patente }
      });
      if (exists && exists.id !== id) {
        throw new BadRequestException('Patente ya registrada');
      }
    }

    const vehiculo = await this.repo.findOne({ where: { id } });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    Object.assign(vehiculo, patch);

    return this.repo.save(vehiculo);
  }

  async remove(id: number) {
    const v = await this.findOne(id);
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    await this.repo.remove(v);
    return { id };
  }

  async getAssignedVehicleForDriver(driverId: number) {
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] ===== INICIO =====');
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Driver ID recibido:', driverId);
    
    if (!driverId) throw new BadRequestException('ID de chofer requerido');

    const driver = await this.users.findById(driverId);
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Chofer encontrado:', {
      id: driver?.id,
      nombre: driver?.nombre_completo,
      email: driver?.email,
      rol: driver?.rol
    });
    
    if (!driver) {
      console.error('[VEHICLES SERVICE - getAssignedVehicleForDriver] ERROR: Chofer no encontrado');
      throw new NotFoundException('Chofer no encontrado');
    }

    // Verificar los vehículos con ese conductor_actual_id
    const todosVehiculosConductor = await this.repo.find({ 
      where: { conductor_actual_id: driverId } 
    });
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] 🔍 BÚSQUEDA DE VEHÍCULO:');
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Total vehículos encontrados con conductor_actual_id =', driverId, ':', todosVehiculosConductor.length);
    todosVehiculosConductor.forEach((v, idx) => {
      console.log(`[VEHICLES SERVICE - getAssignedVehicleForDriver] Vehículo ${idx + 1}:`, {
        id: v.id,
        patente: v.patente,
        marca: v.marca,
        modelo: v.modelo,
        estado: v.estado,
        conductor_actual_id: v.conductor_actual_id
      });
    });
    
    // Verificación SQL directa
    const vehiculoVerificacionSQL = await this.ds.query(
      'SELECT id, patente, marca, modelo, estado, conductor_actual_id FROM vehiculos WHERE conductor_actual_id = $1',
      [driverId]
    );
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] 🔍 Verificación SQL directa:', {
      query: 'SELECT ... WHERE conductor_actual_id = ' + driverId,
      resultados: vehiculoVerificacionSQL,
      numResultados: vehiculoVerificacionSQL.length
    });
    
    if (vehiculoVerificacionSQL.length > 1) {
      console.warn('[VEHICLES SERVICE - getAssignedVehicleForDriver] ⚠️ ADVERTENCIA: Múltiples vehículos con el mismo conductor_actual_id!', {
        chofer_id: driverId,
        vehículos: vehiculoVerificacionSQL
      });
    }

    const vehiculo = await this.repo.findOne({ where: { conductor_actual_id: driverId } });
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Vehículo seleccionado (findOne):', {
      id: vehiculo?.id,
      patente: vehiculo?.patente,
      marca: vehiculo?.marca,
      modelo: vehiculo?.modelo,
      estado: vehiculo?.estado,
      conductor_actual_id: vehiculo?.conductor_actual_id
    });
    
    if (!vehiculo) {
      console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] No hay vehículo asignado');
      console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] ===== FIN (sin vehículo) =====');
      return { vehiculo: null, workOrder: null };
    }
    
    // Verificar que el vehículo encontrado corresponde al chofer
    if (vehiculo.conductor_actual_id !== driverId) {
      console.error('[VEHICLES SERVICE - getAssignedVehicleForDriver] ⚠️⚠️⚠️ ERROR CRÍTICO: Vehículo encontrado NO corresponde al chofer!', {
        vehiculo_id: vehiculo.id,
        vehiculo_patente: vehiculo.patente,
        vehiculo_conductor_actual_id: vehiculo.conductor_actual_id,
        chofer_id_solicitado: driverId,
        chofer_nombre: driver.nombre_completo
      });
    }

    // Asegurar que el estado del vehículo esté actualizado usando consulta SQL directa
    // (evita problemas de caché de TypeORM)
    try {
      const vehiculoActualizado = await this.ds.query(
        `SELECT id, patente, estado, conductor_actual_id FROM vehiculos WHERE id = $1`,
        [vehiculo.id]
      );
      console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Estado del vehículo desde BD:', {
        vehiculo_id: vehiculo.id,
        resultado_sql: vehiculoActualizado
      });
      
      if (vehiculoActualizado && vehiculoActualizado.length > 0) {
        const estadoAnterior = vehiculo.estado;
        vehiculo.estado = vehiculoActualizado[0].estado;
        
        // Verificar que el conductor_actual_id no haya cambiado
        if (vehiculoActualizado[0].conductor_actual_id !== driverId) {
          console.error('[VEHICLES SERVICE - getAssignedVehicleForDriver] ⚠️⚠️⚠️ ERROR CRÍTICO: conductor_actual_id cambió en la BD!', {
            vehiculo_id: vehiculo.id,
            vehiculo_patente: vehiculo.patente,
            conductor_actual_id_en_bd: vehiculoActualizado[0].conductor_actual_id,
            chofer_id_esperado: driverId
          });
        }
        
        if (estadoAnterior !== vehiculo.estado) {
          console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Estado actualizado:', {
            estado_anterior: estadoAnterior,
            estado_nuevo: vehiculo.estado
          });
        }
      }
    } catch (err) {
      console.warn('[VEHICLES SERVICE - getAssignedVehicleForDriver] No se pudo actualizar el estado del vehículo desde la base de datos:', err);
    }

    // Solo devolver OTs realmente activas (no completadas y con fechas recientes/futuras)
    // No devolver OTs pasadas que están en estado LISTO o APROBADO pero ya fueron cerradas
    // Si hay una solicitud pendiente, NO debe haber OT activa
    const [rawOrder] = await this.ds.query(
      `
      SELECT
        ot.id,
        ot.numero_ot,
        ot.estado,
        ot.prioridad,
        ot.descripcion_problema,
        ot.fecha_apertura,
        ot.fecha_asignacion,
        ot.fecha_inicio_trabajo,
        ot.fecha_estimada_termino,
        ot.fecha_finalizacion,
        ot.fecha_cierre,
        t.nombre AS taller_nombre,
        t.telefono AS taller_telefono,
        t.region AS taller_region,
        t.direccion AS taller_direccion,
        mec.nombre_completo AS mecanico_nombre,
        mec.telefono AS mecanico_telefono
      FROM ordenes_trabajo ot
      LEFT JOIN talleres t ON t.id = ot.taller_id
      LEFT JOIN usuarios mec ON mec.id = ot.mecanico_asignado_id
      WHERE ot.vehiculo_id = $1
        AND ot.estado <> 'CANCELADA'
        AND ot.estado <> 'COMPLETADO'
        -- Excluir OTs que tienen fecha_cierre en el pasado (más de 1 día)
        AND (ot.fecha_cierre IS NULL OR ot.fecha_cierre >= NOW() - INTERVAL '1 day')
        -- Excluir OTs con fecha_inicio_trabajo muy antigua (más de 60 días)
        -- Esto evita mostrar OTs pasadas en estado LISTO o APROBADO
        AND (ot.fecha_inicio_trabajo IS NULL OR ot.fecha_inicio_trabajo >= NOW() - INTERVAL '60 days')
        -- Excluir OTs con fecha_apertura muy antigua si no tienen fecha_inicio_trabajo
        AND (ot.fecha_inicio_trabajo IS NOT NULL OR ot.fecha_apertura >= NOW() - INTERVAL '30 days')
      ORDER BY COALESCE(ot.fecha_apertura, ot.fecha_creacion) DESC, ot.fecha_creacion DESC
      LIMIT 1
      `,
      [vehiculo.id],
    );

    // Incluir descripcion_proceso_realizado en la consulta
    const [rawOrderUpdated] = await this.ds.query(
      `
      SELECT
        ot.id,
        ot.numero_ot,
        ot.estado,
        ot.prioridad,
        ot.descripcion_problema,
        ot.descripcion_proceso_realizado,
        ot.fecha_apertura,
        ot.fecha_asignacion,
        ot.fecha_inicio_trabajo,
        ot.fecha_estimada_termino,
        ot.fecha_finalizacion,
        ot.fecha_cierre,
        t.nombre AS taller_nombre,
        t.telefono AS taller_telefono,
        t.region AS taller_region,
        t.direccion AS taller_direccion,
        mec.nombre_completo AS mecanico_nombre,
        mec.telefono AS mecanico_telefono
      FROM ordenes_trabajo ot
      LEFT JOIN talleres t ON t.id = ot.taller_id
      LEFT JOIN usuarios mec ON mec.id = ot.mecanico_asignado_id
      WHERE ot.vehiculo_id = $1
        AND ot.estado <> 'CANCELADA'
        AND ot.estado <> 'COMPLETADO'
        -- Excluir OTs que tienen fecha_cierre en el pasado (más de 1 día)
        AND (ot.fecha_cierre IS NULL OR ot.fecha_cierre >= NOW() - INTERVAL '1 day')
        -- Excluir OTs con fecha_inicio_trabajo muy antigua (más de 60 días)
        -- Esto evita mostrar OTs pasadas en estado LISTO o APROBADO
        AND (ot.fecha_inicio_trabajo IS NULL OR ot.fecha_inicio_trabajo >= NOW() - INTERVAL '60 days')
        -- Excluir OTs con fecha_apertura muy antigua si no tienen fecha_inicio_trabajo
        AND (ot.fecha_inicio_trabajo IS NOT NULL OR ot.fecha_apertura >= NOW() - INTERVAL '30 days')
      ORDER BY COALESCE(ot.fecha_apertura, ot.fecha_creacion) DESC, ot.fecha_creacion DESC
      LIMIT 1
      `,
      [vehiculo.id],
    );

    // Usar rawOrderUpdated que incluye descripcion_proceso_realizado
    const rawOrderToUse = rawOrderUpdated || rawOrder;
    
    let workOrder = rawOrderToUse
      ? {
          id: rawOrderToUse.id,
          numero_ot: rawOrderToUse.numero_ot,
          numero: rawOrderToUse.numero_ot,
          estado: rawOrderToUse.estado,
          prioridad: rawOrderToUse.prioridad,
          descripcion: rawOrderToUse.descripcion_problema,
          descripcion_proceso_realizado: rawOrderToUse.descripcion_proceso_realizado,
          fechas: {
            apertura: rawOrderToUse.fecha_apertura,
            asignacion: rawOrderToUse.fecha_asignacion,
            inicio: rawOrderToUse.fecha_inicio_trabajo,
            estimada: rawOrderToUse.fecha_estimada_termino,
            finalizacion: rawOrderToUse.fecha_finalizacion,
            cierre: rawOrderToUse.fecha_cierre,
          },
          taller: rawOrderToUse.taller_nombre
            ? {
                nombre: rawOrderToUse.taller_nombre,
                telefono: rawOrderToUse.taller_telefono,
                region: rawOrderToUse.taller_region,
                direccion: rawOrderToUse.taller_direccion,
              }
            : null,
          mecanico: rawOrderToUse.mecanico_nombre
            ? {
                nombre: rawOrderToUse.mecanico_nombre,
                telefono: rawOrderToUse.mecanico_telefono,
              }
            : null,
        }
      : null;

    // Obtener solicitud pendiente
    // Si hay OT activa pero también hay solicitud pendiente más reciente, priorizar la solicitud
    const [rawSolicitud] = await this.ds.query(
      `
      SELECT
        s.id,
        s.numero_solicitud,
        s.estado,
        s.descripcion_problema,
        s.tipo_solicitud,
        s.urgencia,
        s.fecha_creacion
      FROM solicitudes_mantenimiento s
      WHERE s.vehiculo_id = $1
        AND s.estado IN ('PENDIENTE', 'EN_REVISION', 'APROBADA')
      ORDER BY s.fecha_creacion DESC
      LIMIT 1
      `,
      [vehiculo.id],
    );

    let pendingSolicitud = null;
    if (rawSolicitud) {
      pendingSolicitud = {
        id: rawSolicitud.id,
        numero_solicitud: rawSolicitud.numero_solicitud,
        estado: rawSolicitud.estado,
        descripcion: rawSolicitud.descripcion_problema,
        tipo_solicitud: rawSolicitud.tipo_solicitud,
        urgencia: rawSolicitud.urgencia,
        fecha_creacion: rawSolicitud.fecha_creacion,
      };

      if (workOrder && rawSolicitud.fecha_creacion) {
        const solicitudFecha = new Date(rawSolicitud.fecha_creacion);
        const otFecha = workOrder.fechas?.apertura ? new Date(workOrder.fechas.apertura) : null;
        
        // Si la solicitud es más reciente que la OT, la solicitud tiene prioridad
        if (otFecha && solicitudFecha > otFecha) {
          console.log('[VEHICLES SERVICE] Solicitud pendiente más reciente que OT, no devolviendo OT');
          workOrder = null;
        }
      }
    }

    const resultado = {
      vehiculo: {
        id: vehiculo.id,
        patente: vehiculo.patente,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio_modelo: vehiculo.anio_modelo,
        estado: vehiculo.estado,
        ultima_novedad: vehiculo.ultima_novedad ?? null,
        ultima_novedad_detalle: vehiculo.ultima_novedad_detalle ?? null,
        ultima_novedad_fecha: vehiculo.ultima_novedad_fecha ?? null,
      },
      workOrder,
      pendingSolicitud,
    };
    
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] Retornando resultado:', {
      vehiculo_id: resultado.vehiculo.id,
      vehiculo_patente: resultado.vehiculo.patente,
      vehiculo_marca: resultado.vehiculo.marca,
      vehiculo_modelo: resultado.vehiculo.modelo,
      vehiculo_estado: resultado.vehiculo.estado,
      workOrder_id: resultado.workOrder?.id || null,
      workOrder_numero: resultado.workOrder?.numero_ot || null,
      resultadoCompleto: resultado
    });
    console.log('[VEHICLES SERVICE - getAssignedVehicleForDriver] ===== FIN =====');
    
    return resultado;
  }

  async getHistoryForDriver(driverId: number) {
    if (!driverId) throw new BadRequestException('ID de chofer requerido');

    const driver = await this.users.findById(driverId);
    if (!driver) {
      throw new NotFoundException('Chofer no encontrado');
    }

    // Obtener todas las OTs completadas del chofer (vehículos que fueron asignados al chofer)
    const historial = await this.ds.query(
      `
      SELECT
        ot.id,
        ot.numero_ot,
        ot.estado,
        ot.prioridad,
        ot.descripcion_problema,
        ot.descripcion_proceso_realizado,
        ot.fecha_apertura,
        ot.fecha_asignacion,
        ot.fecha_inicio_trabajo,
        ot.fecha_estimada_termino,
        ot.fecha_finalizacion,
        ot.fecha_cierre,
        v.id AS vehiculo_id,
        v.patente AS vehiculo_patente,
        v.marca AS vehiculo_marca,
        v.modelo AS vehiculo_modelo,
        v.año_modelo AS vehiculo_anio,
        t.nombre AS taller_nombre,
        t.telefono AS taller_telefono,
        t.region AS taller_region,
        t.direccion AS taller_direccion,
        mec.nombre_completo AS mecanico_nombre,
        mec.telefono AS mecanico_telefono
      FROM ordenes_trabajo ot
      INNER JOIN vehiculos v ON v.id = ot.vehiculo_id
      LEFT JOIN talleres t ON t.id = ot.taller_id
      LEFT JOIN usuarios mec ON mec.id = ot.mecanico_asignado_id
      WHERE v.conductor_actual_id = $1
        AND ot.estado = 'COMPLETADO'
      ORDER BY ot.fecha_cierre DESC, ot.fecha_creacion DESC
      `,
      [driverId],
    );

    return historial.map((item: any) => ({
      id: item.id,
      numero_ot: item.numero_ot,
      numero: item.numero_ot,
      estado: item.estado,
      prioridad: item.prioridad,
      descripcion: item.descripcion_problema,
      descripcion_proceso_realizado: item.descripcion_proceso_realizado,
      fechas: {
        apertura: item.fecha_apertura,
        asignacion: item.fecha_asignacion,
        inicio: item.fecha_inicio_trabajo,
        estimada: item.fecha_estimada_termino,
        finalizacion: item.fecha_finalizacion,
        cierre: item.fecha_cierre,
      },
      vehiculo: {
        id: item.vehiculo_id,
        patente: item.vehiculo_patente,
        marca: item.vehiculo_marca,
        modelo: item.vehiculo_modelo,
        anio_modelo: item.vehiculo_anio,
      },
      taller: item.taller_nombre
        ? {
            nombre: item.taller_nombre,
            telefono: item.taller_telefono,
            region: item.taller_region,
            direccion: item.taller_direccion,
          }
        : null,
      mecanico: item.mecanico_nombre
        ? {
            nombre: item.mecanico_nombre,
            telefono: item.mecanico_telefono,
          }
        : null,
    }));
  }
}