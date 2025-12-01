import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SolicitudMantenimiento } from './entities/solicitud.entity';
import { Vehiculo } from '../vehicles/entities/vehicle.entity';
import { Usuario } from '../users/entities/user.entity';
import { WorkOrder } from '../workorders/entities/workorder.entity';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { CreateSolicitudInternalDto } from './dto/create-solicitud-internal.dto';
import { FilesService } from '../files/files.service';
import { EventsGateway } from '../events/events.gateway';
import { DebugLoggerService } from '../config/debug-logger.service';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudMantenimiento)
    private readonly repo: Repository<SolicitudMantenimiento>,
    @InjectRepository(Vehiculo)
    private readonly vehiculos: Repository<Vehiculo>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
    private readonly files: FilesService,
    private readonly events: EventsGateway,
    private readonly debugLogger: DebugLoggerService,
  ) {
    this.purgeDays = Number(process.env.SOLICITUD_TTL_DAYS || 3);
  }

  private readonly finalStatuses: Array<SolicitudMantenimiento['estado']> = [
    'APROBADA',
    'RECHAZADA',
    'CONVERTIDA_OT',
    'CITA_MANTENCION',
  ];

  private readonly estadosDisponiblesParaOT: Array<SolicitudMantenimiento['estado']> = [
    'APROBADA',
    'PENDIENTE',
    'CITA_MANTENCION',
  ];

  private readonly purgeDays: number;

  private readonly evidenciaFields: Array<
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

  private async hydrateEvidencias(sol: SolicitudMantenimiento | null) {
    if (!sol) return sol;
    await Promise.all(
      this.evidenciaFields.map(async (field) => {
        const value = sol[field] as string | null | undefined;
        if (!value) return;
        const signed = await this.files.ensureSignedUrl(value);
        (sol as any)[field] = signed;
      }),
    );
    return sol;
  }

  private async hydrateEvidenciasLista(lista: SolicitudMantenimiento[]) {
    return Promise.all(lista.map((sol) => this.hydrateEvidencias(sol)));
  }

  private async subirEvidencias(imagenes: string[], uploaderId: number, vehiculoId: number) {
    const prefix = `solicitudes/${vehiculoId}/${uploaderId}`;
    const uploads = await Promise.all(
      imagenes.map((img) => this.files.uploadBase64Image(img, { prefix })),
    );
    return uploads.map((u) => u.key);
  }

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const raw = await this.repo
      .createQueryBuilder('sol')
      .select("MAX(SPLIT_PART(sol.numero_solicitud, '-', 3))", 'maxseq')
      .where("SPLIT_PART(sol.numero_solicitud, '-', 2) = :year", { year: String(year) })
      .getRawOne<{ maxseq: string | null }>();
    const seq = (raw?.maxseq ? parseInt(raw.maxseq, 10) : 0) + 1;
    return `SOL-${year}-${String(seq).padStart(5, '0')}`;
    }

  async createFromDriver(driverId: number, dto: CreateSolicitudDto) {
    this.debugLogger.log('[SOLICITUDES SERVICE] ===== INICIO createFromDriver =====');
    this.debugLogger.log('[SOLICITUDES SERVICE] Driver ID recibido:', driverId);
    this.debugLogger.log('[SOLICITUDES SERVICE] DTO recibido:', {
      descripcion: dto.descripcion?.substring(0, 50) + '...',
      emergencia: dto.emergencia,
      numImagenes: dto.imagenes?.length || 0
    });
    
    if (!driverId) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ERROR: ID de chofer requerido');
      throw new BadRequestException('ID de chofer requerido');
    }

    const driver = await this.usuarios.findOne({ where: { id: driverId } });
    this.debugLogger.log('[SOLICITUDES SERVICE] Chofer encontrado:', {
      id: driver?.id,
      nombre: driver?.nombre_completo,
      email: driver?.email,
      rol: driver?.rol
    });
    
    if (!driver) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ERROR: Chofer no encontrado con ID:', driverId);
      throw new NotFoundException('Chofer no encontrado');
    }

    // Verificar TODOS los vehículos con ese conductor_actual_id para debugging
    const todosVehiculosConductor = await this.vehiculos.find({ 
      where: { conductor_actual_id: driverId } 
    });
    this.debugLogger.log('[SOLICITUDES SERVICE] 🔍 BÚSQUEDA DE VEHÍCULO:');
    this.debugLogger.log('[SOLICITUDES SERVICE] Total vehículos encontrados con conductor_actual_id =', driverId, ':', todosVehiculosConductor.length);
    todosVehiculosConductor.forEach((v, idx) => {
      this.debugLogger.log(`[SOLICITUDES SERVICE] Vehículo ${idx + 1}:`, {
        id: v.id,
        patente: v.patente,
        marca: v.marca,
        modelo: v.modelo,
        estado: v.estado,
        conductor_actual_id: v.conductor_actual_id
      });
    });
    
    const vehiculo = await this.vehiculos.findOne({ where: { conductor_actual_id: driverId } });
    this.debugLogger.log('[SOLICITUDES SERVICE] Vehículo seleccionado (findOne):', {
      id: vehiculo?.id,
      patente: vehiculo?.patente,
      marca: vehiculo?.marca,
      modelo: vehiculo?.modelo,
      estado: vehiculo?.estado,
      conductor_actual_id: vehiculo?.conductor_actual_id,
      vehiculoCompleto: vehiculo
    });
    
    // Validación crítica: verificar que el vehículo encontrado realmente pertenece al chofer
    if (vehiculo && vehiculo.conductor_actual_id !== driverId) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ⚠️⚠️⚠️ ERROR CRÍTICO: Vehículo encontrado NO corresponde al chofer!', {
        vehiculo_id: vehiculo.id,
        vehiculo_patente: vehiculo.patente,
        vehiculo_conductor_actual_id: vehiculo.conductor_actual_id,
        chofer_id_solicitado: driverId,
        chofer_nombre: driver.nombre_completo
      });
      throw new BadRequestException('El vehículo encontrado no corresponde al chofer autenticado');
    }
    
    if (!vehiculo) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ERROR: No hay vehículo asignado al chofer ID:', driverId);
      throw new BadRequestException('No tienes un vehículo asignado');
    }
    
    // No permitir crear una nueva solicitud si hay una pendiente, aprobada o en cita de mantención
    // Estados que bloquean: PENDIENTE, APROBADA, CITA_MANTENCION
    // Estados que NO bloquean: RECHAZADA, CONVERTIDA_OT (ya procesadas)
    // Solo buscar entre solicitudes visibles
    const solicitudExistente = await this.repo.findOne({
      where: {
        vehiculo: { id: vehiculo.id },
        estado: In(['PENDIENTE', 'APROBADA', 'CITA_MANTENCION']),
        visible: true
      },
      order: { fecha_creacion: 'DESC' }
    });
    
    if (solicitudExistente) {
      this.debugLogger.warn('[SOLICITUDES SERVICE] Ya existe una solicitud pendiente:', {
        solicitud_id: solicitudExistente.id,
        numero_solicitud: solicitudExistente.numero_solicitud,
        estado: solicitudExistente.estado,
        fecha_creacion: solicitudExistente.fecha_creacion
      });
      throw new BadRequestException(
        `Ya tienes una solicitud ${solicitudExistente.numero_solicitud} en estado ${solicitudExistente.estado}. ` +
        'Debes esperar a que sea procesada antes de crear una nueva solicitud.'
      );
    }
    
    // Verificar que el vehículo esté operativo antes de permitir crear una solicitud
    const estadoVehiculo = (vehiculo.estado || '').toUpperCase();
    if (estadoVehiculo !== 'OPERATIVO') {
      this.debugLogger.warn('[SOLICITUDES SERVICE] Vehículo no está operativo:', {
        vehiculo_id: vehiculo.id,
        estado: vehiculo.estado
      });
      throw new BadRequestException(
        `El vehículo debe estar operativo para crear una solicitud. Estado actual: ${vehiculo.estado}`
      );
    }
    
    // Verificación adicional: consulta SQL directa para asegurar que no hay problemas de caché
    const vehiculoVerificacion = await this.vehiculos.manager.query(
      'SELECT id, patente, marca, modelo, estado, conductor_actual_id FROM vehiculos WHERE conductor_actual_id = $1',
      [driverId]
    );
    this.debugLogger.log('[SOLICITUDES SERVICE] 🔍 Verificación SQL directa:', {
      query: 'SELECT ... WHERE conductor_actual_id = ' + driverId,
      resultados: vehiculoVerificacion,
      numResultados: vehiculoVerificacion.length
    });
    
    if (vehiculoVerificacion.length > 1) {
      this.debugLogger.warn('[SOLICITUDES SERVICE] ⚠️ ADVERTENCIA: Múltiples vehículos con el mismo conductor_actual_id!', {
        chofer_id: driverId,
        vehículos: vehiculoVerificacion
      });
    }
    
    if (vehiculoVerificacion.length > 0 && vehiculoVerificacion[0].id !== vehiculo.id) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ⚠️⚠️⚠️ ERROR CRÍTICO: Inconsistencia entre findOne y query SQL!', {
        findOne_id: vehiculo.id,
        findOne_patente: vehiculo.patente,
        sql_id: vehiculoVerificacion[0].id,
        sql_patente: vehiculoVerificacion[0].patente
      });
    }

    if (!dto.imagenes || dto.imagenes.length === 0) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ERROR: No hay imágenes adjuntas');
      throw new BadRequestException('Debes adjuntar al menos una imagen como evidencia');
    }

    const imagenes = dto.imagenes.slice(0, 5);
    const evidencias = await this.subirEvidencias(imagenes, driverId, vehiculo.id);
    const numero = await this.nextNumber();
    const emergencia = dto.emergencia === true;

    this.debugLogger.log('[SOLICITUDES SERVICE] Creando solicitud con datos:', {
      numero_solicitud: numero,
      vehiculo_id: vehiculo.id,
      vehiculo_patente: vehiculo.patente,
      vehiculo_marca: vehiculo.marca,
      vehiculo_modelo: vehiculo.modelo,
      vehiculo_conductor_actual_id: vehiculo.conductor_actual_id,
      conductor_id: driver.id,
      conductor_nombre: driver.nombre_completo,
      tipo_solicitud: emergencia ? 'EMERGENCIA' : 'REVISION',
      urgencia: emergencia ? 'ALTA' : 'NORMAL',
      estado: 'PENDIENTE',
      numEvidencias: evidencias.length,
      vehiculoObjetoCompleto: vehiculo
    });

    // Verificar una vez más que el vehículo es correcto antes de crear la solicitud
    if (vehiculo.conductor_actual_id !== driverId) {
      this.debugLogger.error('[SOLICITUDES SERVICE] ⚠️⚠️⚠️ ERROR CRÍTICO: Vehículo no corresponde al chofer antes de crear solicitud!', {
        vehiculo_id: vehiculo.id,
        vehiculo_patente: vehiculo.patente,
        vehiculo_conductor_actual_id: vehiculo.conductor_actual_id,
        chofer_id: driverId,
        chofer_nombre: driver.nombre_completo
      });
      throw new BadRequestException('El vehículo no corresponde al chofer autenticado');
    }

    const solicitud = this.repo.create({
      numero_solicitud: numero,
      vehiculo,
      conductor: driver,
      tipo_solicitud: emergencia ? 'EMERGENCIA' : 'REVISION',
      descripcion_problema: dto.descripcion,
      urgencia: emergencia ? 'ALTA' : 'NORMAL',
      estado: 'PENDIENTE',
      visible: true,
      evidencia_foto_principal: evidencias[0],
      evidencia_foto_adicional_1: evidencias[1] ?? null,
      evidencia_foto_adicional_2: evidencias[2] ?? null,
      evidencia_foto_adicional_3: evidencias[3] ?? null,
      evidencia_foto_adicional_4: evidencias[4] ?? null,
      fecha_actualizacion: new Date(),
    });

    this.debugLogger.log('[SOLICITUDES SERVICE] Solicitud creada (antes de guardar):', {
      numero_solicitud: solicitud.numero_solicitud,
      vehiculo_id: solicitud.vehiculo?.id,
      vehiculo_patente: solicitud.vehiculo?.patente,
      vehiculo_marca: solicitud.vehiculo?.marca,
      vehiculo_modelo: solicitud.vehiculo?.modelo,
      conductor_id: solicitud.conductor?.id,
      conductor_nombre: solicitud.conductor?.nombre_completo,
      vehiculoObjeto: solicitud.vehiculo,
      conductorObjeto: solicitud.conductor
    });

    const saved = await this.repo.save(solicitud);
    
    // Verificar qué se guardó realmente en la BD usando query SQL directa
    const solicitudVerificacion = await this.repo.manager.query(
      'SELECT id, numero_solicitud, vehiculo_id, conductor_id FROM solicitudes_mantenimiento WHERE id = $1',
      [saved.id]
    );
    
    this.debugLogger.log('[SOLICITUDES SERVICE] Solicitud guardada en BD (después de save):', {
      id: saved.id,
      numero_solicitud: saved.numero_solicitud,
      vehiculo_id: saved.vehiculo?.id || (saved as any).vehiculoId,
      vehiculo_patente: saved.vehiculo?.patente || 'NO DISPONIBLE',
      vehiculo_marca: saved.vehiculo?.marca || 'N/A',
      vehiculo_modelo: saved.vehiculo?.modelo || 'N/A',
      conductor_id: saved.conductor?.id || (saved as any).conductorId,
      estado: saved.estado,
      solicitudCompleta: saved
    });
    
    this.debugLogger.log('[SOLICITUDES SERVICE] 🔍 Verificación SQL directa de solicitud guardada:', {
      query: 'SELECT ... WHERE id = ' + saved.id,
      resultado: solicitudVerificacion,
      vehiculo_id_en_bd: solicitudVerificacion[0]?.vehiculo_id,
      conductor_id_en_bd: solicitudVerificacion[0]?.conductor_id
    });
    
    // Verificar que el vehiculo_id guardado corresponde al vehículo correcto
    if (solicitudVerificacion.length > 0) {
      const vehiculoIdGuardado = solicitudVerificacion[0].vehiculo_id;
      if (vehiculoIdGuardado !== vehiculo.id) {
        this.debugLogger.error('[SOLICITUDES SERVICE] ⚠️⚠️⚠️ ERROR CRÍTICO: vehiculo_id guardado NO corresponde al vehículo esperado!', {
          vehiculo_id_esperado: vehiculo.id,
          vehiculo_patente_esperada: vehiculo.patente,
          vehiculo_id_guardado: vehiculoIdGuardado,
          solicitud_id: saved.id
        });
        
        // Obtener el vehículo que realmente se guardó
        const vehiculoGuardado = await this.vehiculos.findOne({ where: { id: vehiculoIdGuardado } });
        this.debugLogger.error('[SOLICITUDES SERVICE] Vehículo que realmente se guardó:', {
          id: vehiculoGuardado?.id,
          patente: vehiculoGuardado?.patente,
          marca: vehiculoGuardado?.marca,
          modelo: vehiculoGuardado?.modelo,
          conductor_actual_id: vehiculoGuardado?.conductor_actual_id
        });
      } else {
        this.debugLogger.log('[SOLICITUDES SERVICE] ✅ Verificación exitosa: vehiculo_id guardado corresponde al vehículo esperado');
      }
    }
    if (vehiculo.estado !== 'EN_REVISION') {
      vehiculo.estado = 'EN_REVISION';
      await this.vehiculos.save(vehiculo);
      this.debugLogger.log('[SOLICITUDES SERVICE] Estado del vehículo actualizado a EN_REVISION');
    }
    
    this.events.emitSolicitudesRefresh();
    this.events.emitVehiculoRefresh(vehiculo.id);
    this.debugLogger.log('[SOLICITUDES SERVICE] Eventos Socket.IO emitidos (solicitud:refresh, vehiculo:refresh)');

    // Notificar al jefe de taller sobre la nueva solicitud
    // Obtener el primer jefe de taller activo
    const jefeTaller = await this.usuarios
      .createQueryBuilder('u')
      .where('u.rol = :rol', { rol: 'JEFE_TALLER' })
      .andWhere('u.activo = true')
      .orderBy('u.id', 'ASC')
      .getOne();
    
    this.debugLogger.log('[SOLICITUDES SERVICE] Jefe de taller encontrado para notificación:', {
      id: jefeTaller?.id,
      nombre: jefeTaller?.nombre_completo
    });
    
    if (jefeTaller) {
      const tipoSolicitud = emergencia ? 'EMERGENCIA' : 'REVISION';
      const mensajeNotificacion = `Nueva solicitud ${tipoSolicitud} del vehículo ${vehiculo.patente}: ${dto.descripcion.substring(0, 100)}${dto.descripcion.length > 100 ? '...' : ''}`;
      this.debugLogger.log('[SOLICITUDES SERVICE] Enviando notificación al jefe de taller:', {
        jefeId: jefeTaller.id,
        patenteEnMensaje: vehiculo.patente,
        mensaje: mensajeNotificacion
      });
      
      await this.events.emitJefeTallerNotification(jefeTaller.id, {
        tipo: emergencia ? 'warning' : 'info',
        titulo: emergencia ? '🚨 Solicitud de Emergencia' : 'Nueva Solicitud de Mantenimiento',
        mensaje: mensajeNotificacion,
      });
    }

    const resultado = {
      id: saved.id,
      numero_solicitud: saved.numero_solicitud,
      estado: saved.estado,
      tipo_solicitud: saved.tipo_solicitud,
    };
    
    this.debugLogger.log('[SOLICITUDES SERVICE] Retornando resultado:', resultado);
    this.debugLogger.log('[SOLICITUDES SERVICE] ===== FIN createFromDriver =====');
    
    return resultado;
  }

  private async purgeOldFinalized() {
    if (!this.purgeDays || this.purgeDays <= 0) return;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - this.purgeDays);
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('estado IN (:...estados)', { estados: this.finalStatuses })
      .andWhere('fecha_actualizacion < :fecha', { fecha: limitDate })
      .execute();
  }

  async findAll() {
    await this.purgeOldFinalized();
    const list = await this.repo.find({
      where: { visible: true },
      relations: ['vehiculo', 'conductor'],
      order: { fecha_solicitud: 'DESC' },
    });
    
    this.debugLogger.log('[SOLICITUDES SERVICE - findAll] ===== LISTADO DE SOLICITUDES =====');
    this.debugLogger.log('[SOLICITUDES SERVICE - findAll] Total solicitudes encontradas:', list.length);
    
    // Logging detallado de cada solicitud con su vehículo
    list.forEach((sol, index) => {
      this.debugLogger.log(`[SOLICITUDES SERVICE - findAll] Solicitud ${index + 1}:`, {
        id: sol.id,
        numero_solicitud: sol.numero_solicitud,
        vehiculo_id: sol.vehiculo?.id || 'NO ASIGNADO',
        vehiculo_patente: sol.vehiculo?.patente || 'NO DISPONIBLE',
        vehiculo_marca: sol.vehiculo?.marca || 'N/A',
        vehiculo_modelo: sol.vehiculo?.modelo || 'N/A',
        conductor_id: sol.conductor?.id || 'NO ASIGNADO',
        conductor_nombre: sol.conductor?.nombre_completo || 'N/A',
        estado: sol.estado,
        tipo_solicitud: sol.tipo_solicitud,
        vehiculoCompleto: sol.vehiculo,
        conductorCompleto: sol.conductor
      });
      
      // Verificar si hay inconsistencias
      if (!sol.vehiculo) {
        this.debugLogger.warn(`[SOLICITUDES SERVICE - findAll] ⚠️ ADVERTENCIA: Solicitud ${sol.id} (${sol.numero_solicitud}) NO TIENE VEHÍCULO ASIGNADO`);
      } else if (!sol.vehiculo.patente) {
        this.debugLogger.warn(`[SOLICITUDES SERVICE - findAll] ⚠️ ADVERTENCIA: Solicitud ${sol.id} (${sol.numero_solicitud}) tiene vehículo ID ${sol.vehiculo.id} pero SIN PATENTE`);
      }
    });
    
    this.debugLogger.log('[SOLICITUDES SERVICE - findAll] ===== FIN LISTADO DE SOLICITUDES =====');
    
    return this.hydrateEvidenciasLista(list);
  }

  async findOne(id: number) {
    const sol = await this.repo.findOne({
      where: { id },
      relations: ['vehiculo', 'conductor'],
    });
    if (!sol) throw new NotFoundException('Solicitud no encontrada');
    return this.hydrateEvidencias(sol);
  }

  async findApprovedByVehicle(vehiculoId: number) {
    const list = await this.repo.find({
      where: {
        estado: In(this.estadosDisponiblesParaOT),
        vehiculo: { id: vehiculoId },
        visible: true,
      },
      relations: ['vehiculo', 'conductor'],
      order: { fecha_actualizacion: 'DESC' },
    });
    return this.hydrateEvidenciasLista(list);
  }

  async createFromJefe(jefeId: number, dto: CreateSolicitudInternalDto) {
    const vehiculo = await this.vehiculos.findOne({ where: { id: dto.vehiculoId } });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    if (!dto.imagenes || dto.imagenes.length === 0) {
      throw new BadRequestException('Adjunta al menos una imagen');
    }
    const imagenes = dto.imagenes.slice(0, 5);
    const evidencias = await this.subirEvidencias(imagenes, jefeId, vehiculo.id);
    const numero = await this.nextNumber();

    const conductor = vehiculo.conductor_actual_id
      ? await this.usuarios.findOne({ where: { id: vehiculo.conductor_actual_id } })
      : null;

    const solicitud = this.repo.create({
      numero_solicitud: numero,
      vehiculo,
      conductor: conductor ?? null,
      tipo_solicitud: dto.emergencia ? 'EMERGENCIA' : 'REVISION',
      descripcion_problema: dto.descripcion,
      urgencia: dto.emergencia ? 'ALTA' : 'NORMAL',
      estado: 'APROBADA',
      visible: true,
      evidencia_foto_principal: evidencias[0],
      evidencia_foto_adicional_1: evidencias[1] ?? null,
      evidencia_foto_adicional_2: evidencias[2] ?? null,
      evidencia_foto_adicional_3: evidencias[3] ?? null,
      evidencia_foto_adicional_4: evidencias[4] ?? null,
      fecha_aprobacion: new Date(),
      aprobado_por: jefeId,
      fecha_actualizacion: new Date(),
    });

    const saved = await this.repo.save(solicitud);
    await this.vehiculos.update(vehiculo.id, { estado: 'STANDBY' });
    this.events.emitSolicitudesRefresh();
    this.events.emitVehiculoRefresh(vehiculo.id);

    return this.findOne(saved.id);
  }

  async updateStatus(id: number, dto: UpdateSolicitudDto, jefeId: number) {
    const sol = await this.repo.findOne({
      where: { id },
      relations: ['vehiculo', 'conductor'],
    });
    if (!sol) throw new NotFoundException('Solicitud no encontrada');
    if (sol.estado === 'CONVERTIDA_OT') {
      throw new BadRequestException('No se puede modificar una solicitud convertida en OT');
    }

    const estadoAnterior = sol.estado;
    sol.estado = dto.estado;
    sol.aprobado_por = jefeId;
    sol.fecha_aprobacion = new Date();
    sol.fecha_actualizacion = new Date();
    await this.repo.save(sol);

    if (dto.estado === 'APROBADA') {
      await this.vehiculos.update(sol.vehiculo.id, { estado: 'STANDBY' });
      
      // Notificar al chofer sobre la aprobación
      if (sol.conductor?.id) {
        await this.events.emitDriverNotification(sol.conductor.id, {
          tipo: 'success',
          titulo: '✅ Solicitud Aprobada',
          mensaje: `Tu solicitud ${sol.numero_solicitud} ha sido aprobada. El vehículo ${sol.vehiculo.patente} está programado para mantenimiento.`,
          solicitudId: sol.id,
        });
      }
    } else if (dto.estado === 'CITA_MANTENCION') {
      await this.vehiculos.update(sol.vehiculo.id, { estado: 'CITA_MANTENCION' });
      
      // Notificar al chofer sobre la cita programada
      if (sol.conductor?.id) {
        await this.events.emitDriverNotification(sol.conductor.id, {
          tipo: 'info',
          titulo: '📅 Cita de Mantenimiento Programada',
          mensaje: `Tu solicitud ${sol.numero_solicitud} ha sido programada para mantenimiento. El vehículo ${sol.vehiculo.patente} tiene una cita agendada.`,
          solicitudId: sol.id,
        });
      }
    } else if (dto.estado === 'RECHAZADA') {
      await this.vehiculos.update(sol.vehiculo.id, { estado: 'OPERATIVO' });
      
      // Notificar al chofer sobre el rechazo
      if (sol.conductor?.id) {
        await this.events.emitDriverNotification(sol.conductor.id, {
          tipo: 'warning',
          titulo: '❌ Solicitud Rechazada',
          mensaje: `Tu solicitud ${sol.numero_solicitud} ha sido rechazada. El vehículo ${sol.vehiculo.patente} está operativo. Si tienes dudas, contacta al taller.`,
          solicitudId: sol.id,
        });
      }
    }

    this.events.emitSolicitudesRefresh();
    this.events.emitVehiculoRefresh(sol.vehiculo.id);
    return { id: sol.id, estado: sol.estado };
  }

  async remove(id: number) {
    const sol = await this.repo.findOne({ where: { id } });
    if (!sol) throw new NotFoundException('Solicitud no encontrada');
    
    // Verificar si hay órdenes de trabajo asociadas a esta solicitud
    // Usamos createQueryBuilder para buscar por solicitud_id directamente
    const ordenesAsociadas = await this.workOrderRepo
      .createQueryBuilder('ot')
      .where('ot.solicitud_id = :solicitudId', { solicitudId: id })
      .select(['ot.id', 'ot.numero_ot', 'ot.estado'])
      .getMany();
    
    if (ordenesAsociadas.length > 0) {
      const numerosOT = ordenesAsociadas.map(ot => ot.numero_ot).join(', ');
      throw new BadRequestException(
        `No se puede ocultar la solicitud porque tiene ${ordenesAsociadas.length} orden(es) de trabajo asociada(s): ${numerosOT}. ` +
        'Las solicitudes convertidas en OT deben permanecer visibles para mantener el historial.'
      );
    }
    
    // Soft delete: marcar como no visible en lugar de eliminar físicamente
    sol.visible = false;
    sol.fecha_actualizacion = new Date();
    await this.repo.save(sol);
    this.events.emitSolicitudesRefresh();
    return { id };
  }
}

