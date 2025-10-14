import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}
  @Get('by-email') find(@Query('email') email: string) { return this.svc.findByEmail(email); }
}
