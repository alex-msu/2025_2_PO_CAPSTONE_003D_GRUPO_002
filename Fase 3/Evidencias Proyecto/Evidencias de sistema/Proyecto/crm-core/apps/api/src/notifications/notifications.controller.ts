import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Obtener todas las notificaciones del usuario autenticado
   */
  @Get()
  @Roles('MECANICO', 'mecanico', 'BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'ADMIN', 'admin')
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.notificationsService.findAll(userId);
  }

  /**
   * Obtener notificaciones no leídas del usuario autenticado
   */
  @Get('unread')
  @Roles('MECANICO', 'mecanico', 'BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'ADMIN', 'admin')
  async findUnread(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.notificationsService.findUnread(userId);
  }

  /**
   * Contar notificaciones no leídas del usuario autenticado
   */
  @Get('unread/count')
  @Roles('MECANICO', 'mecanico', 'BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'ADMIN', 'admin')
  async countUnread(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    const count = await this.notificationsService.countUnread(userId);
    return { count };
  }

  /**
   * Marcar una notificación como leída
   */
  @Patch(':id/read')
  @Roles('MECANICO', 'mecanico', 'BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'ADMIN', 'admin')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.notificationsService.markAsRead(Number(id), userId);
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  @Patch('read-all')
  @Roles('MECANICO', 'mecanico', 'BODEGUERO', 'bodeguero', 'JEFE_TALLER', 'jefe_taller', 'RECEPCIONISTA', 'recepcionista', 'CHOFER', 'chofer', 'ADMIN', 'admin')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'Todas las notificaciones han sido marcadas como leídas' };
  }
}

