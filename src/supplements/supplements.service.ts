import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplement } from '../entities/supplement.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class SupplementsService {
  constructor(
    @InjectRepository(Supplement) private suppRepository: Repository<Supplement>,
    @InjectRepository(Ingredient) private ingRepository: Repository<Ingredient>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async createSupplement(userId: string, dto: { name: string, dosage: string, times: string[], ingredientNames: string[] }) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 1. 성분 자동 관리 (없으면 생성, 있으면 가져오기)
    const ingredientEntities = await Promise.all(
      dto.ingredientNames.map(async (name) => {
        let ing = await this.ingRepository.findOne({ where: { name } });
        if (!ing) {
          ing = this.ingRepository.create({ name });
          await this.ingRepository.save(ing);
        }
        return ing;
      }),
    );

    // 2. 영양제 객체 생성
    const supplement = this.suppRepository.create({
      name: dto.name,
      dosage: dto.dosage,
      times: dto.times,
      ingredients: ingredientEntities,
      creator: user,
    });

    return await this.suppRepository.save(supplement);
  }

  async findAllIngredients() {
    return await this.ingRepository.find();
  }
}