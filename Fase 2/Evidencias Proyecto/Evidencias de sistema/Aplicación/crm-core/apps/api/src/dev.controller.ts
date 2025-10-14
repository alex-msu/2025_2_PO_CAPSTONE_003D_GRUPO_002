// apps/api/src/dev.controller.ts
import { Controller, Post, Body, BadRequestException, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './users/entities/user.entity';

@Controller('dev')
export class DevController {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  @Post('seed-user')
  async seed(@Body() body: { email: string; password: string }) {
    if (process.env.NODE_ENV !== 'development') throw new BadRequestException('Not allowed');
    const { email, password } = body;
    if (!email || !password) throw new BadRequestException('email/password requeridos');

    const hash = await bcrypt.hash(password, 10);
    let user = await this.repo.findOne({ where: { email } });
    if (user) {
      user.hash_contrasena = hash;
      user.activo = true;
    } else {
      user = this.repo.create({ email, hash_contrasena: hash, activo: true } as any);
    }
    await this.repo.save(user);
    return { ok: true, email };
  }

  @Get('show-user')
  async show(@Query('email') email: string) {
    if (process.env.NODE_ENV !== 'development') throw new BadRequestException('Not allowed');
    const u = await this.repo.findOne({ where: { email } });
    return u ? { email: u.email, activo: u.activo, hash_len: u.hash_contrasena?.length, hash: u.hash_contrasena } : null;
  }
}