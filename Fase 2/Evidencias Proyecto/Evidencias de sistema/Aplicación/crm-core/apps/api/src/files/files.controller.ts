import { Controller, Post, Body, Get, Query, BadRequestException, Res } from '@nestjs/common';
import { FilesService } from './files.service';
import { Response } from 'express';

@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Post('presign-put')
  presign(@Body() body: { key: string; contentType?: string }) {
    return this.files.presignPut(body.key, body.contentType);
  }

  @Get('proxy')
  async proxy(@Query('key') key: string, @Res() res: Response) {
    if (!key) {
      throw new BadRequestException('key es requerido');
    }
    const url = await this.files.ensureSignedUrl(key);
    return res.redirect(url);
  }
}
