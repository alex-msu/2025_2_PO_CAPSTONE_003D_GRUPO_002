import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notifRepo: Repository<Notificacion>,
  ) {}

  /**
   * Crear una nueva notificación
   */
  async create(
    usuarioId: number,
    data: {
      titulo: string;
      mensaje: string;
      tipoNotificacion: string;
      tipoEntidadRelacionada?: string;
      entidadRelacionadaId?: number;
    },
  ): Promise<Notificacion> {
    const notificacion = this.notifRepo.create({
      usuarioId,
      titulo: data.titulo,
      mensaje: data.mensaje,
      tipoNotificacion: data.tipoNotificacion,
      tipoEntidadRelacionada: data.tipoEntidadRelacionada || null,
      entidadRelacionadaId: data.entidadRelacionadaId || null,
      leida: false,
    });

    return this.notifRepo.save(notificacion);
  }

  /**
   * Obtener todas las notificaciones de un usuario
   */
  async findAll(usuarioId: number): Promise<Notificacion[]> {
    return this.notifRepo.find({
      where: { usuarioId },
      order: { fechaCreacion: 'DESC' },
    });
  }

  /**
   * Obtener notificaciones no leídas de un usuario
   */
  async findUnread(usuarioId: number): Promise<Notificacion[]> {
    return this.notifRepo.find({
      where: {
        usuarioId,
        leida: false,
      },
      order: { fechaCreacion: 'DESC' },
    });
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(id: number, usuarioId: number): Promise<Notificacion> {
    const notificacion = await this.notifRepo.findOne({
      where: { id, usuarioId },
    });

    if (!notificacion) {
      throw new Error('Notificación no encontrada');
    }

    notificacion.leida = true;
    notificacion.fechaLectura = new Date();

    return this.notifRepo.save(notificacion);
  }

  /**
   * Marcar todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(usuarioId: number): Promise<void> {
    await this.notifRepo.update(
      { usuarioId, leida: false },
      { leida: true, fechaLectura: new Date() },
    );
  }

  /**
   * Contar notificaciones no leídas de un usuario
   */
  async countUnread(usuarioId: number): Promise<number> {
    return this.notifRepo.count({
      where: {
        usuarioId,
        leida: false,
      },
    });
  }
}

