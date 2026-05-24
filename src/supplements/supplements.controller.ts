import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { SupplementsService } from './supplements.service';

@Controller('supplements')
export class SupplementsController {
  constructor(private readonly suppService: SupplementsService) {}

  @Post(':userId')
  async create(@Param('userId') userId: string, @Body() dto: any) {
    return await this.suppService.createSupplement(userId, dto);
  }

  @Get('ingredients') // 프론트에서 전체 재료 목록 가져오기용
  async getIngredients() {
    return await this.suppService.findAllIngredients();
  }
}