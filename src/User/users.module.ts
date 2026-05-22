// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { UserPhysicalInfo } from '../entities/user-physical-info.entity'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPhysicalInfo]) 
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}