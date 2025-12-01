import { Controller, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './users/entities/user.entity';

@Controller('dev')
export class DevController {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}

  @Post('seed-user')
  async seed(@Body() dto: { email: string; password: string }) {
    const hash = await bcrypt.hash(dto.password, 12);

    const user = this.repo.create({
      rut: `RUT-${Date.now()}`,
      nombre_completo: 'Usuario Seed',
      email: dto.email,
      rol: 'admin',
      taller_id: 1,
      hash_contrasena: hash,
      activo: true,
    } as DeepPartial<Usuario>);

    const saved = await this.repo.save(user);
    return { id: saved.id, email: saved.email };
  }
}