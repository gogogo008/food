// src/diet/diet.controller.ts
import { Controller, Post, Get, UseInterceptors, UploadedFile, BadRequestException, Body, Param, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DietService } from './diet.service'; 
import { SaveMealLogDto } from '../Dto/meal-log.dto';

@Controller('diet')
export class DietController { 
  constructor(private readonly dietService: DietService) {}

  // 1. 기존 이미지 업로드 분석 API
  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  async uploadFoodImage(@UploadedFile() file: any) { 
    if (!file) {
      throw new BadRequestException('파일이 전송되지 않았습니다!');
    }
    console.log('받은 파일:', file.originalname);
    return await this.dietService.analyzeFoodImage(file.buffer);
  }

  // 2. 유저가 선정한 음식 영양소 최종 기록 저장 API
  @Post('log/:userId')
  async saveMealLog(
    @Param('userId') userId: string,
    @Body() saveMealLogDto: SaveMealLogDto,
  ) {
    return await this.dietService.saveMealLog(userId, saveMealLogDto);
  }

  // 3. 홈 화면 대시보드 통합 데이터 조회 API 
  async getHomeDashboard(@Param('userId') userId: string) {
    return await this.dietService.getHomeDashboard(userId);
  }

  // 4. 6개월 전 데이터까지 유연하게 확인 가능한 이력 조회 API
  @Get('history/:userId')
  async getDietHistory(
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('조회할 시작일(startDate)과 종료일(endDate)을 입력해주세요.');
    }
    return await this.dietService.getDietHistory(userId, startDate, endDate);
  }
}