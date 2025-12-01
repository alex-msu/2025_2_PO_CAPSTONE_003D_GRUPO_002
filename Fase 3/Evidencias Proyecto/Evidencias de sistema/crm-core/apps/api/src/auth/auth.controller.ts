// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Request as Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }
  @Get('health')
  health() {
    return { ok: true, scope: 'auth' };
  }

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

@UseGuards(JwtAuthGuard)
  @Get('me') // <-- ¡CAMBIADO DE 'profile' A 'me'!
  getProfile(@Req() req: any) {
    // El JwtStrategy devuelve userId, no sub directamente
    // Usamos userId o sub dependiendo de lo que devuelva la estrategia
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    return this.auth.getProfile(userId); 
  }
}

