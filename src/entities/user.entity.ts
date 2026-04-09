import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { UserPhysicalInfo } from './user-physical-info.entity';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password?: string; // 보안을 위해 선택적 혹은 해싱 저장

  @Column()
  nickname!: string;

  @Column({ type: 'float', nullable: true })
  goal_calories!: number;

  @Column({ type: 'json', nullable: true })
  goal_macros!: { c: number; p: number; f: number };

  @OneToOne(() => UserPhysicalInfo, (physical) => physical.user)
  physicalInfo!: UserPhysicalInfo;
}