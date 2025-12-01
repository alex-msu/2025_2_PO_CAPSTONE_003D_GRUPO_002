import { Body, Controller, Post } from '@nestjs/common';
import { OtService } from './ot.service';

@Controller('ot')
export class OtController {
  constructor(private ot: OtService) {}

  @Post()
  async crear(@Body() body: { patente: string; cliente_id: number; descripcion?: string }) {
    const { id } = await this.ot.crearOT(body);
    return { ok: true, id };
  }
}
