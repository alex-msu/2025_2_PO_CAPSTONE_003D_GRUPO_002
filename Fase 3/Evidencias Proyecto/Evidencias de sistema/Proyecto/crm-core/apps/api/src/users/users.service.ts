import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/user.entity';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}
  private readonly scheduleDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  // Queries basicas
  async findAll() {
    const rows = await this.repo.query(`
      SELECT u.*,
             h.lunes_activo, h.lunes_hora_inicio, h.lunes_hora_salida, h.lunes_colacion_inicio, h.lunes_colacion_salida,
             h.martes_activo, h.martes_hora_inicio, h.martes_hora_salida, h.martes_colacion_inicio, h.martes_colacion_salida,
             h.miercoles_activo, h.miercoles_hora_inicio, h.miercoles_hora_salida, h.miercoles_colacion_inicio, h.miercoles_colacion_salida,
             h.jueves_activo, h.jueves_hora_inicio, h.jueves_hora_salida, h.jueves_colacion_inicio, h.jueves_colacion_salida,
             h.viernes_activo, h.viernes_hora_inicio, h.viernes_hora_salida, h.viernes_colacion_inicio, h.viernes_colacion_salida
      FROM usuarios u
      LEFT JOIN horarios_trabajo h ON h.usuario_id = u.id
      ORDER BY u.id ASC
    `);
    return rows.map((row: any) => this.mapUserRow(row));
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async findByRut(rut: string) {
    return this.repo.findOne({ where: { rut } });
  }

  async listByRole(rol: string) {
    const rows = await this.repo.query(
      `
      SELECT u.*,
             h.lunes_activo, h.lunes_hora_inicio, h.lunes_hora_salida, h.lunes_colacion_inicio, h.lunes_colacion_salida,
             h.martes_activo, h.martes_hora_inicio, h.martes_hora_salida, h.martes_colacion_inicio, h.martes_colacion_salida,
             h.miercoles_activo, h.miercoles_hora_inicio, h.miercoles_hora_salida, h.miercoles_colacion_inicio, h.miercoles_colacion_salida,
             h.jueves_activo, h.jueves_hora_inicio, h.jueves_hora_salida, h.jueves_colacion_inicio, h.jueves_colacion_salida,
             h.viernes_activo, h.viernes_hora_inicio, h.viernes_hora_salida, h.viernes_colacion_inicio, h.viernes_colacion_salida
      FROM usuarios u
      LEFT JOIN horarios_trabajo h ON h.usuario_id = u.id
      WHERE LOWER(u.rol) = LOWER($1)
      ORDER BY u.id ASC
      `,
      [rol],
    );
    return rows.map((row: any) => this.mapUserRow(row));
  }

  // Creación genérica con rol
  async createWithRole(dto: {
    nombre_completo: string;
    email: string;
    password: string;
    rol: string;
    rut?: string;
    telefono?: string;
  }) {
    if (await this.findByEmail(dto.email)) throw new BadRequestException('Email ya registrado');
    if (dto.rut && await this.findByRut(dto.rut)) throw new BadRequestException('RUT ya registrado');

    const hash = await bcrypt.hash(dto.password, 10);

    const u = this.repo.create({
      rut: dto.rut ?? null,
      nombre_completo: dto.nombre_completo,
      email: dto.email,
      telefono: dto.telefono ?? null,
      rol: dto.rol,
      hash_contrasena: hash,
      activo: true,
    } as Partial<Usuario>);

    return this.repo.save(u);
  }

  // Creación específica de mecánico
  async createMechanic(dto: {
    nombre_completo: string;
    email: string;
    password: string;
    rut?: string;
    telefono?: string;
    taller_id?: number; // si tu entidad lo tiene
  }) {
    if (await this.findByEmail(dto.email)) throw new BadRequestException('Email ya registrado');
    if (dto.rut && await this.findByRut(dto.rut)) throw new BadRequestException('RUT ya registrado');

    const hash = await bcrypt.hash(dto.password, 10);

    const u = this.repo.create({
      rut: dto.rut ?? null,
      nombre_completo: dto.nombre_completo,
      email: dto.email,
      telefono: dto.telefono ?? null,
      rol: 'mecanico',
      hash_contrasena: hash,
      activo: true,
      // taller_id: dto.taller_id ?? null, // descomenta si corresponde en tu entidad
    } as Partial<Usuario>);

    return this.repo.save(u);
  }

  // Utilidad para AuthService cuando ya viene el hash
  async create(payload: Partial<Usuario>) {
    const u = this.repo.create(payload as Partial<Usuario>);
    return this.repo.save(u);
  }

  // Actualización de usuario
  async update(id: number, dto: {
    nombre_completo?: string;
    email?: string;
    rol?: string;
    rut?: string;
    telefono?: string;
    activo?: boolean;
    password?: string; // opcional, solo si se quiere cambiar la contraseña
  }) {
    const usuario = await this.findById(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar email único si se está cambiando
    if (dto.email && dto.email !== usuario.email) {
      const emailExists = await this.findByEmail(dto.email);
      if (emailExists) {
        throw new BadRequestException('Email ya registrado');
      }
    }

    // Validar RUT único si se está cambiando
    if (dto.rut && dto.rut !== usuario.rut) {
      const rutExists = await this.findByRut(dto.rut);
      if (rutExists) {
        throw new BadRequestException('RUT ya registrado');
      }
    }

    // Actualizar campos
    if (dto.nombre_completo !== undefined) usuario.nombre_completo = dto.nombre_completo;
    if (dto.email !== undefined) usuario.email = dto.email;
    if (dto.rol !== undefined) usuario.rol = dto.rol;
    if (dto.rut !== undefined) usuario.rut = dto.rut;
    if (dto.telefono !== undefined) usuario.telefono = dto.telefono;
    if (dto.activo !== undefined) usuario.activo = dto.activo;

    // Si se proporciona una nueva contraseña, hashearla
    if (dto.password) {
      usuario.hash_contrasena = await bcrypt.hash(dto.password, 10);
    }

    return this.repo.save(usuario);
  }

  // Helper: Obtener o crear usuario Sistema
  private async getOrCreateSistemaUser(): Promise<number> {
    // Intentar encontrar un usuario con email "sistema@pepsico.cl" o similar
    const sistemaUser = await this.repo.findOne({
      where: [
        { email: 'sistema@pepsico.cl' },
        { email: 'system@pepsico.cl' },
        { nombre_completo: 'Sistema' }
      ]
    });
    
    if (sistemaUser) {
      return sistemaUser.id;
    }
    
    // Crear usuario "Sistema" si no existe
    const nuevoSistema = this.repo.create({
      email: 'sistema@pepsico.cl',
      nombre_completo: 'Sistema',
      rol: 'ADMIN',
      hash_contrasena: await bcrypt.hash('sistema_' + Date.now(), 10),
      activo: false,
      rut: '0-0',
      telefono: null
    } as Partial<Usuario>);
    
    const sistemaGuardado = await this.repo.save(nuevoSistema);
    console.log(`Usuario Sistema creado con ID: ${sistemaGuardado.id} para reasignar registros históricos`);
    return sistemaGuardado.id;
  }

  // Eliminación de usuario
  async delete(id: number) {
    const usuario = await this.findById(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Limpiar referencias antes de eliminar el usuario
    // PD: Algunas tablas tienen ON DELETE CASCADE (horarios_trabajo, breaks_mecanico)
    // pero otras necesitan limpieza manual

    // 1. Limpiar referencias en vehículos
    await this.repo.manager.query(
      `UPDATE vehiculos SET conductor_actual_id = NULL WHERE conductor_actual_id = $1`,
      [id]
    );

    // 2. Limpiar referencias en solicitudes_mantenimiento
    await this.repo.manager.query(
      `UPDATE solicitudes_mantenimiento SET aprobado_por = NULL WHERE aprobado_por = $1`,
      [id]
    );
    // Limpiar conductor_id (es nullable, así que podemos ponerlo en NULL)
    await this.repo.manager.query(
      `UPDATE solicitudes_mantenimiento SET conductor_id = NULL WHERE conductor_id = $1`,
      [id]
    );

    // 3. Limpiar referencias en ordenes_trabajo
    // PD: jefe_taller_id es NOT NULL, así que no podemos ponerlo en NULL

    await this.repo.manager.query(
      `UPDATE ordenes_trabajo SET mecanico_asignado_id = NULL WHERE mecanico_asignado_id = $1`,
      [id]
    );
    
    // Limpiar campos de discrepancia en ordenes_trabajo
    await this.repo.manager.query(
      `UPDATE ordenes_trabajo 
       SET discrepancia_diagnostico_por = NULL,
           discrepancia_diagnostico_aprobada_por = NULL,
           discrepancia_diagnostico_rechazada_por = NULL
       WHERE discrepancia_diagnostico_por = $1 
          OR discrepancia_diagnostico_aprobada_por = $1 
          OR discrepancia_diagnostico_rechazada_por = $1`,
      [id]
    );
    
    // Reasignar ordenes_trabajo con este usuario como jefe_taller_id
    // Buscar otro jefe de taller disponible o usar el usuario Sistema
    try {
      const otConJefe = await this.repo.manager.query(
        `SELECT COUNT(*) as count FROM ordenes_trabajo WHERE jefe_taller_id = $1`,
        [id]
      );
      
      if (otConJefe[0]?.count > 0) {
        let nuevoJefeId: number | null = null;
        
        // Buscar otro jefe de taller activo (que no sea el usuario que se está eliminando)
        const otroJefe = await this.repo.findOne({
          where: [
            { rol: 'JEFE_TALLER', activo: true }
          ]
        });
        
        if (otroJefe && otroJefe.id !== id) {
          nuevoJefeId = otroJefe.id;
          console.log(`Reasignando OTs a otro jefe de taller (ID: ${nuevoJefeId})`);
        } else {
          // Si no hay otro jefe, buscar o crear usuario Sistema
          let sistemaUserId: number | null = null;
          
          const sistemaUser = await this.repo.findOne({
            where: [
              { email: 'sistema@pepsico.cl' },
              { email: 'system@pepsico.cl' },
              { nombre_completo: 'Sistema' }
            ]
          });
          
          if (sistemaUser) {
            sistemaUserId = sistemaUser.id;
          } else {
            // Crear usuario "Sistema" si no existe
            const nuevoSistema = this.repo.create({
              email: 'sistema@pepsico.cl',
              nombre_completo: 'Sistema',
              rol: 'ADMIN',
              hash_contrasena: await bcrypt.hash('sistema_' + Date.now(), 10),
              activo: false,
              rut: '0-0',
              telefono: null
            } as Partial<Usuario>);
            const sistemaGuardado = await this.repo.save(nuevoSistema);
            sistemaUserId = sistemaGuardado.id;
            console.log(`Usuario Sistema creado con ID: ${sistemaUserId} para reasignar OTs`);
          }
          
          nuevoJefeId = sistemaUserId;
          console.log(`No hay otro jefe de taller disponible, reasignando OTs al usuario Sistema (ID: ${nuevoJefeId})`);
        }
        
        if (nuevoJefeId) {
          // Reasignar todas las OTs del jefe de taller que se está eliminando
          await this.repo.manager.query(
            `UPDATE ordenes_trabajo SET jefe_taller_id = $1 WHERE jefe_taller_id = $2`,
            [nuevoJefeId, id]
          );
          
          console.log(`Reasignadas ${otConJefe[0].count} orden(es) de trabajo al usuario ID: ${nuevoJefeId}`);
        }
      }
    } catch (e: any) {
      console.warn('No se pudo reasignar ordenes_trabajo:', e?.message || e);
    }
    

    // 5. Limpiar referencias en discrepancias_diagnostico (si la tabla existe)
    try {
      await this.repo.manager.query(
        `UPDATE discrepancias_diagnostico 
         SET discrepancia_diagnostico_por = NULL, 
             discrepancia_diagnostico_aprobada_por = NULL,
             discrepancia_diagnostico_rechazada_por = NULL
         WHERE discrepancia_diagnostico_por = $1 
            OR discrepancia_diagnostico_aprobada_por = $1 
            OR discrepancia_diagnostico_rechazada_por = $1`,
        [id]
      );
    } catch (e: any) {
      // Si la tabla o columnas no existen, ignorar el error
      console.warn('No se pudo limpiar discrepancias_diagnostico:', e?.message || e);
    }

    // 6. Reasignar referencias NOT NULL en tablas históricas al usuario "Sistema"
    // Obtener o crear usuario Sistema una vez
    let sistemaUserId: number | null = null;
    try {
      sistemaUserId = await this.getOrCreateSistemaUser();
    } catch (e: any) {
      console.warn('No se pudo obtener/crear usuario Sistema:', e?.message || e);
    }
    
    if (sistemaUserId) {
      // 6a. Reasignar referencias en entregas_vehiculos
      try {
        await this.repo.manager.query(
          `UPDATE entregas_vehiculos SET conductor_id = $1 WHERE conductor_id = $2`,
          [sistemaUserId, id]
        );
        await this.repo.manager.query(
          `UPDATE entregas_vehiculos SET responsable_taller_id = $1 WHERE responsable_taller_id = $2`,
          [sistemaUserId, id]
        );
        console.log(`Registros de entregas_vehiculos reasignados al usuario Sistema`);
      } catch (e: any) {
        console.warn('No se pudo reasignar entregas_vehiculos:', e?.message || e);
      }
      
      // 6b. Reasignar referencias en log_estados_ot
      try {
        await this.repo.manager.query(
          `UPDATE log_estados_ot SET cambiado_por = $1 WHERE cambiado_por = $2`,
          [sistemaUserId, id]
        );
        console.log(`Registros de log_estados_ot reasignados al usuario Sistema`);
      } catch (e: any) {
        console.warn('No se pudo reasignar log_estados_ot:', e?.message || e);
      }
      
      // 6c. Reasignar referencias en movimientos_repuestos
      try {
        await this.repo.manager.query(
          `UPDATE movimientos_repuestos SET movido_por = $1 WHERE movido_por = $2`,
          [sistemaUserId, id]
        );
        console.log(`Registros de movimientos_repuestos reasignados al usuario Sistema`);
      } catch (e: any) {
        console.warn('No se pudo reasignar movimientos_repuestos:', e?.message || e);
      }
      
      // 6d. Reasignar referencias en solicitudes_repuestos
      try {
        await this.repo.manager.query(
          `UPDATE solicitudes_repuestos SET solicitado_por = $1 WHERE solicitado_por = $2`,
          [sistemaUserId, id]
        );
        console.log(`Registros de solicitudes_repuestos reasignados al usuario Sistema`);
      } catch (e: any) {
        console.warn('No se pudo reasignar solicitudes_repuestos:', e?.message || e);
      }
      
      // 6e. Reasignar referencias en archivos_adjuntos (documentos_vehiculos)
      try {
        await this.repo.manager.query(
          `UPDATE archivos_adjuntos SET subido_por = $1 WHERE subido_por = $2`,
          [sistemaUserId, id]
        );
        console.log(`Registros de archivos_adjuntos reasignados al usuario Sistema`);
      } catch (e: any) {
        console.warn('No se pudo reasignar archivos_adjuntos:', e?.message || e);
      }
    }

    // 7. Eliminar notificaciones del usuario (pueden eliminarse sin problemas)
    try {
      await this.repo.manager.query(
        `DELETE FROM notificaciones WHERE usuario_id = $1`,
        [id]
      );
    } catch (e: any) {
      // Tabla puede no existir
      console.warn('No se pudo eliminar notificaciones:', e?.message || e);
    }

    // Intentar eliminar el usuario
    try {
      await this.repo.remove(usuario);
      return { message: 'Usuario eliminado correctamente' };
    } catch (error: any) {
      // Si hay un error de clave foránea, proporcionar un mensaje más claro
      if (error?.code === '23503' || error?.message?.includes('foreign key constraint')) {
        const constraintName = error?.constraint || 'desconocida';
        throw new BadRequestException(
          `No se puede eliminar el usuario porque tiene referencias activas en la base de datos. ` +
          `Restricción: ${constraintName}. ` +
          `Por favor, verifique que todas las referencias hayan sido limpiadas correctamente.`
        );
      }
      // Re-lanzar otros errores
      throw error;
    }
  }

  async updateSchedule(userId: number, dto: UpdateScheduleDto) {
    const usuario = await this.findById(userId);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalized = this.normalizeSchedule(dto);
    const values = this.buildScheduleValues(userId, normalized);

    await this.repo.query(
      `
      INSERT INTO horarios_trabajo (
        usuario_id,
        lunes_activo, lunes_hora_inicio, lunes_hora_salida, lunes_colacion_inicio, lunes_colacion_salida,
        martes_activo, martes_hora_inicio, martes_hora_salida, martes_colacion_inicio, martes_colacion_salida,
        miercoles_activo, miercoles_hora_inicio, miercoles_hora_salida, miercoles_colacion_inicio, miercoles_colacion_salida,
        jueves_activo, jueves_hora_inicio, jueves_hora_salida, jueves_colacion_inicio, jueves_colacion_salida,
        viernes_activo, viernes_hora_inicio, viernes_hora_salida, viernes_colacion_inicio, viernes_colacion_salida
      )
      VALUES (${this.generateInsertPlaceholders(values.length)})
      ON CONFLICT (usuario_id) DO UPDATE SET
        lunes_activo = EXCLUDED.lunes_activo,
        lunes_hora_inicio = EXCLUDED.lunes_hora_inicio,
        lunes_hora_salida = EXCLUDED.lunes_hora_salida,
        lunes_colacion_inicio = EXCLUDED.lunes_colacion_inicio,
        lunes_colacion_salida = EXCLUDED.lunes_colacion_salida,
        martes_activo = EXCLUDED.martes_activo,
        martes_hora_inicio = EXCLUDED.martes_hora_inicio,
        martes_hora_salida = EXCLUDED.martes_hora_salida,
        martes_colacion_inicio = EXCLUDED.martes_colacion_inicio,
        martes_colacion_salida = EXCLUDED.martes_colacion_salida,
        miercoles_activo = EXCLUDED.miercoles_activo,
        miercoles_hora_inicio = EXCLUDED.miercoles_hora_inicio,
        miercoles_hora_salida = EXCLUDED.miercoles_hora_salida,
        miercoles_colacion_inicio = EXCLUDED.miercoles_colacion_inicio,
        miercoles_colacion_salida = EXCLUDED.miercoles_colacion_salida,
        jueves_activo = EXCLUDED.jueves_activo,
        jueves_hora_inicio = EXCLUDED.jueves_hora_inicio,
        jueves_hora_salida = EXCLUDED.jueves_hora_salida,
        jueves_colacion_inicio = EXCLUDED.jueves_colacion_inicio,
        jueves_colacion_salida = EXCLUDED.jueves_colacion_salida,
        viernes_activo = EXCLUDED.viernes_activo,
        viernes_hora_inicio = EXCLUDED.viernes_hora_inicio,
        viernes_hora_salida = EXCLUDED.viernes_hora_salida,
        viernes_colacion_inicio = EXCLUDED.viernes_colacion_inicio,
        viernes_colacion_salida = EXCLUDED.viernes_colacion_salida
      `,
      values,
    );

    return { userId, horario: normalized };
  }

  private mapUserRow(row: any) {
    const user: any = {
      id: row.id,
      rut: row.rut,
      nombre_completo: row.nombre_completo,
      email: row.email,
      telefono: row.telefono,
      rol: row.rol,
      hash_contrasena: row.hash_contrasena,
      activo: row.activo,
      fecha_creacion: row.fecha_creacion,
      fecha_actualizacion: row.fecha_actualizacion,
    };

    const horario = this.mapHorario(row);
    if (horario) {
      user.horario = horario;
    }
    return user;
  }

  private mapHorario(row: any) {
    if (!row || !('lunes_activo' in row)) {
      return null;
    }
    const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const horario: any = {};
    let hasData = false;

    for (const key of dayKeys) {
      const activo = this.toBool(row[`${key}_activo`]);
      const dia = {
        activo,
        hora_inicio: row[`${key}_hora_inicio`] ?? null,
        hora_salida: row[`${key}_hora_salida`] ?? null,
        colacion_inicio: row[`${key}_colacion_inicio`] ?? null,
        colacion_salida: row[`${key}_colacion_salida`] ?? null,
      };
      horario[key] = dia;
      if (activo) {
        hasData = true;
      }
    }

    return hasData ? horario : null;
  }

  private toBool(value: any) {
    return value === true || value === 't' || value === 'T' || value === 1;
  }

  private normalizeSchedule(dto: UpdateScheduleDto) {
    const schedule: Record<string, any> = {};
    this.scheduleDays.forEach((day) => {
      const src = (dto as any)[day] || {};
      const activo = src.activo === true;
      schedule[day] = {
        activo,
        hora_inicio: activo ? src.hora_inicio ?? null : null,
        hora_salida: activo ? src.hora_salida ?? null : null,
        colacion_inicio: activo ? src.colacion_inicio ?? null : null,
        colacion_salida: activo ? src.colacion_salida ?? null : null,
      };
    });
    return schedule;
  }

  private buildScheduleValues(userId: number, schedule: Record<string, any>) {
    const values: any[] = [userId];
    this.scheduleDays.forEach((day) => {
      const data = schedule[day] || {};
      values.push(data.activo ?? false);
      values.push(data.hora_inicio ?? null);
      values.push(data.hora_salida ?? null);
      values.push(data.colacion_inicio ?? null);
      values.push(data.colacion_salida ?? null);
    });
    return values;
  }

  private generateInsertPlaceholders(count: number) {
    return Array.from({ length: count }, (_, idx) => `$${idx + 1}`).join(', ');
  }
}
