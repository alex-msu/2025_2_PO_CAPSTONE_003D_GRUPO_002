import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { NotificationsService } from '../notifications/notifications.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly notificationsService: NotificationsService) {}

  emitSolicitudesRefresh() {
    this.server.emit('solicitud:refresh');
  }

  emitVehiculoRefresh(vehiculoId: number) {
    this.server.emit('vehiculo:refresh', { vehiculoId });
  }

  emitReceptionRefresh() {
    this.server.emit('reception:refresh');
  }

  emitWorkOrdersRefresh() {
    this.server.emit('workorders:refresh');
  }

  async emitMechanicNotification(mechanicId: number, notification: { tipo: string; titulo: string; mensaje: string; otId?: number }) {
    // Persistir notificación antes de emitir
    try {
      await this.notificationsService.create(mechanicId, {
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        tipoNotificacion: notification.tipo,
        tipoEntidadRelacionada: notification.otId ? 'ORDEN_TRABAJO' : undefined,
        entidadRelacionadaId: notification.otId || undefined,
      });
    } catch (error) {
      console.error('Error al persistir notificación para mecánico:', error);
      // Continuar con la emisión aunque falle la persistencia
    }

    // Emitir evento para usuarios conectados
    this.server.emit('mechanic:notification', { mechanicId, ...notification });
  }

  emitSolicitudesRepuestosRefresh() {
    this.server.emit('solicitudes-repuestos:refresh');
  }

  async emitBodegueroNotification(bodegueroId: number, notification: { tipo: string; titulo: string; mensaje: string }) {
    // Persistir notificación antes de emitir
    try {
      await this.notificationsService.create(bodegueroId, {
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        tipoNotificacion: notification.tipo,
      });
    } catch (error) {
      console.error('Error al persistir notificación para bodeguero:', error);
      // Continuar con la emisión aunque falle la persistencia
    }

    // Emitir evento para usuarios conectados
    this.server.emit('bodeguero:notification', { bodegueroId, ...notification });
  }

  async emitJefeTallerNotification(jefeId: number, notification: { tipo: string; titulo: string; mensaje: string; otId?: number }) {
    // Persistir notificación antes de emitir
    try {
      await this.notificationsService.create(jefeId, {
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        tipoNotificacion: notification.tipo,
        tipoEntidadRelacionada: notification.otId ? 'ORDEN_TRABAJO' : undefined,
        entidadRelacionadaId: notification.otId || undefined,
      });
    } catch (error) {
      console.error('Error al persistir notificación para jefe de taller:', error);
      // Continuar con la emisión aunque falle la persistencia
    }

    // Emitir evento para usuarios conectados
    this.server.emit('jefe-taller:notification', { jefeId, ...notification });
  }

  async emitDriverNotification(driverId: number, notification: { tipo: string; titulo: string; mensaje: string; solicitudId?: number; otId?: number }) {
    // Persistir notificación antes de emitir
    try {
      await this.notificationsService.create(driverId, {
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        tipoNotificacion: notification.tipo,
        tipoEntidadRelacionada: notification.solicitudId ? 'SOLICITUD' : notification.otId ? 'ORDEN_TRABAJO' : undefined,
        entidadRelacionadaId: notification.solicitudId || notification.otId || undefined,
      });
    } catch (error) {
      console.error('Error al persistir notificación para chofer:', error);
      // Continuar con la emisión aunque falle la persistencia
    }

    // Emitir evento para usuarios conectados
    this.server.emit('driver:notification', { driverId, ...notification });
  }

  async emitRecepcionistaNotification(recepcionistaId: number, notification: { tipo: string; titulo: string; mensaje: string; otId?: number }) {
    // Persistir notificación antes de emitir
    try {
      await this.notificationsService.create(recepcionistaId, {
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        tipoNotificacion: notification.tipo,
        tipoEntidadRelacionada: notification.otId ? 'ORDEN_TRABAJO' : undefined,
        entidadRelacionadaId: notification.otId || undefined,
      });
    } catch (error) {
      console.error('Error al persistir notificación para recepcionista:', error);
      // Continuar con la emisión aunque falle la persistencia
    }

    // Emitir evento para usuarios conectados
    this.server.emit('recepcionista:notification', { recepcionistaId, ...notification });
  }
}

