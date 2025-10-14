import { Controller, Post, Body } from '@nestjs/common';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Post('presign-put')
  presign(@Body() body: { key: string; contentType?: string }) {
    return this.files.presignPut(body.key, body.contentType);
  }
}
