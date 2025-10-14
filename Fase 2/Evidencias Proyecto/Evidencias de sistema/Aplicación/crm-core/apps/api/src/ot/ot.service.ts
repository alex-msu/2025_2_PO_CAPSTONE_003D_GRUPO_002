import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class OtService {
  constructor(private ds: DataSource) {}

  async crearOT(input: { patente: string; cliente_id: number; descripcion?: string }) {
    const { patente, cliente_id, descripcion } = input;

    // inserta lo mínimo; otras columnas deben tener default en tu SQL
    // devuelve id de la OT creada
    const res = await this.ds.query(
      `INSERT INTO ordenes_trabajo (patente, cliente_id, descripcion)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [patente, cliente_id, descripcion ?? null],
    );
    return { id: res[0]?.id };
  }
}
