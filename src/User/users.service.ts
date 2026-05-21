// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserPhysicalInfo } from '../entities/user-physical-info.entity';
import { PhysicalInfoDto } from '../Dto/physical-info.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    
    @InjectRepository(UserPhysicalInfo)
    private physicalInfoRepository: Repository<UserPhysicalInfo>,
  ) {}

  async savePhysicalInfo(userId: string, dto: PhysicalInfoDto) {
    // 1. 회원가입 직후 생성된 유저가 존재하는지 먼저 확인
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['physicalInfo'],
    });
    
    if (!user) {
      throw new NotFoundException('존재하지 않는 유저입니다. 회원가입 상태를 확인하세요.');
    }

    // 2. 가짜 데이터(문자열)를 계산 가능한 숫자형으로 변환
    const height = parseFloat(dto.height);
    const weight = parseFloat(dto.weight);
    const age = parseInt(dto.age, 10);

    // 3. User_Physical_Info 테이블에 데이터 기입 (1:1 관계 생성 또는 수정)
    let physicalInfo = user.physicalInfo;
    if (!physicalInfo) {
      // 엔티티 구조에 맞게 user_id와 user 객체를 매핑하여 새로 생성
      physicalInfo = this.physicalInfoRepository.create({ 
        user_id: userId,
        user: user 
      });
    }

    // 엔티티 컬럼명(스네이크 케이스 포함)과 프론트 DTO 정확히 매핑
    physicalInfo.gender = dto.gender;
    physicalInfo.age = age;
    physicalInfo.height = height;
    physicalInfo.weight = weight;
    physicalInfo.activity_level = dto.activityLevel; 
    
    // 신체 스펙 데이터베이스에 먼저 저장
    await this.physicalInfoRepository.save(physicalInfo);

    // 4. 저장된 신체 스펙 기반으로 권장 칼로리 계산 (해리스-베네딕트 공식)
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr = dto.gender === 'male' ? bmr + 5 : bmr - 161;
    
    // 프론트엔드가 보내주는 활동량 문자열 대응
    const activityCoefficients: { [key: string]: number } = {
      sedentary: 1.2,
      active: 1.55,
    };
    const coefficient = activityCoefficients[dto.activityLevel] || 1.2;
    const recommendedCalories = Math.round(bmr * coefficient);

    // 5.홈 화면 영양소 섭취 현황 그래프 맞춤형 6대 영양소 계산 후 'Users' 테이블에 기입
    user.goal_calories = recommendedCalories;
    user.goal_macros = {
      c: Math.round((recommendedCalories * 0.5) / 4),       // 탄수화물 (50%)
      p: Math.round((recommendedCalories * 0.3) / 4),       // 단백질 (30%)
      f: Math.round((recommendedCalories * 0.2) / 9),       // 지방 (20%)
      fiber: Math.round((recommendedCalories / 1000) * 12), // 식이섬유
      sugar: Math.round((recommendedCalories * 0.1) / 4),   // 당류
      sodium: 2000,                                         // 나트륨 (mg)
    };

    // 유저 정보 최종 업데이트 (이제 로그인하면 이 데이터가 바로 풀립니다.)
    await this.userRepository.save(user);

    return { 
      success: true, 
      message: '회원가입 후 신체 정보 기입 및 영양소 목표량 설정이 완료되었습니다.'
    };
  }
}