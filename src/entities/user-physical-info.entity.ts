import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('User_Physical_Info')
export class UserPhysicalInfo {
  @PrimaryColumn()
  user_id!: string;

  @OneToOne(() => User, (user) => user.physicalInfo)
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
  activity_level!: string; // 활동량
}