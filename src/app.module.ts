import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { DietModule } from './diet/diet.module';
import { ConfigModule } from '@nestjs/config';
import { User } from './entities/user.entity';
import { MealLog } from './entities/meal-log.entity';
import { Recipe } from './entities/recipe.entity';
import { UserPhysicalInfo } from './entities/user-physical-info.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, MealLog, Recipe,UserPhysicalInfo],
      synchronize: false, 
    }),DietModule, ConfigModule.forRoot(), ],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}
