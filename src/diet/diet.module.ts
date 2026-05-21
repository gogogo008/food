import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DietController } from './diet.controller';
import { DietService } from './diet.service';
import { Food } from '../entities/food.entity';
import { MealLog } from '../entities/meal-log.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food, MealLog, User]), 
  ],
  controllers: [DietController],
  providers: [DietService],
})
export class DietModule {}