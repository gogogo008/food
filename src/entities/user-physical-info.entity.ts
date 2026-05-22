import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('User_Physical_Info')
export class UserPhysicalInfo {
  // 💡 1. 독립된 고유 기본키(PK)를 부여합니다. (TypeORM 빌드 순서 충돌 전면 차단)
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: string;

  // 💡 2. 문자열 결합 방식으로 관계 매핑 (순환 참조 컴파일 에러 완전 방지)
  @OneToOne('User', 'physicalInfo', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: ['male', 'female'] })
  gender!: string;

  @Column()
  age!: number;

  @Column({ type: 'float' })
  height!: number;

  @Column({ type: 'float' })
  weight!: number;

  @Column()
  activity_level!: string; 
}