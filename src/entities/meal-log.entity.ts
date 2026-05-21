import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity'; // 기존 User 엔티티 경로에 맞게 수정

@Entity('meal_logs')
@Index(['userId', 'eatDate']) // 6개월치 통계 쿼리 성능 최적화를 위한 인덱스
export class MealLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'varchar', length: 20 })
  mealType!: '아침' | '점심' | '저녁' | '간식'; // 프론트의 MealType 규격

  @Column({ type: 'varchar', length: 100 })
  foodName!: string; // 먹은 음식 이름

  @Column({ type: 'int', default: 100 })
  quantity!: number; // 섭취량 (g 단위)

  // 섭취 시점의 실제 영양성분 (수량 scale이 반영되었거나 유저가 커스텀 수정한 최종 값)
  @Column({ type: 'float' })
  calories!: number;

  @Column({ type: 'float' })
  carbs!: number;

  @Column({ type: 'float' })
  protein!: number;

  @Column({ type: 'float' })
  fat!: number;

  @Column({ type: 'float', default: 0 })
  fiber!: number;

  @Column({ type: 'float', default: 0 })
  sugar!: number;

  @Column({ type: 'float', default: 0 })
  sodium!: number;

  @Column({ type: 'date' })
  eatDate!: string; // 연-월-일 (예: 2026-05-19) 통계 조회용

  @CreateDateColumn()
  createdAt!: Date;
}