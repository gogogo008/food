import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('Meal_Logs')
export class MealLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: ['아침', '점심', '저녁', '간식'] })
  meal_type!: string;

  @Column()
  food_img_url!: string;

  @Column({ type: 'json' })
  total_nutrients: any;
}