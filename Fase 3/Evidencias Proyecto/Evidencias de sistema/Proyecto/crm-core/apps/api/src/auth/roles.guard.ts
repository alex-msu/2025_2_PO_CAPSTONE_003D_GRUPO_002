import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user; // viene del JwtStrategy validate()

    if (!user?.rol) {
      console.log('[RolesGuard] Usuario sin rol:', user);
      return false;
    }
    
    const u = String(user.rol).toLowerCase().trim();
    const hasAccess = required.some((r) => u === String(r).toLowerCase().trim());
    
    if (!hasAccess) {
      console.log('[RolesGuard] Acceso denegado. Usuario rol:', user.rol, 'Rol normalizado:', u, 'Roles requeridos:', required);
    }
    
    return hasAccess;
  }
}
