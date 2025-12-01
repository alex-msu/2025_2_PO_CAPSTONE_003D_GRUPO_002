import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WorkOrder, Vehicle, User, Shop } from './entities/workorder.entity';
import { SolicitudMantenimiento } from '../solicitudes/entities/solicitud.entity';
import { EventsGateway } from '../events/events.gateway';
import { CreateWorkOrderDto } from './dto/create-workorder.dto';
import { AssignMechanicDto } from './dto/assign-mechanic.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateWorkOrderDto } from './dto/update-workorder.dto';
import { CheckInWorkOrderDto } from './dto/checkin-workorder.dto';
import { FilesService } from '../files/files.service';
import { StartDiagnosticDto } from './dto/start-diagnostic.dto';
import { ResolveDiscrepancyDto } from './dto/resolve-discrepancy.dto';
import { CloseWorkOrderDto } from './dto/close-workorder.dto';
import { ApproveWorkOrderDto } from './dto/approve-workorder.dto';
import { RejectWorkOrderDto } from './dto/reject-workorder.dto';
import { FinalizeRetiroDto } from './dto/finalize-retiro.dto';
import { ConfirmRetiroDto } from './dto/confirm-retiro.dto';
import { BreakMecanico } from '../users/entities/break-mecanico.entity';
import * as bcrypt from 'bcrypt';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function normalizePlanDate(raw?: string | null, defaultHour = 9): Date | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (value.includes('T')) {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month, day, defaultHour, 0, 0, 0);
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(WorkOrder) private readonly otRepo: Repository<WorkOrder>,
    @InjectRepository(Vehicle) private readonly vehRepo: Repository<Vehicle>,
    @InjectRepository(BreakMecanico) private readonly breakRepo: Repository<BreakMecanico>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Shop) private readonly shopRepo: Repository<Shop>,
    @InjectRepository(SolicitudMantenimiento) private readonly solRepo: Repository<SolicitudMantenimiento>,
    private readonly events: EventsGateway,
    private readonly files: FilesService,
  ) {
    this.ensureFechaEstimadaColumn();
  }

  private readonly solicitudEvidenceFields: Array<
    keyof Pick<
      SolicitudMantenimiento,
      | 'evidencia_foto_principal'
      | 'evidencia_foto_adicional_1'
      | 'evidencia_foto_adicional_2'
      | 'evidencia_foto_adicional_3'
      | 'evidencia_foto_adicional_4'
      | 'evidencia_foto_adicional_5'
    >
  > = [
    'evidencia_foto_principal',
    'evidencia_foto_adicional_1',
    'evidencia_foto_adicional_2',
    'evidencia_foto_adicional_3',
    'evidencia_foto_adicional_4',
    'evidencia_foto_adicional_5',
  ];

  private ensureFechaEstimadaColumn() {
    this.ds
      .query(`ALTER TABLE IF EXISTS ordenes_trabajo ADD COLUMN IF NOT EXISTS fecha_estimada_termino TIMESTAMP`)
      .catch((err) => {
        console.error('No se pudo verificar columna fecha_estimada_termino:', err.message || err);
      });
  }

  private async hydrateSolicitudEvidencias(sol?: SolicitudMantenimiento | null) {
    if (!sol) return sol;
    await Promise.all(
      this.solicitudEvidenceFields.map(async (field) => {
        const value = sol[field] as string | null | undefined;
        if (!value) return;
        try {
          const signed = await this.files.ensureSignedUrl(value);
          (sol as any)[field] = signed;
        } catch (err) {
          console.warn('No se pudo firmar evidencia', field, err);
        }
      }),
    );
    return sol;
  }

  private async hydrateDiagnosticEvidences(ot?: WorkOrder | null) {
    if (!ot || !ot.diagnostico_evidencias || !ot.diagnostico_evidencias.length) return;
    try {
      const signed = await Promise.all(
        ot.diagnostico_evidencias.map((item) => this.files.ensureSignedUrl(item)),
      );
      ot.diagnostico_evidencias = signed;
    } catch (err) {
      console.warn('No se pudieron firmar evidencias de diagnóstico', err);
    }
  }

  private async hydrateCierreEvidences(ot?: WorkOrder | null) {
    if (!ot || !ot.cierre_evidencias || !ot.cierre_evidencias.length) return;
    try {
      const signed = await Promise.all(
        ot.cierre_evidencias.map((item) => this.files.ensureSignedUrl(item)),
      );
      ot.cierre_evidencias = signed;
    } catch (err) {
      console.warn('No se pudieron firmar evidencias de cierre', err);
    }
  }

  private async updateVehiculoEstado(vehiculoId: number, estado: Vehicle['estado']) {
    try {
      console.log(`Actualizando estado del vehículo ${vehiculoId} a ${estado}`);
      // Usar consulta SQL directa para asegurar que se actualice correctamente
      const result = await this.ds.query(
        `UPDATE vehiculos SET estado = $1 WHERE id = $2`,
        [estado, vehiculoId]
      );
      console.log(`Resultado de actualización SQL:`, result);
      // Verificar que se actualizó correctamente
      const vehiculo = await this.ds.query(
        `SELECT estado FROM vehiculos WHERE id = $1`,
        [vehiculoId]
      );
      console.log(`Estado del vehículo después de actualizar:`, vehiculo?.[0]?.estado);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn('No se pudo actualizar estado del vehículo', vehiculoId, reason);
      throw err; // Re-lanzar el error para que el método que llama pueda manejarlo
    }
  }

  private async recordVehiculoEvento(vehiculoId: number, tipo: string, detalle?: string) {
    try {
      await this.vehRepo.update(vehiculoId, {
        ultima_novedad: tipo,
        ultima_novedad_detalle: detalle ?? null,
        ultima_novedad_fecha: new Date(),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn('No se pudo registrar evento en vehículo', vehiculoId, reason);
    }
  }

  /**
   * Mapea estados de OT a estados del vehículo.
   * Futuro: recepcionistas podrán forzar 'EN_TALLER' al registrar la entrada,
   * y otros actores podrán llamar a updateVehiculoEstado directamente para reflejar hitos.
   */
  private determinarEstadoInicial(prioridad: string, necesitaRepuestos: boolean = false): WorkOrder['estado'] {
    // Al crear una OT, siempre inicia en APROBADO (esperando recepción del vehículo)
    // La autorización del supervisor se requiere al finalizar, no al crear
    return 'APROBADO';
  }
  
  // Determina si una OT lista necesita autorización del supervisor para ser completada
  private necesitaAutorizacionFinalizacion(prioridad: string): boolean {
    return prioridad === 'ALTA' || prioridad === 'URGENTE';
  }

  private vehiculoEstadoDesdeOt(estado: WorkOrder['estado']): Vehicle['estado'] | null {
    switch (estado) {
      case 'PENDIENTE':
      case 'APROBADO':
      case 'PENDIENTE_AUTORIZACION_SUPERVISOR':
        return 'CITA_MANTENCION';
      case 'EN_PROCESO':
        return 'MANTENCION';
      case 'ESPERA_REPUESTOS':
        return 'EN_TALLER';
      case 'LISTO':
        return 'MANTENCION';
      case 'COMPLETADO':
        return 'COMPLETADO';
      case 'CANCELADA':
        return 'OPERATIVO';
      default:
        return null;
    }
  }

  // Genera OT-YYYY-000001 secuencial
  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const row = await this.otRepo
      .createQueryBuilder('ot')
      .select("MAX(SPLIT_PART(ot.numero_ot, '-', 3))", 'maxseq')
      .where("SPLIT_PART(ot.numero_ot,'-',2) = :year", { year: String(year) })
      .getRawOne<{ maxseq: string | null }>();
    const seq = (row?.maxseq ? parseInt(row.maxseq, 10) : 0) + 1;
    return `OT-${year}-${String(seq).padStart(6, '0')}`;
  }

  // Chofer crea OT (emergencia o con hora). Taller se deduce por reserva vigente o regla de negocio.
  async createFromDriver(userId: number, dto: CreateWorkOrderDto) {
    if (!userId) {
      throw new BadRequestException('ID de usuario requerido');
    }

    const vehiculo = await this.vehRepo.findOne({ where: { id: dto.vehiculoId } });
    if (!vehiculo) throw new NotFoundException('Vehículo no existe');

    // 1) Deducir taller: regla simple — último taller usado por el vehículo o un default.
    const taller = await this.resolveTallerForVehicle(vehiculo.id);
    if (!taller) throw new BadRequestException('Vehículo sin taller asociado');

    // Para chofer, el jefe_taller se deduce del taller (primer jefe de taller del taller)
    const jefeTaller = await this.userRepo
      .createQueryBuilder('u')
      .where('u.rol = :rol', { rol: 'JEFE_TALLER' })
      .andWhere('u.activo = true')
      .orderBy('u.id', 'ASC')
      .getOne();
    
    if (!jefeTaller) throw new BadRequestException('No hay jefe de taller disponible');

    const numero = await this.nextNumber();

    const prioridad = dto.prioridad ?? 'NORMAL';
    const fechaEstimadaRaw = dto.fechaEstimadaTermino || dto.fechaFinPlan || dto.fechaProgramada || null;
    const fechaEstimada = fechaEstimadaRaw ? normalizePlanDate(fechaEstimadaRaw, 18) : null;
    if (fechaEstimadaRaw && !fechaEstimada) {
      throw new BadRequestException('Fecha estimada de término inválida');
    }

    // Transacción: insertar OT + log
    const result = await this.ds.transaction(async (trx) => {
      const ot = trx.getRepository(WorkOrder).create({
        numero_ot: numero,
        vehiculo,
        taller,
        jefe_taller: jefeTaller,
        mecanico: null,
        prioridad,
        estado: 'PENDIENTE',
        descripcion_problema: dto.descripcion,
        fecha_apertura: new Date(),
        fecha_estimada_termino: fechaEstimada,
      });
      const saved = await trx.getRepository(WorkOrder).save(ot);
      await trx.getRepository(Vehicle).update(vehiculo.id, { estado: 'CITA_MANTENCION' });

      // Usar userId si está disponible, de lo contrario usar jefeTaller.id como fallback
      const cambiadoPor = userId || jefeTaller.id;

      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1, $2, $3, $4, $5)`,
        [saved.id, null, 'PENDIENTE', cambiadoPor, 'Creación por chofer'],
      );

      return { id: saved.id, numero_ot: saved.numero_ot, estado: saved.estado };
    });
    this.events.emitVehiculoRefresh(vehiculo.id);
    this.events.emitReceptionRefresh();
    return result;
  }

  // Jefe de taller crea OT directamente
  async createFromJefeTaller(jefeId: number, dto: CreateWorkOrderDto) {
    if (!jefeId) {
      throw new BadRequestException('ID de jefe de taller requerido');
    }

    const vehiculo = await this.vehRepo.findOne({ where: { id: dto.vehiculoId } });
    if (!vehiculo) throw new NotFoundException('Vehículo no existe');

    const taller = await this.resolveTallerForVehicle(vehiculo.id);
    if (!taller) throw new BadRequestException('Vehículo sin taller asociado');

    const jefeTaller = await this.userRepo.findOne({ where: { id: jefeId } });
    if (!jefeTaller) throw new NotFoundException('Jefe de taller no encontrado');
    if (jefeTaller.rol !== 'JEFE_TALLER') {
      throw new BadRequestException('El usuario no es jefe de taller');
    }

    const numero = await this.nextNumber();
    const prioridad = dto.prioridad ?? 'NORMAL';
    
    // Aplicar lógica de autorización: si la prioridad es ALTA o URGENTE, requiere autorización
    // Si el estado viene del frontend y es explícito, respetarlo; si no, aplicar lógica automática
    let estado: WorkOrder['estado'];
    if (dto.estado && dto.estado !== 'PENDIENTE') {
      // Si el frontend envía un estado específico, respetarlo
      const estadoMap: Record<string, WorkOrder['estado']> = {
        'PENDIENTE': 'PENDIENTE',
        'EN_PROCESO': 'EN_PROCESO',
        'ESPERA_REPUESTOS': 'ESPERA_REPUESTOS',
        'LISTO': 'LISTO',
        'PENDIENTE_AUTORIZACION_SUPERVISOR': 'PENDIENTE_AUTORIZACION_SUPERVISOR',
      };
      estado = estadoMap[dto.estado] || 'PENDIENTE';
    } else {
      // Aplicar lógica automática basada en prioridad
      const necesitaRepuestos = false; // Por defecto, asumimos que no necesita repuestos
      estado = this.determinarEstadoInicial(prioridad, necesitaRepuestos);
    }

    let solicitud: SolicitudMantenimiento | null = null;
    if (dto.solicitudId) {
      solicitud = await this.solRepo.findOne({
        where: { id: dto.solicitudId },
        relations: ['vehiculo'],
      });
      if (!solicitud) {
        throw new NotFoundException('Solicitud no encontrada');
      }
      if (solicitud.estado !== 'APROBADA') {
        throw new BadRequestException('La solicitud seleccionada no está aprobada');
      }
      if (solicitud.vehiculo.id !== vehiculo.id) {
        throw new BadRequestException('La solicitud no corresponde a este vehículo');
      }
    }

    if (!dto.mecanicoId) {
      throw new BadRequestException('Debes asignar un mecánico a la orden.');
    }
    const mecanico = await this.userRepo.findOne({ where: { id: dto.mecanicoId } });
    if (!mecanico || (mecanico.rol !== 'MECANICO' && mecanico.rol !== 'mecanico')) {
      throw new BadRequestException('Mecánico inválido.');
    }

    const fechaInicioPlanRaw = dto.fechaInicioPlan;
    const fechaEstimadaRaw = dto.fechaEstimadaTermino || dto.fechaFinPlan;

    if (!fechaInicioPlanRaw || !fechaEstimadaRaw) {
      throw new BadRequestException('Debes indicar las fechas de inicio y término planificadas.');
    }

    const fechaInicioPlan = normalizePlanDate(fechaInicioPlanRaw, 9);
    const fechaEstimadaTermino = normalizePlanDate(fechaEstimadaRaw, 18);
    if (!fechaInicioPlan || !fechaEstimadaTermino) {
      throw new BadRequestException('Fechas planificadas inválidas.');
    }
    if (fechaEstimadaTermino < fechaInicioPlan) {
      throw new BadRequestException('La fecha de término no puede ser anterior a la fecha de inicio.');
    }

    // Transacción: insertar OT + log
    const result = await this.ds.transaction(async (trx) => {
      const otRepo = trx.getRepository(WorkOrder);
      const ot = otRepo.create({
        numero_ot: numero,
        vehiculo,
        taller,
        jefe_taller: jefeTaller,
        mecanico,
        prioridad,
        estado: estado,
        descripcion_problema: dto.descripcion,
        fecha_apertura: new Date(),
        fecha_asignacion: new Date(),
        fecha_inicio_trabajo: fechaInicioPlan,
        fecha_estimada_termino: fechaEstimadaTermino,
        solicitud: solicitud ?? null,
      });
      const saved = await otRepo.save(ot);
      await trx.getRepository(Vehicle).update(vehiculo.id, { estado: 'CITA_MANTENCION' });

      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1, $2, $3, $4, $5)`,
        [saved.id, null, estado, jefeId, 'Creación por jefe de taller'],
      );

      if (solicitud) {
        solicitud.estado = 'CONVERTIDA_OT';
        solicitud.fecha_actualizacion = new Date();
        await trx.getRepository(SolicitudMantenimiento).save(solicitud);
      }

      return { id: saved.id, numero_ot: saved.numero_ot, estado: saved.estado, solicitud };
    });
    this.events.emitVehiculoRefresh(vehiculo.id);
    if (dto.solicitudId) {
      this.events.emitSolicitudesRefresh();
      
      // Notificar al chofer cuando su solicitud se convierte en OT
      if (solicitud?.conductor?.id) {
        await this.events.emitDriverNotification(solicitud.conductor.id, {
          tipo: 'info',
          titulo: '🔧 Orden de Trabajo Creada',
          mensaje: `Tu solicitud ${solicitud.numero_solicitud} ha sido convertida en la OT ${result.numero_ot}. El vehículo ${vehiculo.patente} está programado para mantenimiento.`,
          otId: result.id,
          solicitudId: solicitud.id,
        });
      }
    }
    
    // Notificar a recepcionistas sobre nueva OT programada
    const recepcionistas = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.rol) IN (:...roles)', { roles: ['recepcion', 'recepcionista'] })
      .andWhere('u.activo = true')
      .getMany();
    
    for (const recep of recepcionistas) {
      await this.events.emitRecepcionistaNotification(recep.id, {
        tipo: 'info',
        titulo: '📅 Nueva OT Programada',
        mensaje: `Nueva OT ${result.numero_ot} programada para el vehículo ${vehiculo.patente}. Fecha estimada: ${fechaInicioPlan.toLocaleDateString('es-CL')} - ${fechaEstimadaTermino.toLocaleDateString('es-CL')}`,
        otId: result.id,
      });
    }
    
    this.events.emitReceptionRefresh();
    this.events.emitWorkOrdersRefresh();
    return result;
  }

  async assignMechanic(jefeId: number, dto: AssignMechanicDto) {
    const ot = await this.otRepo.findOne({
      where: { id: dto.workOrderId },
      relations: ['mecanico', 'taller', 'vehiculo'],
    });
    if (!ot) throw new NotFoundException('OT no existe');
    if (!['PENDIENTE','APROBADO'].includes(ot.estado)) {
      throw new BadRequestException(`Estado inválido para asignar: ${ot.estado}`);
    }

    const mechanic = await this.userRepo.findOne({ where: { id: dto.mechanicId } });
    if (!mechanic || mechanic.rol !== 'MECANICO') {
      throw new BadRequestException('Mecánico inválido');
    }

    return await this.ds.transaction(async (trx) => {
      const prev = ot.estado;
      ot.mecanico = mechanic;
      ot.estado = 'APROBADO';
      ot.fecha_asignacion = new Date();
      // Preservar fecha_inicio_trabajo si ya existe (fecha planificada), no sobrescribirla
      // Si no existe, no la establecemos aquí - se establecerá cuando el recepcionista confirme la llegada
      await trx.getRepository(WorkOrder).save(ot);

      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1,$2,$3,$4,$5)`,
        [ot.id, prev, ot.estado, jefeId, 'Aprobación y asignación de mecánico - Esperando recepción'],
      );

      if (ot.vehiculo) {
        // Cuando se asigna mecánico pero aún no llega al taller, el vehículo debe estar en CITA_MANTENCION
        // No cambiar a EN_TALLER hasta que el recepcionista confirme la llegada
        await this.updateVehiculoEstado(ot.vehiculo.id, 'CITA_MANTENCION');
      }

      return { id: ot.id, numero_ot: ot.numero_ot, estado: ot.estado, mecanicoId: mechanic.id };
    });
  }

  // Cambiar estado (mecánico/almacén/cierre)
  async updateStatus(userId: number, id: number, dto: UpdateStatusDto) {
    const ot = await this.otRepo.findOne({ where: { id }, relations: ['vehiculo', 'mecanico'] });
    if (!ot) throw new NotFoundException('OT no existe');

    const prev = ot.estado;
    let nuevoEstado: WorkOrder['estado'] = dto.status;
    
    // Si el mecánico marca la OT como LISTO y la prioridad es ALTA o URGENTE,
    // requiere autorización del supervisor antes de completarse
    if (dto.status === 'LISTO' && this.necesitaAutorizacionFinalizacion(ot.prioridad)) {
      nuevoEstado = 'PENDIENTE_AUTORIZACION_SUPERVISOR';
    }
    
    // Si se inicia el trabajo (cambio a EN_PROCESO y ya tiene diagnóstico), 
    // registrar fecha_inicio_trabajo y cambiar vehículo a MANTENCION
    const tieneDiagnostico = !!(ot.diagnostico_inicial && ot.diagnostico_inicial.trim());
    // Verificar si es inicio de trabajo: estado cambia a EN_PROCESO, tiene diagnóstico, y no tiene fecha_inicio_trabajo
    // O si el estado ya es EN_PROCESO pero el vehículo no está en MANTENCION (caso donde ya se inició diagnóstico)
    const vehiculoActual = ot.vehiculo?.estado;
    const esInicioTrabajo = dto.status === 'EN_PROCESO' && 
                           tieneDiagnostico &&
                           (!ot.fecha_inicio_trabajo || vehiculoActual !== 'MANTENCION');
    
    console.log('updateStatus: Verificando inicio de trabajo:', {
      status: dto.status,
      prev,
      tieneDiagnostico,
      fecha_inicio_trabajo: ot.fecha_inicio_trabajo,
      vehiculoEstado: vehiculoActual,
      esInicioTrabajo
    });
    
    if (esInicioTrabajo) {
      if (!ot.fecha_inicio_trabajo) {
        ot.fecha_inicio_trabajo = new Date();
      }
    }
    
    ot.estado = nuevoEstado;

    const updated = await this.ds.transaction(async (trx) => {
      await trx.getRepository(WorkOrder).save(ot);
      const motivo = nuevoEstado === 'PENDIENTE_AUTORIZACION_SUPERVISOR' && dto.status === 'LISTO'
        ? 'Trabajo finalizado - Requiere autorización del supervisor por prioridad alta'
        : esInicioTrabajo
        ? 'Trabajo iniciado por mecánico'
        : 'Cambio de estado';
      
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, prev, nuevoEstado, userId, motivo],
      );
      
      // Si se requiere autorización, notificar al jefe de taller
      if (nuevoEstado === 'PENDIENTE_AUTORIZACION_SUPERVISOR') {
        this.events.emitSolicitudesRefresh();
      }
      
      // Solo cambiar el vehículo a MANTENCION cuando se inicia el trabajo (no durante el diagnóstico)
      if (ot.vehiculo) {
        if (esInicioTrabajo) {
          // Cuando se inicia el trabajo, cambiar vehículo a MANTENCION
          console.log('updateStatus: Cambiando vehículo a MANTENCION, vehículo ID:', ot.vehiculo.id);
          await this.updateVehiculoEstado(ot.vehiculo.id, 'MANTENCION');
          await this.recordVehiculoEvento(
            ot.vehiculo.id,
            'Trabajo iniciado',
            'El mecánico ha comenzado el trabajo de reparación.',
          );
          this.events.emitVehiculoRefresh(ot.vehiculo.id);
        } else {
          // Para otros cambios de estado, usar la función normal
          const vehEstado = this.vehiculoEstadoDesdeOt(nuevoEstado);
          if (vehEstado && vehEstado !== 'MANTENCION') {
            await this.updateVehiculoEstado(ot.vehiculo.id, vehEstado);
          }
        }
      }
      // Recargar la OT con todas las relaciones para asegurar que el vehículo esté actualizado
      const otActualizada = await trx.getRepository(WorkOrder).findOne({
        where: { id: ot.id },
        relations: ['vehiculo', 'mecanico', 'solicitud', 'jefe_taller'],
      });
      
      return { 
        id: otActualizada?.id || ot.id, 
        numero_ot: otActualizada?.numero_ot || ot.numero_ot, 
        estado: nuevoEstado,
        vehiculo: otActualizada?.vehiculo ? {
          id: otActualizada.vehiculo.id,
          estado: otActualizada.vehiculo.estado,
          patente: otActualizada.vehiculo.patente,
        } : undefined
      };
    });
    this.events.emitReceptionRefresh();
    this.events.emitVehiculoRefresh(ot.vehiculo?.id);
    return updated;
  }

  // Lista mecánicos "disponibles" (regla simple: rol MECANICO y sin OT activa en PROCESO)
  async findAvailableMechanics() {
    const rows = await this.userRepo.query('SELECT * FROM mecanicos_disponibles');
    return rows.map((row: any) => ({
      id: row.id,
      nombre: row.nombre_completo,
      email: row.email,
      horario: {
        lunes: row.lunes_activo ? { inicio: row.lunes_hora_inicio, salida: row.lunes_hora_salida } : null,
        martes: row.martes_activo ? { inicio: row.martes_hora_inicio, salida: row.martes_hora_salida } : null,
        miercoles: row.miercoles_activo ? { inicio: row.miercoles_hora_inicio, salida: row.miercoles_hora_salida } : null,
        jueves: row.jueves_activo ? { inicio: row.jueves_hora_inicio, salida: row.jueves_hora_salida } : null,
        viernes: row.viernes_activo ? { inicio: row.viernes_hora_inicio, salida: row.viernes_hora_salida } : null,
        colaciones: {
          lunes: row.lunes_activo ? { inicio: row.lunes_colacion_inicio, salida: row.lunes_colacion_salida } : null,
          martes: row.martes_activo ? { inicio: row.martes_colacion_inicio, salida: row.martes_colacion_salida } : null,
          miercoles: row.miercoles_activo ? { inicio: row.miercoles_colacion_inicio, salida: row.miercoles_colacion_salida } : null,
          jueves: row.jueves_activo ? { inicio: row.jueves_colacion_inicio, salida: row.jueves_colacion_salida } : null,
          viernes: row.viernes_activo ? { inicio: row.viernes_colacion_inicio, salida: row.viernes_colacion_salida } : null,
        },
      },
    }));
  }

  // Vehículos "ingresados" para crear OT (ajusta la condición según tu regla)
  async findVehiclesIngresados() {
    const qb = this.vehRepo.createQueryBuilder('v')
      .where("v.estado IN ('PENDIENTE','PROGRAMADO','EN_TALLER','EN_PROCESO')")
      .orderBy('v.patente', 'ASC');
    const list = await qb.getMany();
    return list.map(v => ({ id: v.id, patente: v.patente, modelo: v.modelo ?? null }));
  }

  private async resolveTallerForVehicle(vehiculoId: number): Promise<Shop | null> {
    const last = await this.otRepo.createQueryBuilder('ot')
      .leftJoinAndSelect('ot.taller', 't')
      .where('ot.vehiculo_id = :id', { id: vehiculoId })
      .orderBy('ot.id', 'DESC')
      .getOne();

    if (last?.taller) return last.taller;

    // Por predeterminado: primer taller disponible (evita null)
    const any = await this.shopRepo.createQueryBuilder('t').orderBy('t.id', 'ASC').getOne();
    return any ?? null;
  }

  // Listar órdenes de trabajo con filtros opcionales y paginación
  async findAll(filters?: { 
    mecanicoId?: number; 
    page?: number; 
    limit?: number;
    search?: string;
    estado?: string;
    fechaDesde?: Date | string;
    fechaHasta?: Date | string;
    vehiculoPatente?: string;
    chofer?: string;
  }) {
    const qb = this.otRepo
      .createQueryBuilder('ot')
      .leftJoinAndSelect('ot.vehiculo', 'vehiculo')
      .leftJoinAndSelect('ot.mecanico', 'mecanico')
      .leftJoinAndSelect('ot.solicitud', 'solicitud')
      .leftJoinAndSelect('solicitud.conductor', 'conductor')
      .leftJoinAndSelect('ot.taller', 'taller')
      .leftJoinAndSelect('ot.jefe_taller', 'jefe')
      .where('ot.estado <> :cancelada', { cancelada: 'CANCELADA' });
    
    // Ordenar por fecha_ingreso_recepcion DESC primero (OTs más recientes primero)
    // y luego por fecha_creacion DESC como fallback
    if (filters?.mecanicoId) {
      // Para mecánicos, ordenar por fecha_ingreso_recepcion (más relevante)
      qb.orderBy('ot.fecha_ingreso_recepcion', 'DESC')
        .addOrderBy('ot.fecha_creacion', 'DESC');
    } else {
      // Para otros usuarios, ordenar por fecha_creacion
      qb.orderBy('ot.fecha_creacion', 'DESC');
    }

    if (filters?.mecanicoId) {
      qb.andWhere('ot.mecanico_asignado_id = :mecanicoId', { mecanicoId: filters.mecanicoId });
      // El mecánico solo ve OTs donde el recepcionista ya confirmó la llegada
      qb.andWhere('ot.fecha_ingreso_recepcion IS NOT NULL');
      // Excluir OTs en PENDIENTE_VERIFICACION (estas van a "Mis Tareas")
      qb.andWhere('ot.estado <> :pendienteVerificacion', { pendienteVerificacion: 'PENDIENTE_VERIFICACION' });
    }

    // Filtro por estado
    if (filters?.estado) {
      qb.andWhere('ot.estado = :estado', { estado: filters.estado });
    }

    // Filtro por patente de vehículo
    if (filters?.vehiculoPatente) {
      qb.andWhere('vehiculo.patente ILIKE :patente', { patente: `%${filters.vehiculoPatente}%` });
    }

    // Filtro por chofer (conductor)
    if (filters?.chofer) {
      qb.andWhere('conductor.nombre_completo ILIKE :chofer', { chofer: `%${filters.chofer}%` });
    }

    // Filtro por rango de fechas (fecha de creación)
    if (filters?.fechaDesde) {
      const fechaDesde = filters.fechaDesde instanceof Date ? filters.fechaDesde : new Date(filters.fechaDesde);
      qb.andWhere('ot.fecha_creacion >= :fechaDesde', { fechaDesde });
    }
    if (filters?.fechaHasta) {
      const fechaHasta = filters.fechaHasta instanceof Date ? filters.fechaHasta : new Date(filters.fechaHasta);
      // Agregar un día completo para incluir todo el día
      fechaHasta.setHours(23, 59, 59, 999);
      qb.andWhere('ot.fecha_creacion <= :fechaHasta', { fechaHasta });
    }

    // Búsqueda por texto (número OT, patente, nombre mecánico)
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      qb.andWhere(
        '(CAST(ot.numero_ot AS TEXT) ILIKE :search OR vehiculo.patente ILIKE :search OR mecanico.nombre_completo ILIKE :search)',
        { search: searchTerm }
      );
    }

    // Si se solicita paginación, aplicarla
    if (filters?.page !== undefined && filters?.limit !== undefined) {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const skip = (page - 1) * limit;

      // Contar total antes de aplicar paginación
      const total = await qb.getCount();

      // Aplicar paginación
      qb.skip(skip).take(limit);

      const list = await qb.getMany();
      await Promise.all(
        list.map(async (ot) => {
          // Solo hidratar evidencias de solicitud para la lista (información básica)
          // Las evidencias de diagnóstico y cierre se procesan solo en findOne() para mejor performance
          await this.hydrateSolicitudEvidencias(ot.solicitud);
          if (ot.vehiculo?.id) {
            const vehiculoActualizado = await this.ds.query(
              `SELECT estado FROM vehiculos WHERE id = $1`,
              [ot.vehiculo.id]
            );
            if (vehiculoActualizado && vehiculoActualizado.length > 0) {
              ot.vehiculo.estado = vehiculoActualizado[0].estado;
            }
          }
        }),
      );

      return {
        data: list,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Sin paginación: comportamiento original (compatibilidad hacia atrás)
    const list = await qb.getMany();
    await Promise.all(
      list.map(async (ot) => {
        await this.hydrateSolicitudEvidencias(ot.solicitud);
        if (ot.vehiculo?.id) {
          const vehiculoActualizado = await this.ds.query(
            `SELECT estado FROM vehiculos WHERE id = $1`,
            [ot.vehiculo.id]
          );
          if (vehiculoActualizado && vehiculoActualizado.length > 0) {
            ot.vehiculo.estado = vehiculoActualizado[0].estado;
          }
        }
      }),
    );
    return list;
  }

  async findOne(id: number) {
    const ot = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'mecanico', 'taller', 'jefe_taller', 'solicitud', 'solicitud.conductor'],
    });
    if (!ot) throw new NotFoundException('Orden no encontrada');
    await this.hydrateSolicitudEvidencias(ot.solicitud);
    await this.hydrateDiagnosticEvidences(ot);
    await this.hydrateCierreEvidences(ot);
    return ot;
  }

  async updateWorkOrder(jefeId: number, id: number, dto: UpdateWorkOrderDto) {
    const ot = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'solicitud', 'solicitud.conductor', 'mecanico', 'taller'],
    });
    if (!ot) throw new NotFoundException('Orden no encontrada');
    if (!ot.vehiculo) throw new BadRequestException('Orden sin vehículo asociado');

    const cambios: string[] = [];

    if (dto.descripcion && dto.descripcion.trim() && dto.descripcion.trim() !== ot.descripcion_problema) {
      cambios.push('Descripción actualizada');
      ot.descripcion_problema = dto.descripcion.trim();
    }

    if (dto.prioridad && dto.prioridad !== ot.prioridad) {
      cambios.push(`Prioridad: ${ot.prioridad} → ${dto.prioridad}`);
      ot.prioridad = dto.prioridad as any;
      
      // Si la OT está en PENDIENTE_AUTORIZACION_SUPERVISOR y se baja la prioridad,
      // cambiar a LISTO (ya no requiere autorización)
      if ((dto.prioridad === 'BAJA' || dto.prioridad === 'NORMAL') && 
          ot.estado === 'PENDIENTE_AUTORIZACION_SUPERVISOR') {
        const estadoAnterior = ot.estado;
        ot.estado = 'LISTO';
        cambios.push(`Estado: ${estadoAnterior} → LISTO (prioridad reducida, ya no requiere autorización)`);
      }
    }

    // Guardar estado anterior antes de cambiarlo
    const estadoAnterior = ot.estado;
    
    if (dto.estado && dto.estado !== ot.estado) {
      cambios.push(`Estado: ${ot.estado} → ${dto.estado}`);
      ot.estado = dto.estado as any;
      
      if (dto.estado === 'PENDIENTE_AUTORIZACION_SUPERVISOR') {
        this.events.emitSolicitudesRefresh();
      }
    }

    if (dto.fechaInicioPlan) {
      const nueva = new Date(dto.fechaInicioPlan);
      if (isNaN(nueva.valueOf())) throw new BadRequestException('Fecha de inicio inválida');
      if (!ot.fecha_inicio_trabajo || nueva.getTime() !== ot.fecha_inicio_trabajo.getTime()) {
        cambios.push('Fecha inicio ajustada');
        ot.fecha_inicio_trabajo = nueva;
      }
    }

    if (dto.fechaEstimadaTermino) {
      const nueva = new Date(dto.fechaEstimadaTermino);
      if (isNaN(nueva.valueOf())) throw new BadRequestException('Fecha estimada inválida');
      if (!ot.fecha_estimada_termino || nueva.getTime() !== ot.fecha_estimada_termino.getTime()) {
        cambios.push('Fecha estimada ajustada');
        ot.fecha_estimada_termino = nueva;
      }
    }

    if (!cambios.length) {
      return ot;
    }

    const updatedOt = await this.ds.transaction(async (trx) => {
      await trx.getRepository(WorkOrder).save(ot);
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1,$2,$3,$4,$5)`,
        [ot.id, estadoAnterior || null, ot.estado, jefeId, 'Edición manual'],
      );

      const vehiculoId = ot.vehiculo?.id;
      if (vehiculoId) {
        const vehEstado = this.vehiculoEstadoDesdeOt(ot.estado);
        if (vehEstado) {
          await this.updateVehiculoEstado(vehiculoId, vehEstado);
        }
        await this.recordVehiculoEvento(vehiculoId, 'OT editada', cambios.join(' · '));
        this.events.emitVehiculoRefresh(vehiculoId);
      }

      return ot;
    });
    await this.hydrateSolicitudEvidencias(updatedOt.solicitud);
    await this.hydrateDiagnosticEvidences(updatedOt);
    
    // Verificar si cambió el estado (usamos el estadoAnterior guardado antes)
    const estadoCambio = dto.estado && dto.estado !== estadoAnterior ? dto.estado : null;
    
    // Emitir eventos para actualizar todos los dashboards
    this.events.emitReceptionRefresh();
    this.events.emitWorkOrdersRefresh();
    
    // Si cambió el estado, notificar a los usuarios relevantes
    if (estadoCambio) {
      const nuevoEstado = estadoCambio;
      
      // Notificar al mecánico si la OT le pertenece
      if (updatedOt.mecanico?.id) {
        await this.events.emitMechanicNotification(updatedOt.mecanico.id, {
          tipo: 'info',
          titulo: 'Estado de OT Actualizado',
          mensaje: `La OT ${updatedOt.numero_ot} cambió de estado a ${nuevoEstado}`,
          otId: updatedOt.id,
        });
      }
      
      // Notificar a recepcionistas según el estado
      // Estados que requieren atención del recepcionista: APROBADO, EN_PROCESO, LISTO, COMPLETADO
      if (['APROBADO', 'EN_PROCESO', 'LISTO', 'COMPLETADO'].includes(nuevoEstado)) {
        try {
          const recepcionistas = await this.userRepo
            .createQueryBuilder('u')
            .where('LOWER(u.rol) IN (:...roles)', { roles: ['recepcion', 'recepcionista'] })
            .andWhere('u.activo = true')
            .getMany();
          
          for (const recep of recepcionistas) {
            await this.events.emitRecepcionistaNotification(recep.id, {
              tipo: 'info',
              titulo: 'Estado de OT Actualizado',
              mensaje: `La OT ${updatedOt.numero_ot} cambió de estado a ${nuevoEstado}`,
              otId: updatedOt.id,
            });
          }
        } catch (err) {
          console.error('Error al notificar recepcionistas:', err);
        }
      }
    }
    
    return updatedOt;
  }

  async cancelWorkOrder(jefeId: number, id: number) {
    const ot = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'solicitud'],
    });
    if (!ot) throw new NotFoundException('Orden no encontrada');
    if (!ot.vehiculo) throw new BadRequestException('Orden sin vehículo asociado');

    if (ot.estado === 'CANCELADA') {
      return { id: ot.id };
    }

    await this.ds.transaction(async (trx) => {
      const prev = ot.estado;
      ot.estado = 'CANCELADA';
      ot.fecha_cierre = new Date();
      await trx.getRepository(WorkOrder).save(ot);
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1,$2,$3,$4,$5)`,
        [ot.id, prev, 'CANCELADA', jefeId, 'Cancelación manual'],
      );

      if (ot.solicitud) {
        ot.solicitud.estado = 'APROBADA';
        ot.solicitud.fecha_actualizacion = new Date();
        await trx.getRepository(SolicitudMantenimiento).save(ot.solicitud);
      }
    });

    const vehiculoId = ot.vehiculo.id;
    await this.updateVehiculoEstado(vehiculoId, 'OPERATIVO');
    await this.recordVehiculoEvento(vehiculoId, 'Reparación cancelada', `OT ${ot.numero_ot} cancelada el ${new Date().toISOString()}`);
    this.events.emitVehiculoRefresh(vehiculoId);
    if (ot.solicitud) {
      this.events.emitSolicitudesRefresh();
    }
    this.events.emitReceptionRefresh();
    return { id: ot.id };
  }

  async startDiagnostic(userId: number, id: number, dto: StartDiagnosticDto) {
    const ot = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'mecanico', 'solicitud'],
    });
    if (!ot) throw new NotFoundException('Orden no encontrada');
    if (!ot.mecanico || ot.mecanico.id !== userId) {
      throw new BadRequestException('Solo el mecánico asignado puede iniciar el diagnóstico.');
    }
    if (ot.estado && !['PENDIENTE', 'APROBADO', 'CITA_MANTENCION', 'EN_PROCESO'].includes(ot.estado)) {
      throw new BadRequestException('El diagnóstico solo puede iniciarse si la OT está Pendiente, Aprobada o En Proceso.');
    }

    const inicio = new Date(dto.fechaInicio);
    if (isNaN(inicio.getTime())) {
      throw new BadRequestException('Fecha de inicio inválida.');
    }

    let evidenciaKeys: string[] = [];
    if (dto.evidencias && dto.evidencias.length) {
      const prefix = `workorders/${id}/diagnostic`;
      const uploads = await Promise.all(
        dto.evidencias.slice(0, 5).map((img) => this.files.uploadBase64Image(img, { prefix })),
      );
      evidenciaKeys = uploads.map((item) => item.key);
    }

    const prevEstado = ot.estado;
    await this.ds.transaction(async (trx) => {
      ot.fecha_inicio_trabajo = inicio;
      ot.estado = 'EN_PROCESO';
      
      // Actualizar diagnóstico inicial si se proporciona
      if (dto.diagnosticoInicial !== undefined) {
        ot.diagnostico_inicial = dto.diagnosticoInicial || null;
      } else if (dto.notas !== undefined) {
        // Fallback: usar notas si diagnosticoInicial no se proporciona
        ot.diagnostico_inicial = dto.notas || null;
      }
      
      // Actualizar prioridad diagnosticada si se proporciona
      if (dto.prioridadDiagnosticada) {
        ot.prioridad_diagnosticada = dto.prioridadDiagnosticada as 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
      }
      
      // Actualizar discrepancia si se proporciona
      console.log('startDiagnostic: DTO recibido:', {
        discrepanciaDiagnostico: dto.discrepanciaDiagnostico,
        discrepanciaDiagnosticoDetalle: dto.discrepanciaDiagnosticoDetalle ? 'Presente' : 'Ausente',
        prioridadDiagnosticada: dto.prioridadDiagnosticada,
        diagnosticoInicial: dto.diagnosticoInicial ? 'Presente' : 'Ausente'
      });
      
      if (dto.discrepanciaDiagnostico !== undefined) {
        // El @Transform en el DTO ya convierte el valor a boolean
        // Solo necesitamos asegurarnos de que sea boolean
        const discrepanciaBool = dto.discrepanciaDiagnostico === true;
        console.log('startDiagnostic: Actualizando discrepancia_diagnostico:', {
          valorRecibido: dto.discrepanciaDiagnostico,
          tipo: typeof dto.discrepanciaDiagnostico,
          valorFinal: discrepanciaBool
        });
        ot.discrepancia_diagnostico = discrepanciaBool;
        if (discrepanciaBool && dto.discrepanciaDiagnosticoDetalle) {
          ot.discrepancia_diagnostico_detalle = dto.discrepanciaDiagnosticoDetalle;
          ot.discrepancia_diagnostico_fecha = new Date();
          // Cargar el usuario para la relación
          const user = await trx.getRepository(User).findOne({ where: { id: userId } });
          if (user) {
            ot.discrepancia_diagnostico_por = user;
          }
          console.log('startDiagnostic: Discrepancia guardada con detalle');
        } else if (!discrepanciaBool) {
          ot.discrepancia_diagnostico_detalle = null;
          ot.discrepancia_diagnostico_fecha = null;
          ot.discrepancia_diagnostico_por = null;
          console.log('startDiagnostic: Discrepancia limpiada (false)');
        }
      } else {
        console.log('startDiagnostic: discrepanciaDiagnostico es undefined, no se actualiza');
      }
      
      // Log después de guardar
      console.log('startDiagnostic: OT antes de guardar:', {
        id: ot.id,
        discrepancia_diagnostico: ot.discrepancia_diagnostico,
        discrepancia_diagnostico_detalle: ot.discrepancia_diagnostico_detalle ? 'Presente' : 'Ausente',
        prioridad_diagnosticada: ot.prioridad_diagnosticada
      });
      
      ot.diagnostico_checklist = dto.checklist || null;
      ot.diagnostico_evidencias = evidenciaKeys.length ? evidenciaKeys : ot.diagnostico_evidencias ?? null;
      
      // Log antes de guardar
      console.log('startDiagnostic: Guardando OT con:', {
        id: ot.id,
        discrepancia_diagnostico: ot.discrepancia_diagnostico,
        discrepancia_diagnostico_detalle: ot.discrepancia_diagnostico_detalle ? 'Presente' : 'Ausente',
        prioridad_diagnosticada: ot.prioridad_diagnosticada,
        diagnostico_inicial: ot.diagnostico_inicial ? 'Presente' : 'Ausente'
      });
      
      const otGuardada = await trx.getRepository(WorkOrder).save(ot);
      
      // Log después de guardar
      console.log('startDiagnostic: OT guardada con:', {
        id: otGuardada.id,
        discrepancia_diagnostico: otGuardada.discrepancia_diagnostico,
        discrepancia_diagnostico_detalle: otGuardada.discrepancia_diagnostico_detalle ? 'Presente' : 'Ausente',
        prioridad_diagnosticada: otGuardada.prioridad_diagnosticada
      });
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, prevEstado, 'EN_PROCESO', userId, 'Diagnóstico iniciado por mecánico'],
      );
    });

    // Recargar la OT con todas las relaciones para asegurar que los datos estén actualizados
    const otActualizada = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'mecanico', 'solicitud', 'jefe_taller'],
    });
    
    // Log de la OT recargada
    console.log('startDiagnostic: OT recargada después de guardar:', {
      id: otActualizada?.id,
      discrepancia_diagnostico: otActualizada?.discrepancia_diagnostico,
      discrepancia_diagnostico_detalle: otActualizada?.discrepancia_diagnostico_detalle ? 'Presente' : 'Ausente',
      discrepancia_diagnostico_aprobada: otActualizada?.discrepancia_diagnostico_aprobada,
      discrepancia_diagnostico_rechazada: otActualizada?.discrepancia_diagnostico_rechazada,
      prioridad_diagnosticada: otActualizada?.prioridad_diagnosticada
    });

    // Al iniciar el diagnóstico, el vehículo permanece en EN_TALLER (no cambia a MANTENCION)
    // El vehículo solo cambia a MANTENCION cuando el mecánico hace clic en "Iniciar trabajo"
    if (otActualizada && otActualizada.vehiculo) {
      // Solo actualizar a EN_TALLER si no está ya en ese estado o en MANTENCION
      const estadoActual = otActualizada.vehiculo.estado;
      if (estadoActual !== 'EN_TALLER' && estadoActual !== 'MANTENCION') {
        await this.updateVehiculoEstado(otActualizada.vehiculo.id, 'EN_TALLER');
      }
      await this.recordVehiculoEvento(
        otActualizada.vehiculo.id,
        'Diagnóstico iniciado',
        dto.notas || 'Diagnóstico inicial registrado.',
      );
      this.events.emitVehiculoRefresh(otActualizada.vehiculo.id);
    }
    this.events.emitReceptionRefresh();
    await this.hydrateSolicitudEvidencias(otActualizada?.solicitud);
    await this.hydrateDiagnosticEvidences(otActualizada);
    
    // Si hay discrepancia, emitir evento para refrescar solicitudes del jefe de taller
    // IMPORTANTE: Emitir después de que la transacción se complete y la OT esté guardada
    if (dto.discrepanciaDiagnostico) {
      console.log('Discrepancia detectada, emitiendo evento solicitud:refresh');
      console.log('OT actualizada con discrepancia:', {
        id: otActualizada?.id,
        numero_ot: otActualizada?.numero_ot,
        discrepancia_diagnostico: otActualizada?.discrepancia_diagnostico,
        discrepancia_diagnostico_aprobada: otActualizada?.discrepancia_diagnostico_aprobada,
        discrepancia_diagnostico_rechazada: otActualizada?.discrepancia_diagnostico_rechazada
      });
      // Emitir con un pequeño delay para asegurar que la base de datos esté actualizada
      setTimeout(() => {
        this.events.emitSolicitudesRefresh();
      }, 100);
    }
    
    // Notificar al chofer cuando se inicia el diagnóstico (OT pasa a EN_PROCESO)
    if (otActualizada?.solicitud?.conductor?.id && prevEstado !== 'EN_PROCESO') {
      await this.events.emitDriverNotification(otActualizada.solicitud.conductor.id, {
        tipo: 'info',
        titulo: '🔍 Diagnóstico Iniciado',
        mensaje: `El diagnóstico de la OT ${otActualizada.numero_ot} ha sido iniciado. El mecánico está evaluando tu vehículo ${otActualizada.vehiculo?.patente || ''}.`,
        otId: otActualizada.id,
      });
    }
    
    return otActualizada || ot;
  }

  async checkInWorkOrder(userId: number, id: number, dto: CheckInWorkOrderDto) {
    const ot = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'solicitud', 'mecanico'],
    });
    if (!ot) throw new NotFoundException('Orden no encontrada');
    if (ot.estado === 'CANCELADA') {
      throw new BadRequestException('La orden está cancelada.');
    }
    if (ot.fecha_ingreso_recepcion) {
      throw new BadRequestException('La recepción ya fue registrada.');
    }
    if (!ot.fecha_inicio_trabajo || !ot.fecha_estimada_termino) {
      throw new BadRequestException('La OT no tiene fechas planificadas.');
    }
    if (!dto.fechaLlegada) {
      throw new BadRequestException('La fecha de llegada es obligatoria.');
    }

    const llegada = new Date(dto.fechaLlegada);
    if (isNaN(llegada.getTime())) {
      throw new BadRequestException('Fecha de llegada inválida.');
    }

    const start = startOfDay(ot.fecha_inicio_trabajo);
    const end = endOfDay(ot.fecha_estimada_termino);
    if (llegada < start || llegada > end) {
      throw new BadRequestException('La llegada debe registrarse dentro del rango planificado de la OT.');
    }

    const recepcionista = await this.userRepo.findOne({ where: { id: userId } });
    const recepNombre = recepcionista?.nombre_completo || recepcionista?.email || `Usuario #${userId}`;

    let evidenciaUrls: string[] = [];
    if (dto.evidencias && dto.evidencias.length) {
      try {
        const subset = dto.evidencias.slice(0, 3);
        const uploads = await Promise.all(
          subset.map((img) => this.files.uploadBase64Image(img, { prefix: `workorders/${id}/checkin` })),
        );
        evidenciaUrls = uploads.map((item) => item.url);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('No se pudieron subir evidencias del check-in', reason);
      }
    }

    const prevEstado = ot.estado;

    await this.ds.transaction(async (trx) => {
      ot.fecha_ingreso_recepcion = llegada;
      ot.estado = 'EN_PROCESO'; // Cambiar a EN_PROCESO cuando el recepcionista confirma la llegada
      // Establecer fecha_inicio_trabajo cuando el vehículo realmente llega al taller
      if (!ot.fecha_inicio_trabajo) {
        ot.fecha_inicio_trabajo = llegada;
      }
      await trx.getRepository(WorkOrder).save(ot);
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1,$2,$3,$4,$5)`,
        [ot.id, prevEstado, ot.estado, userId, 'Vehículo recibido en recepción - Listo para mecánico'],
      );

      // Crear registro de entrega de vehículo (ENTRADA)
      try {
        // Obtener el conductor del vehículo
        let conductorId = ot.vehiculo?.conductor_actual_id || ot.solicitud?.conductor?.id;
        
        // Si no se encontró el conductor en las relaciones cargadas, intentar obtenerlo directamente de la BD
        if (!conductorId && ot.vehiculo?.id) {
          const vehiculoConductor = await trx.query(
            `SELECT conductor_actual_id FROM vehiculos WHERE id = $1`,
            [ot.vehiculo.id]
          );
          if (vehiculoConductor?.[0]?.conductor_actual_id) {
            conductorId = vehiculoConductor[0].conductor_actual_id;
          }
        }
        
        // Si aún no se encontró, intentar obtenerlo de la solicitud
        if (!conductorId && ot.solicitud?.id) {
          const solicitudConductor = await trx.query(
            `SELECT conductor_id FROM solicitudes_mantenimiento WHERE id = $1`,
            [ot.solicitud.id]
          );
          if (solicitudConductor?.[0]?.conductor_id) {
            conductorId = solicitudConductor[0].conductor_id;
          }
        }
        
        if (conductorId) {
          // Usar observaciones del recepcionista (recep_checkin_notes) para el campo observaciones
          // Si está vacío, dejarlo como null
          const observaciones = dto.observaciones && dto.observaciones.trim() 
            ? dto.observaciones.trim() 
            : null;
          
          await trx.query(
            `INSERT INTO entregas_vehiculos (
              orden_trabajo_id, tipo_entrega, conductor_id, responsable_taller_id,
              condicion_vehiculo, observaciones, fecha_firma, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              ot.id,
              'ENTRADA',
              conductorId,
              userId,
              null, // condicion_vehiculo es null para ENTRADA
              observaciones // observaciones del recepcionista
            ]
          );
          console.log('✅ Registro de entrega ENTRADA creado para OT:', ot.id);
        } else {
          console.warn('⚠️ No se pudo crear registro de entrega ENTRADA: conductorId faltante para OT:', ot.id);
        }
      } catch (err) {
        console.error('❌ Error al crear registro de entrega ENTRADA:', err);
        // No lanzar error para no interrumpir el proceso de check-in
      }
    });

    // Recargar OT con relaciones para notificaciones
    const otActualizada = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'solicitud', 'mecanico', 'solicitud.conductor'],
    });

    if (otActualizada?.vehiculo) {
      await this.updateVehiculoEstado(otActualizada.vehiculo.id, 'EN_TALLER');
      const checklistParts: string[] = [];
      if (dto.checklist?.permisoCirculacion) checklistParts.push('Permiso de circulación ✓');
      if (dto.checklist?.seguroVigente) checklistParts.push('Seguro SOAP ✓');
      const detalleEvento = [
        `Recepcionista: ${recepNombre}`,
        `Llegada real: ${llegada.toLocaleString('es-CL')}`,
        checklistParts.length ? `Documentos: ${checklistParts.join(', ')}` : 'Documentos pendientes',
        dto.checklistCompleto ? 'Checklist general OK' : undefined,
        dto.observaciones ? `Obs: ${dto.observaciones}` : undefined,
        evidenciaUrls.length ? `Fotos: ${evidenciaUrls.join(', ')}` : undefined,
      ]
        .filter(Boolean)
        .join(' | ');

      await this.recordVehiculoEvento(otActualizada.vehiculo.id, 'Vehículo recibido en recepción', detalleEvento);
      this.events.emitVehiculoRefresh(otActualizada.vehiculo.id);
    }

    this.events.emitReceptionRefresh();
    this.events.emitWorkOrdersRefresh();
    
    // Notificar al chofer cuando el vehículo llega al taller (check-in)
    if (otActualizada?.solicitud?.conductor?.id && prevEstado !== 'EN_PROCESO') {
      await this.events.emitDriverNotification(otActualizada.solicitud.conductor.id, {
        tipo: 'info',
        titulo: '🚗 Vehículo Recibido en Taller',
        mensaje: `Tu vehículo ${otActualizada.vehiculo?.patente || ''} ha sido recibido en el taller. La OT ${otActualizada.numero_ot} está en proceso.`,
        otId: otActualizada.id,
      });
    }
    
    return { id: otActualizada?.id || ot.id, fecha_ingreso_recepcion: ot.fecha_ingreso_recepcion, estado: ot.estado };
  }

  async resolveDiscrepancy(jefeId: number, id: number, dto: ResolveDiscrepancyDto) {
    const ot = await this.otRepo.findOne({
      where: { id },
      relations: ['vehiculo', 'mecanico', 'solicitud', 'jefe_taller'],
    });
    if (!ot) throw new NotFoundException('Orden no encontrada');
    if (!ot.discrepancia_diagnostico) {
      throw new BadRequestException('Esta OT no tiene discrepancia pendiente de resolución.');
    }
    if (ot.discrepancia_diagnostico_aprobada || ot.discrepancia_diagnostico_rechazada) {
      throw new BadRequestException('Esta discrepancia ya fue resuelta.');
    }

    const jefe = await this.userRepo.findOne({ where: { id: jefeId } });
    if (!jefe) throw new NotFoundException('Jefe de taller no encontrado');

    await this.ds.transaction(async (trx) => {
      if (dto.aprobar) {
        ot.discrepancia_diagnostico_aprobada = true;
        ot.discrepancia_diagnostico_aprobada_detalle = dto.detalle || null;
        ot.discrepancia_diagnostico_aprobada_fecha = new Date();
        ot.discrepancia_diagnostico_aprobada_por = jefe;
        // Si se aprueba, reemplazar la prioridad con la prioridad diagnosticada
        if (ot.prioridad_diagnosticada) {
          ot.prioridad = ot.prioridad_diagnosticada;
        }
      } else {
        ot.discrepancia_diagnostico_rechazada = true;
        ot.discrepancia_diagnostico_rechazada_detalle = dto.detalle || null;
        ot.discrepancia_diagnostico_rechazada_fecha = new Date();
        ot.discrepancia_diagnostico_rechazada_por = jefe;
        // Si se rechaza, mantener la prioridad original (no hacer nada)
      }
      await trx.getRepository(WorkOrder).save(ot);
    });

    // Emitir evento para notificar al mecánico
    if (ot.mecanico) {
      this.events.emitMechanicNotification(ot.mecanico.id, {
        tipo: 'DISCREPANCIA_RESUELTA',
        titulo: dto.aprobar ? 'Discrepancia aprobada' : 'Discrepancia rechazada',
        mensaje: dto.aprobar
          ? `Tu discrepancia en la OT ${ot.numero_ot} fue aprobada. La prioridad ha sido actualizada.`
          : `Tu discrepancia en la OT ${ot.numero_ot} fue rechazada. Se mantiene la prioridad original.`,
        otId: ot.id,
      });
    }

    // Emitir eventos para refrescar dashboards
    console.log('Discrepancia resuelta, emitiendo eventos de refresh');
    this.events.emitSolicitudesRefresh(); // Para jefe de taller
    this.events.emitReceptionRefresh(); // Para recepcionista y mecánico
    return ot;
  }

  // Pausar trabajo del mecánico
  async pauseWork(mechanicId: number, otId: number) {
    const ot = await this.otRepo.findOne({ 
      where: { id: otId }, 
      relations: ['mecanico', 'vehiculo'] 
    });
    if (!ot) throw new NotFoundException('OT no existe');
    
    if (ot.mecanico?.id !== mechanicId) {
      throw new BadRequestException('No tienes permiso para pausar esta OT');
    }
    
    if (ot.estado !== 'EN_PROCESO') {
      throw new BadRequestException('Solo se puede pausar una OT en estado EN_PROCESO');
    }

    const now = new Date();
    const mes = now.getMonth() + 1; // getMonth() retorna 0-11
    const anno = now.getFullYear();

    // Guardar referencias antes de la transacción para TypeScript
    const vehiculoId = ot.vehiculo?.id;
    const mecanicoId = ot.mecanico?.id;
    const ordenTrabajoId = ot.id;

    const result = await this.ds.transaction(async (trx) => {
      // Actualizar estado del usuario a EN_BREAK
      await trx.query(
        `UPDATE usuarios SET estado_usuario = 'EN_BREAK', fecha_actualizacion = NOW() WHERE id = $1`,
        [mechanicId]
      );

      // Insertar break en breaks_mecanico
      await trx.query(
        `INSERT INTO breaks_mecanico (mecanico_id, hora_inicio, mes, anno) 
         VALUES ($1, NOW(), $2, $3)`,
        [mechanicId, mes, anno]
      );

      // Recargar el usuario para obtener el estado actualizado
      const usuarioActualizado = await trx.query(
        `SELECT id, estado_usuario FROM usuarios WHERE id = $1`,
        [mechanicId]
      );

      return { 
        success: true, 
        message: 'Trabajo pausado correctamente',
        estado_usuario: usuarioActualizado[0]?.estado_usuario || 'EN_BREAK'
      };
    });
    
    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    if (vehiculoId) {
      this.events.emitVehiculoRefresh(vehiculoId);
    }
    // Emitir evento específico para el mecánico para actualizar su dashboard
    if (mecanicoId) {
      this.events.emitMechanicNotification(mecanicoId, {
        tipo: 'info',
        titulo: 'Trabajo pausado',
        mensaje: 'El trabajo ha sido pausado correctamente.',
        otId: ordenTrabajoId,
      });
    }
    
    return result;
  }

  // Reanudar trabajo del mecánico
  async resumeWork(mechanicId: number, otId: number) {
    const ot = await this.otRepo.findOne({ 
      where: { id: otId }, 
      relations: ['mecanico', 'vehiculo'] 
    });
    if (!ot) throw new NotFoundException('OT no existe');
    
    if (ot.mecanico?.id !== mechanicId) {
      throw new BadRequestException('No tienes permiso para reanudar esta OT');
    }
    
    if (ot.estado !== 'EN_PROCESO') {
      throw new BadRequestException('Solo se puede reanudar una OT en estado EN_PROCESO');
    }

    // Guardar referencias antes de la transacción para TypeScript
    const vehiculoId = ot.vehiculo?.id;
    const mecanicoId = ot.mecanico?.id;
    const ordenTrabajoId = ot.id;

    const result = await this.ds.transaction(async (trx) => {
      // Actualizar estado del usuario a ACTIVO
      await trx.query(
        `UPDATE usuarios SET estado_usuario = 'ACTIVO', fecha_actualizacion = NOW() WHERE id = $1`,
        [mechanicId]
      );

      // Actualizar el break más reciente sin hora_termino
      await trx.query(
        `UPDATE breaks_mecanico 
         SET hora_termino = NOW(), fecha_actualizacion = NOW() 
         WHERE id = (
           SELECT id FROM breaks_mecanico 
           WHERE mecanico_id = $1 AND hora_termino IS NULL 
           ORDER BY hora_inicio DESC LIMIT 1
         )`,
        [mechanicId]
      );

      // Recargar el usuario para obtener el estado actualizado
      const usuarioActualizado = await trx.query(
        `SELECT id, estado_usuario FROM usuarios WHERE id = $1`,
        [mechanicId]
      );

      return { 
        success: true, 
        message: 'Trabajo reanudado correctamente',
        estado_usuario: usuarioActualizado[0]?.estado_usuario || 'ACTIVO'
      };
    });
    
    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    if (vehiculoId) {
      this.events.emitVehiculoRefresh(vehiculoId);
    }
    // Emitir evento específico para el mecánico para actualizar su dashboard
    if (mecanicoId) {
      this.events.emitMechanicNotification(mecanicoId, {
        tipo: 'info',
        titulo: 'Trabajo reanudado',
        mensaje: 'El trabajo ha sido reanudado correctamente.',
        otId: ordenTrabajoId,
      });
    }
    
    return result;
  }

  // Cerrar trabajo del mecánico
  async closeWorkOrder(mechanicId: number, otId: number, dto: CloseWorkOrderDto) {
    const ot = await this.otRepo.findOne({ 
      where: { id: otId }, 
      relations: ['mecanico', 'vehiculo'] 
    });
    if (!ot) throw new NotFoundException('OT no existe');
    
    if (ot.mecanico?.id !== mechanicId) {
      throw new BadRequestException('No tienes permiso para cerrar esta OT');
    }
    
    // Solo se puede cerrar una OT que esté en proceso y con trabajo iniciado (vehículo en MANTENCION)
    const vehiculoEnMantencion = (ot.vehiculo?.estado || '').toUpperCase() === 'MANTENCION';
    if (!vehiculoEnMantencion) {
      throw new BadRequestException('Solo se puede cerrar una OT con trabajo iniciado');
    }

    if (ot.estado !== 'EN_PROCESO') {
      throw new BadRequestException('Solo se puede cerrar una OT en estado EN_PROCESO');
    }

    // Guardar referencias antes de la transacción
    const vehiculoId = ot.vehiculo?.id;
    const ordenTrabajoId = ot.id;

    // Subir evidencias si se proporcionan
    let evidenciaKeys: string[] = [];
    if (dto.evidencias && dto.evidencias.length) {
      const prefix = `workorders/${otId}/cierre`;
      const uploads = await Promise.all(
        dto.evidencias.slice(0, 10).map((img) => this.files.uploadBase64Image(img, { prefix })),
      );
      evidenciaKeys = uploads.map((item) => item.key);
    }

    const prevEstado = ot.estado;

    await this.ds.transaction(async (trx) => {
      ot.descripcion_proceso_realizado = dto.descripcionProcesoRealizado;
      ot.cierre_evidencias = evidenciaKeys.length ? evidenciaKeys : null;
      ot.estado = 'PENDIENTE_VERIFICACION';
      ot.fecha_finalizacion = new Date();
      // Limpiar comentario de rechazo cuando se vuelve a cerrar
      ot.comentario_rechazo = null;
      
      await trx.getRepository(WorkOrder).save(ot);
      
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1, $2, $3, $4, $5)`,
        [otId, prevEstado, 'PENDIENTE_VERIFICACION', mechanicId, 'Trabajo finalizado por mecánico, pendiente de verificación'],
      );
    });

    // Actualizar estado del vehículo a LISTO o COMPLETADO (dependiendo del flujo)
    if (vehiculoId) {
      await this.updateVehiculoEstado(vehiculoId, 'EN_TALLER'); // Volver a EN_TALLER mientras espera verificación
      await this.recordVehiculoEvento(
        vehiculoId,
        'Trabajo finalizado',
        'Trabajo completado por mecánico, pendiente de verificación',
      );
    }

    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    this.events.emitVehiculoRefresh(vehiculoId);
    this.events.emitSolicitudesRefresh(); // Para jefe de taller
    
    // Notificar al mecánico
    if (ot.mecanico?.id) {
      this.events.emitMechanicNotification(ot.mecanico.id, {
        tipo: 'success',
        titulo: 'Trabajo finalizado',
        mensaje: 'El trabajo ha sido finalizado correctamente. Pendiente de verificación.',
        otId: ordenTrabajoId,
      });
    }

    // Notificar al jefe de taller
    if (ot.jefe_taller?.id) {
      this.events.emitJefeTallerNotification(ot.jefe_taller.id, {
        tipo: 'info',
        titulo: 'OT Pendiente de Verificación',
        mensaje: `La OT ${ot.numero_ot} ha sido finalizada por el mecánico y requiere tu verificación.`,
        otId: ordenTrabajoId,
      });
    }

    // Recargar la OT para devolverla actualizada
    const otActualizada = await this.otRepo.findOne({
      where: { id: otId },
      relations: ['vehiculo', 'mecanico', 'solicitud', 'jefe_taller'],
    });

    return otActualizada;
  }

  // Aprobar y firmar OT (Jefe de Taller)
  async approveWorkOrder(jefeId: number, otId: number, dto: ApproveWorkOrderDto) {
    const ot = await this.otRepo.findOne({ 
      where: { id: otId }, 
      relations: ['jefe_taller', 'vehiculo', 'mecanico'] 
    });
    if (!ot) throw new NotFoundException('OT no existe');
    
    if (ot.jefe_taller?.id !== jefeId) {
      throw new BadRequestException('No tienes permiso para aprobar esta OT');
    }
    
    if (ot.estado !== 'PENDIENTE_VERIFICACION') {
      throw new BadRequestException('Solo se pueden aprobar OTs en estado PENDIENTE_VERIFICACION');
    }

    // Validar contraseña del jefe de taller
    const jefe = await this.userRepo.findOne({ 
      where: { id: jefeId },
      select: ['id', 'hash_contrasena', 'email'] // Incluir hash_contrasena para validación
    });
    
    if (!jefe || !jefe.hash_contrasena) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const passwordValid = await bcrypt.compare(dto.password, jefe.hash_contrasena);
    if (!passwordValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    const prevEstado = ot.estado;
    const vehiculoId = ot.vehiculo?.id;

    await this.ds.transaction(async (trx) => {
      ot.estado = 'COMPLETADO';
      ot.fecha_aprobacion = new Date();
      ot.fecha_cierre = new Date();
      
      await trx.getRepository(WorkOrder).save(ot);
      
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1, $2, $3, $4, $5)`,
        [otId, prevEstado, 'COMPLETADO', jefeId, 'OT aprobada y firmada por jefe de taller'],
      );
    });

    // Actualizar estado del vehículo a COMPLETADO
    if (vehiculoId) {
      await this.updateVehiculoEstado(vehiculoId, 'COMPLETADO');
      await this.recordVehiculoEvento(
        vehiculoId,
        'OT Completada',
        'OT aprobada y firmada por jefe de taller',
      );
    }

    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    this.events.emitVehiculoRefresh(vehiculoId);
    this.events.emitSolicitudesRefresh();
    
    // Notificar al jefe de taller para actualizar verificaciones
    if (ot.jefe_taller?.id) {
      this.events.emitJefeTallerNotification(ot.jefe_taller.id, {
        tipo: 'info',
        titulo: 'OT Aprobada',
        mensaje: `La OT ${ot.numero_ot} ha sido aprobada y firmada`,
        otId: ot.id,
      });
    }
    
    // Notificar al mecánico
    if (ot.mecanico?.id) {
      this.events.emitMechanicNotification(ot.mecanico.id, {
        tipo: 'success',
        titulo: 'OT Aprobada',
        mensaje: `La OT ${ot.numero_ot} ha sido aprobada y firmada por el jefe de taller.`,
        otId: ot.id,
      });
    }
    
    // Notificar al chofer cuando la OT se completa
    if (ot.solicitud?.conductor?.id) {
      await this.events.emitDriverNotification(ot.solicitud.conductor.id, {
        tipo: 'success',
        titulo: '✅ Vehículo Listo',
        mensaje: `La OT ${ot.numero_ot} ha sido completada y aprobada. Tu vehículo ${ot.vehiculo?.patente || ''} está listo para retirar.`,
        otId: ot.id,
      });
    }
    
    // Notificar a recepcionistas cuando la OT se completa (listo para finalizar retiro)
    const recepcionistas = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.rol) IN (:...roles)', { roles: ['recepcion', 'recepcionista'] })
      .andWhere('u.activo = true')
      .getMany();
    
    for (const recep of recepcionistas) {
      await this.events.emitRecepcionistaNotification(recep.id, {
        tipo: 'success',
        titulo: '✅ OT Completada - Lista para Retiro',
        mensaje: `La OT ${ot.numero_ot} ha sido completada y aprobada. El vehículo ${ot.vehiculo?.patente || ''} está listo para finalizar el proceso de retiro.`,
        otId: ot.id,
      });
    }

    // Recargar la OT para devolverla actualizada
    const otActualizada = await this.otRepo.findOne({
      where: { id: otId },
      relations: ['vehiculo', 'mecanico', 'solicitud', 'jefe_taller'],
    });

    return otActualizada;
  }

  // Rechazar OT (Jefe de Taller)
  async rejectWorkOrder(jefeId: number, otId: number, dto: RejectWorkOrderDto) {
    const ot = await this.otRepo.findOne({ 
      where: { id: otId }, 
      relations: ['jefe_taller', 'vehiculo', 'mecanico'] 
    });
    if (!ot) throw new NotFoundException('OT no existe');
    
    if (ot.jefe_taller?.id !== jefeId) {
      throw new BadRequestException('No tienes permiso para rechazar esta OT');
    }
    
    if (ot.estado !== 'PENDIENTE_VERIFICACION') {
      throw new BadRequestException('Solo se pueden rechazar OTs en estado PENDIENTE_VERIFICACION');
    }

    const prevEstado = ot.estado;
    const vehiculoId = ot.vehiculo?.id;

    await this.ds.transaction(async (trx) => {
      // Cambiar estado de vuelta a EN_PROCESO para que el mecánico pueda volver a cerrar
      ot.estado = 'EN_PROCESO';
      ot.comentario_rechazo = dto.comentario;
      // Limpiar descripción del proceso realizado para que el mecánico pueda volver a cerrar
      ot.descripcion_proceso_realizado = null;
      ot.cierre_evidencias = null;
      ot.fecha_finalizacion = null;
      
      await trx.getRepository(WorkOrder).save(ot);
      
      await trx.query(
        `INSERT INTO log_estados_ot (orden_trabajo_id, estado_anterior, estado_nuevo, cambiado_por, motivo_cambio)
         VALUES ($1, $2, $3, $4, $5)`,
        [otId, prevEstado, 'EN_PROCESO', jefeId, 'OT rechazada por jefe de taller: ' + dto.comentario],
      );
    });

    // Actualizar estado del vehículo de vuelta a MANTENCION para que el mecánico pueda continuar
    if (vehiculoId) {
      await this.updateVehiculoEstado(vehiculoId, 'MANTENCION');
      await this.recordVehiculoEvento(
        vehiculoId,
        'Trabajo rechazado',
        'El trabajo fue rechazado por el jefe de taller. Requiere corrección.',
      );
    }

    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    this.events.emitVehiculoRefresh(vehiculoId);
    this.events.emitSolicitudesRefresh();
    this.events.emitWorkOrdersRefresh();
    
    // Notificar al mecánico
    if (ot.mecanico?.id) {
      this.events.emitMechanicNotification(ot.mecanico.id, {
        tipo: 'error',
        titulo: 'OT Rechazada',
        mensaje: `La OT ${ot.numero_ot} ha sido rechazada por el jefe de taller. Comentario: ${dto.comentario}. Por favor, corrige el trabajo y vuelve a cerrar la OT.`,
        otId: ot.id,
      });
    }

    // Recargar la OT para devolverla actualizada
    const otActualizada = await this.otRepo.findOne({
      where: { id: otId },
      relations: ['vehiculo', 'mecanico', 'solicitud', 'jefe_taller'],
    });

    return otActualizada;
  }

  // Finalizar proceso de retiro (Recepcionista)
  async finalizeRetiro(recepcionistaId: number, otId: number, dto: FinalizeRetiroDto) {
    const ot = await this.otRepo.findOne({ 
      where: { id: otId }, 
      relations: ['vehiculo', 'mecanico', 'jefe_taller', 'solicitud', 'solicitud.conductor'] 
    });
    if (!ot) throw new NotFoundException('OT no existe');
    
    if (!ot.vehiculo) {
      throw new BadRequestException('OT sin vehículo asociado');
    }

    // Verificar que el vehículo esté en estado COMPLETADO
    if (ot.vehiculo.estado !== 'COMPLETADO') {
      throw new BadRequestException('Solo se pueden finalizar retiros de vehículos en estado COMPLETADO');
    }

    // Validar contraseña del recepcionista
    const recepcionista = await this.userRepo.findOne({ 
      where: { id: recepcionistaId },
      select: ['id', 'hash_contrasena', 'email', 'rol']
    });
    
    if (!recepcionista || !recepcionista.hash_contrasena) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que el usuario sea recepcionista
    const rolNormalizado = (recepcionista.rol || '').toUpperCase();
    if (rolNormalizado !== 'RECEPCIONISTA' && rolNormalizado !== 'RECEPCION') {
      throw new BadRequestException('Solo los recepcionistas pueden finalizar retiros');
    }

    const passwordValid = await bcrypt.compare(dto.password, recepcionista.hash_contrasena);
    if (!passwordValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    const vehiculoId = ot.vehiculo.id;

    // Subir evidencias si se proporcionan
    let evidenciaKeys: string[] = [];
    if (dto.evidencias && dto.evidencias.length) {
      const prefix = `workorders/${otId}/retiro`;
      const uploads = await Promise.all(
        dto.evidencias.slice(0, 10).map((img) => this.files.uploadBase64Image(img, { prefix })),
      );
      evidenciaKeys = uploads.map((item) => item.key);
    }

    // Actualizar estado del vehículo a LISTO_PARA_RETIRO
    try {
      await this.updateVehiculoEstado(vehiculoId, 'LISTO_PARA_RETIRO');
    } catch (err) {
      console.error('Error al actualizar estado del vehículo:', err);
      throw new BadRequestException(`No se pudo actualizar el estado del vehículo: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    await this.recordVehiculoEvento(
      vehiculoId,
      'Listo para Retiro',
      dto.observaciones || 'Vehículo listo para retiro por chofer. ' + (evidenciaKeys.length ? `Evidencias adjuntadas: ${evidenciaKeys.length}` : ''),
    );

    // Verificar que el estado se actualizó correctamente usando SQL directo
    try {
      const vehiculoVerificado = await this.ds.query(
        `SELECT estado FROM vehiculos WHERE id = $1`,
        [vehiculoId]
      );
      console.log('Estado del vehículo después de finalizar retiro:', vehiculoVerificado?.[0]?.estado);
    } catch (err) {
      console.warn('No se pudo verificar el estado del vehículo:', err);
    }

    // Crear registro de entrega de vehículo (SALIDA)
    try {
      // Obtener el conductor del vehículo
      // Priorizar conductor_actual_id del vehículo, luego el conductor de la solicitud
      let conductorId = ot.vehiculo?.conductor_actual_id || ot.solicitud?.conductor?.id;
      
      // Si no se encontró el conductor en las relaciones cargadas, intentar obtenerlo directamente de la BD
      if (!conductorId && ot.vehiculo?.id) {
        const vehiculoConductor = await this.ds.query(
          `SELECT conductor_actual_id FROM vehiculos WHERE id = $1`,
          [ot.vehiculo.id]
        );
        if (vehiculoConductor?.[0]?.conductor_actual_id) {
          conductorId = vehiculoConductor[0].conductor_actual_id;
        }
      }
      
      // Si aún no se encontró, intentar obtenerlo de la solicitud
      if (!conductorId && ot.solicitud?.id) {
        const solicitudConductor = await this.ds.query(
          `SELECT conductor_id FROM solicitudes_mantenimiento WHERE id = $1`,
          [ot.solicitud.id]
        );
        if (solicitudConductor?.[0]?.conductor_id) {
          conductorId = solicitudConductor[0].conductor_id;
        }
      }
      
      if (!conductorId) {
        console.error('No se pudo crear registro de entrega: conductorId faltante', {
          vehiculoId: ot.vehiculo?.id,
          vehiculoConductorId: ot.vehiculo?.conductor_actual_id,
          solicitudConductorId: ot.solicitud?.conductor?.id,
          solicitudId: ot.solicitud?.id,
          otId
        });
        // Lanzar error para que se sepa que hay un problema
        throw new BadRequestException('No se pudo determinar el conductor del vehículo. No se puede crear el registro de entrega.');
      }
      
      // condicion_vehiculo se rellenará cuando el chofer confirme el retiro con sus observaciones
      // Por ahora se deja como null ya que el chofer aún no ha confirmado
      const condicionVehiculo = null;
      
      // Observaciones del recepcionista: usar dto.observaciones si está presente, sino null
      const observaciones = dto.observaciones && dto.observaciones.trim() 
        ? dto.observaciones.trim() 
        : null;
      
      await this.ds.query(
        `INSERT INTO entregas_vehiculos (
          orden_trabajo_id, tipo_entrega, conductor_id, responsable_taller_id,
          condicion_vehiculo, observaciones, fecha_firma, fecha_creacion
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          otId,
          'SALIDA',
          conductorId,
          recepcionistaId,
          condicionVehiculo, // null hasta que el chofer confirme
          observaciones // observaciones del recepcionista
        ]
      );
      console.log('✅ Registro de entrega creado para OT:', otId, {
        orden_trabajo_id: otId,
        tipo_entrega: 'SALIDA',
        conductor_id: conductorId,
        responsable_taller_id: recepcionistaId,
        condicion_vehiculo: condicionVehiculo
      });
    } catch (err) {
      console.error('❌ Error al crear registro de entrega:', err);
      // Lanzar el error para que se sepa que hay un problema
      // Pero solo si no es un BadRequestException (ya lanzada arriba)
      if (!(err instanceof BadRequestException)) {
        throw new BadRequestException(`Error al crear registro de entrega: ${err instanceof Error ? err.message : String(err)}`);
      }
      throw err;
    }

    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    this.events.emitVehiculoRefresh(vehiculoId);

    return { 
      success: true, 
      message: 'Proceso de retiro finalizado correctamente',
      vehiculoId 
    };
  }

  // Confirmar retiro (Chofer)
  async confirmRetiro(choferId: number, vehiculoId: number, dto: ConfirmRetiroDto) {
    const vehiculo = await this.vehRepo.findOne({ 
      where: { id: vehiculoId }
    });
    
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');

    // Verificar que el vehículo esté en estado LISTO_PARA_RETIRO o COMPLETADO
    // (COMPLETADO puede ocurrir si el recepcionista no finalizó el retiro correctamente)
    const estadoActual = vehiculo.estado;
    if (estadoActual !== 'LISTO_PARA_RETIRO' && estadoActual !== 'COMPLETADO') {
      throw new BadRequestException(`El vehículo no está listo para retiro. Estado actual: ${estadoActual}`);
    }
    
    console.log(`Confirmando retiro del vehículo ${vehiculoId}. Estado actual: ${estadoActual}`);

    // Verificar que el chofer sea el conductor actual usando conductor_actual_id
    if (vehiculo.conductor_actual_id !== choferId) {
      throw new BadRequestException('No tienes permiso para retirar este vehículo');
    }

    if (!dto.vehiculoOperativo) {
      throw new BadRequestException('Debes confirmar que el vehículo está operativo para proceder con el retiro');
    }

    // Actualizar estado del vehículo a OPERATIVO
    try {
      await this.updateVehiculoEstado(vehiculoId, 'OPERATIVO');
    } catch (err) {
      console.error('Error al actualizar estado del vehículo a OPERATIVO:', err);
      throw new BadRequestException(`No se pudo actualizar el estado del vehículo: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    await this.recordVehiculoEvento(
      vehiculoId,
      'Vehículo Retirado',
      (dto.observaciones || 'Vehículo retirado por chofer y confirmado como operativo.'),
    );

    // Verificar que el estado se actualizó correctamente usando SQL directo
    try {
      const vehiculoVerificado = await this.ds.query(
        `SELECT estado FROM vehiculos WHERE id = $1`,
        [vehiculoId]
      );
      console.log('Estado del vehículo después de confirmar retiro:', vehiculoVerificado?.[0]?.estado);
      if (vehiculoVerificado?.[0]?.estado !== 'OPERATIVO') {
        console.error('El estado del vehículo no se actualizó correctamente. Estado actual:', vehiculoVerificado?.[0]?.estado);
      }
    } catch (err) {
      console.warn('No se pudo verificar el estado del vehículo después de confirmar retiro:', err);
    }

    // Buscar la OT asociada para actualizar su estado si es necesario
    const ot = await this.otRepo.findOne({
      where: { vehiculo: { id: vehiculoId } },
      order: { fecha_creacion: 'DESC' },
    });

    // Actualizar entrega_vehiculo SALIDA con las observaciones del chofer en condicion_vehiculo
    if (ot?.id) {
      try {
        // Buscar la entrega_vehiculo SALIDA más reciente para esta OT
        const entregaSALIDA = await this.ds.query(
          `SELECT id FROM entregas_vehiculos 
           WHERE orden_trabajo_id = $1 
             AND tipo_entrega = 'SALIDA' 
             AND conductor_id = $2
           ORDER BY fecha_creacion DESC 
           LIMIT 1`,
          [ot.id, choferId]
        );

        if (entregaSALIDA && entregaSALIDA.length > 0) {
          const entregaId = entregaSALIDA[0].id;
          // Usar retiro_observaciones (dto.observaciones) del chofer para condicion_vehiculo
          // Si está vacío, dejarlo como null
          const condicionVehiculo = dto.observaciones && dto.observaciones.trim() 
            ? dto.observaciones.trim() 
            : null;

          await this.ds.query(
            `UPDATE entregas_vehiculos 
             SET condicion_vehiculo = $1 
             WHERE id = $2`,
            [condicionVehiculo, entregaId]
          );
          console.log('✅ Entrega_vehiculo SALIDA actualizada con condicion_vehiculo del chofer para entrega ID:', entregaId);
        } else {
          console.warn('⚠️ No se encontró entrega_vehiculo SALIDA para actualizar condicion_vehiculo. OT:', ot.id, 'Chofer:', choferId);
        }
      } catch (err) {
        console.error('❌ Error al actualizar condicion_vehiculo en entrega_vehiculo SALIDA:', err);
        // No lanzar error para no interrumpir el proceso de confirmación de retiro
      }
    }

    // Emitir eventos para refrescar dashboards
    this.events.emitReceptionRefresh();
    this.events.emitVehiculoRefresh(vehiculoId);
    if (ot) {
      this.events.emitSolicitudesRefresh();
    }

    return { 
      success: true, 
      message: 'Retiro confirmado correctamente. Vehículo operativo.',
      vehiculoId 
    };
  }
}
