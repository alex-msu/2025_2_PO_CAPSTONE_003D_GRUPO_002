// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: CreateUserDto) {
    const byRut = await this.usersService.findByRut(dto.rut);
    if (byRut) throw new ConflictException('RUT ya registrado');

    const byEmail = await this.usersService.findByEmail(dto.email);
    if (byEmail) throw new ConflictException('Email ya registrado');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({ ...dto, hash_contrasena: hash });
    return { id: user.id, email: user.email };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(dto.password, user.hash_contrasena);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    // Validar que el usuario esté activo
    if (user.activo === false) {
      throw new UnauthorizedException('Usuario desactivado. Contacte al administrador.');
    }

    const payload = { sub: user.id, email: user.email, rol: user.rol };
    return { access_token: this.jwt.sign(payload) };
  }

  // usado por LocalStrategy
  async validate(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.hash_contrasena);
    if (!ok) return null;
    
    // Validar que el usuario esté activo
    if (user.activo === false) {
      return null; // Retornar null para que LocalStrategy lance UnauthorizedException
    }
    
    return user;
  }

  async getProfile(userId: number) {
    return this.usersService.findById(userId);
  }
}
