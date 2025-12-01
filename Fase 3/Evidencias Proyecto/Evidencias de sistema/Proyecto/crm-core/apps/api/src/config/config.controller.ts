import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // Endpoint público para leer el modo debug (sin autenticación)
  // Esto permite que las páginas de login carguen la configuración
  @Get('debug')
  async getDebugMode() {
    const enabled = await this.configService.getDebugMode();
    return { enabled };
  }

  // Endpoint protegido para establecer el modo debug (solo admin)
  @Post('debug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setDebugMode(@Req() req: any, @Body() body: { enabled: boolean }) {
    await this.configService.setDebugMode(body.enabled === true);
    return { enabled: body.enabled === true, message: 'Modo debug actualizado correctamente' };
  }
}

