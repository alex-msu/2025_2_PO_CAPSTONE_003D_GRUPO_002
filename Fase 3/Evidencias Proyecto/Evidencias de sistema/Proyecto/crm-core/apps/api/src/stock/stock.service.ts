import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Repuesto, Inventario, MovimientoRepuesto } from './entities/stock.entity';
import { SolicitudRepuesto } from './entities/solicitud-repuesto.entity';
import { Shop, WorkOrder } from '../workorders/entities/workorder.entity';
import { Usuario } from '../users/entities/user.entity';
import { CreateRepuestoDto } from './dto/create-repuesto.dto';
import { UpdateInventarioDto } from './dto/update-inventario.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { CreateSolicitudRepuestoDto } from './dto/create-solicitud-repuesto.dto';
import { RespondSolicitudRepuestoDto } from './dto/respond-solicitud-repuesto.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Repuesto)
    private readonly repuestoRepo: Repository<Repuesto>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoRepuesto)
    private readonly movimientoRepo: Repository<MovimientoRepuesto>,
    @InjectRepository(SolicitudRepuesto)
    private readonly solicitudRepo: Repository<SolicitudRepuesto>,
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly ds: DataSource,
    private readonly events: EventsGateway,
  ) {}

  // ========== REPUESTOS ==========
  async findAllRepuestos() {
    return this.repuestoRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findOneRepuesto(id: number) {
    const repuesto = await this.repuestoRepo.findOne({ where: { id } });
    if (!repuesto) throw new NotFoundException('Repuesto no encontrado');
    return repuesto;
  }

  async createRepuesto(dto: CreateRepuestoDto) {
    const existing = await this.repuestoRepo.findOne({ where: { sku: dto.sku } });
    if (existing) throw new BadRequestException('El SKU ya existe');
    
    const repuesto = this.repuestoRepo.create(dto);
    return this.repuestoRepo.save(repuesto);
  }

  // ========== INVENTARIOS ==========
  async findAllInventarios(tallerId?: number, page?: number, limit?: number, busqueda?: string, estado?: string) {
    const qb = this.inventarioRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.repuesto', 'repuesto')
      .leftJoinAndSelect('inv.taller', 'taller')
      .orderBy('repuesto.nombre', 'ASC');

    if (tallerId) {
      qb.where('inv.taller_id = :tallerId', { tallerId });
    }

    // Filtro por búsqueda (SKU o nombre de repuesto)
    if (busqueda) {
      const busquedaTerm = `%${busqueda.toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(repuesto.sku) LIKE :busqueda OR UPPER(repuesto.nombre) LIKE :busqueda)',
        { busqueda: busquedaTerm }
      );
    }

    // Filtro por estado de stock
    if (estado) {
      if (estado === 'critico') {
        qb.andWhere('inv.cantidad_disponible = 0');
      } else if (estado === 'bajo') {
        qb.andWhere('inv.cantidad_disponible > 0 AND inv.cantidad_disponible <= inv.nivel_minimo_stock');
      } else if (estado === 'normal') {
        qb.andWhere('inv.cantidad_disponible > inv.nivel_minimo_stock');
      }
    }

    // Si se solicita paginación, aplicarla
    if (page !== undefined && limit !== undefined) {
      const pageNum = page || 1;
      const limitNum = limit || 50;
      const skip = (pageNum - 1) * limitNum;

      // Contar total antes de aplicar paginación
      const total = await qb.getCount();

      // Aplicar paginación
      qb.skip(skip).take(limitNum);

      const list = await qb.getMany();

      return {
        data: list,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    }

    // Sin paginación: comportamiento original (compatibilidad hacia atrás)
    return qb.getMany();
  }

  async findOneInventario(tallerId: number, repuestoId: number) {
    const inventario = await this.inventarioRepo.findOne({
      where: { taller: { id: tallerId }, repuesto: { id: repuestoId } },
      relations: ['repuesto', 'taller'],
    });
    if (!inventario) throw new NotFoundException('Inventario no encontrado');
    return inventario;
  }

  async updateInventario(tallerId: number, repuestoId: number, dto: UpdateInventarioDto) {
    const inventario = await this.findOneInventario(tallerId, repuestoId);
    
    if (dto.cantidad_disponible !== undefined) {
      inventario.cantidad_disponible = dto.cantidad_disponible;
    }
    if (dto.nivel_minimo_stock !== undefined) {
      inventario.nivel_minimo_stock = dto.nivel_minimo_stock;
    }
    if (dto.nivel_maximo_stock !== undefined) {
      inventario.nivel_maximo_stock = dto.nivel_maximo_stock;
    }
    if (dto.ubicacion_almacen !== undefined) {
      inventario.ubicacion_almacen = dto.ubicacion_almacen;
    }

    return this.inventarioRepo.save(inventario);
  }

  async getStockBajo(tallerId?: number) {
    const qb = this.inventarioRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.repuesto', 'repuesto')
      .leftJoinAndSelect('inv.taller', 'taller')
      .where('inv.cantidad_disponible <= inv.nivel_minimo_stock')
      .orderBy('inv.cantidad_disponible', 'ASC');

    if (tallerId) {
      qb.andWhere('inv.taller_id = :tallerId', { tallerId });
    }

    return qb.getMany();
  }

  // ========== MOVIMIENTOS ==========
  async createMovimiento(userId: number, dto: CreateMovimientoDto) {
    const repuesto = await this.repuestoRepo.findOne({ where: { id: dto.repuesto_id } });
    if (!repuesto) throw new NotFoundException('Repuesto no encontrado');

    const taller = await this.shopRepo.findOne({ where: { id: dto.taller_id } });
    if (!taller) throw new NotFoundException('Taller no encontrado');

    return await this.ds.transaction(async (trx) => {
      // Crear movimiento
      const movimiento = this.movimientoRepo.create({
        repuesto,
        taller,
        orden_trabajo_id: dto.orden_trabajo_id || null,
        tipo_movimiento: dto.tipo_movimiento,
        cantidad: dto.cantidad,
        costo_unitario: dto.costo_unitario || null,
        motivo: dto.motivo || null,
        movido_por: userId,
      });
      await trx.getRepository(MovimientoRepuesto).save(movimiento);

      // Actualizar inventario
      let inventario = await trx.getRepository(Inventario).findOne({
        where: { taller: { id: dto.taller_id }, repuesto: { id: dto.repuesto_id } },
      });

      if (!inventario) {
        // Crear inventario si no existe
        inventario = trx.getRepository(Inventario).create({
          taller,
          repuesto,
          cantidad_disponible: 0,
          nivel_minimo_stock: 5,
          nivel_maximo_stock: 50,
        });
      }

      // Actualizar cantidad según tipo de movimiento
      if (dto.tipo_movimiento === 'ENTRADA') {
        inventario.cantidad_disponible += dto.cantidad;
        inventario.fecha_ultimo_reabastecimiento = new Date();
      } else if (dto.tipo_movimiento === 'SALIDA') {
        if (inventario.cantidad_disponible < dto.cantidad) {
          throw new BadRequestException('Stock insuficiente');
        }
        inventario.cantidad_disponible -= dto.cantidad;
      } else if (dto.tipo_movimiento === 'AJUSTE') {
        inventario.cantidad_disponible = dto.cantidad;
      }

      await trx.getRepository(Inventario).save(inventario);

      return movimiento;
    });
  }

  async findMovimientos(
    tallerId?: number, 
    repuestoId?: number, 
    limit: number = 50,
    busqueda?: string,
    fechaDesde?: Date | string,
    fechaHasta?: Date | string,
    tipo?: string
  ) {
    const qb = this.movimientoRepo
      .createQueryBuilder('mov')
      .leftJoinAndSelect('mov.repuesto', 'repuesto')
      .leftJoinAndSelect('mov.taller', 'taller')
      .orderBy('mov.fecha_movimiento', 'DESC')
      .limit(limit);

    if (tallerId) {
      qb.andWhere('mov.taller_id = :tallerId', { tallerId });
    }
    if (repuestoId) {
      qb.andWhere('mov.repuesto_id = :repuestoId', { repuestoId });
    }

    // Filtro por tipo de movimiento
    if (tipo) {
      qb.andWhere('mov.tipo_movimiento = :tipo', { tipo });
    }

    // Filtro por rango de fechas
    if (fechaDesde) {
      const fechaDesdeDate = fechaDesde instanceof Date ? fechaDesde : new Date(fechaDesde);
      qb.andWhere('mov.fecha_movimiento >= :fechaDesde', { fechaDesde: fechaDesdeDate });
    }
    if (fechaHasta) {
      const fechaHastaDate = fechaHasta instanceof Date ? fechaHasta : new Date(fechaHasta);
      // Agregar un día completo para incluir todo el día
      fechaHastaDate.setHours(23, 59, 59, 999);
      qb.andWhere('mov.fecha_movimiento <= :fechaHasta', { fechaHasta: fechaHastaDate });
    }

    // Filtro por búsqueda (SKU o nombre de repuesto)
    if (busqueda) {
      const busquedaTerm = `%${busqueda.toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(repuesto.sku) LIKE :busqueda OR UPPER(repuesto.nombre) LIKE :busqueda)',
        { busqueda: busquedaTerm }
      );
    }

    return qb.getMany();
  }

  // ========== SOLICITUDES DE REPUESTOS ==========
  async createSolicitudRepuesto(mechanicId: number, dto: CreateSolicitudRepuestoDto) {
    const ot = await this.workOrderRepo.findOne({
      where: { id: dto.orden_trabajo_id },
      relations: ['mecanico', 'taller', 'jefe_taller'],
    });
    if (!ot) throw new NotFoundException('Orden de trabajo no encontrada');
    
    if (ot.mecanico?.id !== mechanicId) {
      throw new BadRequestException('No tienes permiso para solicitar repuestos para esta OT');
    }

    const repuesto = await this.repuestoRepo.findOne({ where: { id: dto.repuesto_id } });
    if (!repuesto) throw new NotFoundException('Repuesto no encontrado');

    const solicitud = this.solicitudRepo.create({
      orden_trabajo: ot,
      repuesto,
      cantidad_solicitada: dto.cantidad_solicitada,
      urgencia: dto.urgencia || 'NORMAL',
      estado: 'SOLICITADA',
      comentarios: dto.comentarios || null,
      solicitado_por: mechanicId,
    });

    const saved = await this.solicitudRepo.save(solicitud);
    
    // Notificar al bodeguero
    this.events.emitSolicitudesRepuestosRefresh();
    
    // Notificar al jefe de taller sobre la solicitud de repuesto
    if (ot.jefe_taller?.id) {
      const repuestoNombre = repuesto.nombre || 'Repuesto';
      await this.events.emitJefeTallerNotification(ot.jefe_taller.id, {
        tipo: dto.urgencia === 'URGENTE' ? 'warning' : 'info',
        titulo: 'Solicitud de Repuesto',
        mensaje: `El mecánico ha solicitado ${dto.cantidad_solicitada} ${repuestoNombre} para la OT ${ot.numero_ot}. Urgencia: ${dto.urgencia || 'NORMAL'}`,
        otId: ot.id,
      });
    }
    
    return saved;
  }

  async findAllSolicitudesRepuestos(estado?: string, urgencia?: string) {
    const qb = this.solicitudRepo
      .createQueryBuilder('sol')
      .leftJoinAndSelect('sol.orden_trabajo', 'ot')
      .leftJoinAndSelect('ot.vehiculo', 'vehiculo')
      .leftJoinAndSelect('ot.mecanico', 'mecanico')
      .leftJoinAndSelect('sol.repuesto', 'repuesto')
      .leftJoinAndSelect('sol.solicitado_por_user', 'solicitante')
      .orderBy('sol.fecha_solicitud', 'DESC');

    if (estado) {
      qb.where('sol.estado = :estado', { estado });
    }

    if (urgencia) {
      qb.andWhere('sol.urgencia = :urgencia', { urgencia });
    }

    return qb.getMany();
  }

  async findSolicitudesRepuestosByOt(otId: number) {
    return this.solicitudRepo.find({
      where: { orden_trabajo: { id: otId } },
      relations: ['repuesto', 'solicitado_por_user'],
      order: { fecha_solicitud: 'DESC' },
    });
  }

  async respondSolicitudRepuesto(bodegueroId: number, solicitudId: number, dto: RespondSolicitudRepuestoDto) {
    const solicitud = await this.solicitudRepo.findOne({
      where: { id: solicitudId },
      relations: ['orden_trabajo', 'orden_trabajo.mecanico', 'orden_trabajo.taller', 'repuesto'],
    });
    
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estado !== 'SOLICITADA') {
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    solicitud.estado = dto.accion;
    solicitud.fecha_aprobacion = new Date();
    if (dto.comentarios) {
      solicitud.comentarios = (solicitud.comentarios || '') + '\n[Bodeguero]: ' + dto.comentarios;
    }
    if (dto.fecha_estimada_entrega) {
      solicitud.fecha_estimada_entrega = new Date(dto.fecha_estimada_entrega);
    }

    await this.solicitudRepo.save(solicitud);

    if (dto.accion === 'APROBADA' && solicitud.orden_trabajo.taller?.id) {
      try {
        const movimientoDto: CreateMovimientoDto = {
          repuesto_id: solicitud.repuesto.id,
          taller_id: solicitud.orden_trabajo.taller.id,
          orden_trabajo_id: solicitud.orden_trabajo.id,
          tipo_movimiento: 'SALIDA',
          cantidad: solicitud.cantidad_solicitada,
          motivo: `Uso en OT: ${solicitud.orden_trabajo.numero_ot}`,
        };
        await this.createMovimiento(bodegueroId, movimientoDto);
      } catch (error) {
        // Log el error pero no fallar la aprobación si hay un problema con el movimiento
        console.error('Error al crear movimiento de stock al aprobar solicitud:', error);
      }
    }

    // Notificar al mecánico
    if (solicitud.orden_trabajo.mecanico) {
      const mensaje = dto.accion === 'APROBADA'
        ? `Tu solicitud de ${solicitud.cantidad_solicitada} ${solicitud.repuesto.nombre} para ${solicitud.orden_trabajo.numero_ot} ha sido aprobada. ${dto.fecha_estimada_entrega ? 'Fecha y hora estimada de entrega: ' + new Date(dto.fecha_estimada_entrega).toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}`
        : `Tu solicitud de ${solicitud.cantidad_solicitada} ${solicitud.repuesto.nombre} para ${solicitud.orden_trabajo.numero_ot} ha sido rechazada. ${dto.comentarios ? 'Motivo: ' + dto.comentarios : ''}`;
      
      this.events.emitMechanicNotification(solicitud.orden_trabajo.mecanico.id, {
        tipo: dto.accion === 'APROBADA' ? 'success' : 'error',
        titulo: dto.accion === 'APROBADA' ? 'Solicitud Aprobada' : 'Solicitud Rechazada',
        mensaje,
        otId: solicitud.orden_trabajo.id,
      });
    }

    // Refrescar solicitudes para el bodeguero
    this.events.emitSolicitudesRepuestosRefresh();

    return solicitud;
  }

  async confirmarRecepcionRepuestos(mechanicId: number, solicitudId: number) {
    const solicitud = await this.solicitudRepo.findOne({
      where: { id: solicitudId },
      relations: ['orden_trabajo', 'orden_trabajo.mecanico', 'orden_trabajo.taller', 'repuesto'],
    });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.orden_trabajo.mecanico?.id !== mechanicId) {
      throw new BadRequestException('No tienes permiso para confirmar esta recepción');
    }
    if (solicitud.estado !== 'APROBADA') {
      throw new BadRequestException('Solo puedes confirmar recepción de solicitudes aprobadas');
    }

    solicitud.estado = 'RECIBIDA';
    await this.solicitudRepo.save(solicitud);

    // Esto registra la salida real del repuesto del inventario
    if (solicitud.orden_trabajo.taller?.id) {
      try {
        // Verificar si ya existe un movimiento para esta solicitud y repuesto en esta OT
        // (evitar duplicados si se llama múltiples veces)
        const movimientoExistente = await this.movimientoRepo.findOne({
          where: {
            orden_trabajo_id: solicitud.orden_trabajo.id,
            repuesto: { id: solicitud.repuesto.id },
            tipo_movimiento: 'SALIDA',
          },
        });

        // Solo crear el movimiento si no existe uno previo
        if (!movimientoExistente) {
          const movimientoDto: CreateMovimientoDto = {
            repuesto_id: solicitud.repuesto.id,
            taller_id: solicitud.orden_trabajo.taller.id,
            orden_trabajo_id: solicitud.orden_trabajo.id,
            tipo_movimiento: 'SALIDA',
            cantidad: solicitud.cantidad_solicitada,
            motivo: `Uso en OT: ${solicitud.orden_trabajo.numero_ot}`,
          };
          await this.createMovimiento(mechanicId, movimientoDto);
        }
      } catch (error) {
        // Log el error pero no fallar la confirmación si hay un problema con el movimiento
        console.error('Error al crear movimiento de stock al confirmar recepción:', error);
      }
    }

    // Verificar si todas las solicitudes de la OT están recibidas
    const todasSolicitudes = await this.findSolicitudesRepuestosByOt(solicitud.orden_trabajo.id);
    const todasRecibidas = todasSolicitudes.every(s => s.estado === 'RECIBIDA' || s.estado === 'RECHAZADA');
    
    if (todasRecibidas && todasSolicitudes.some(s => s.estado === 'RECIBIDA')) {
      // Si todas las solicitudes están recibidas o rechazadas, y al menos una fue recibida,
      // el mecánico puede iniciar el trabajo
      // Esto se manejará en el frontend
    }

    // Notificar al bodeguero
    this.events.emitSolicitudesRepuestosRefresh();

    return solicitud;
  }
}

