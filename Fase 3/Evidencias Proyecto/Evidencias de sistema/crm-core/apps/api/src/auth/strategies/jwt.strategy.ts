// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'devsecret',
    });
  }

  async validate(payload: { sub: number; email: string; rol: string }) {
    // Validar que el usuario siga activo
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    
    if (user.activo === false) {
      throw new UnauthorizedException('Usuario desactivado. Contacte al administrador.');
    }
    
    // Lo que devuelves aquí queda en req.user
    // Mantenemos tanto userId como sub para compatibilidad
    return { 
      userId: payload.sub, 
      sub: payload.sub,  // Agregamos sub también para compatibilidad
      email: payload.email, 
      rol: payload.rol 
    };
  }
}
