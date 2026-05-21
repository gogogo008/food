// src/users/users.controller.ts
import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { PhysicalInfoDto } from '../Dto/physical-info.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':userId/physical-info')
  @UseGuards(JwtAuthGuard)
  async savePhysicalInfo(
    @Param('userId') userId: string,
    @Body() dto: PhysicalInfoDto,
  ) {
    return this.usersService.savePhysicalInfo(userId, dto);
  }
}