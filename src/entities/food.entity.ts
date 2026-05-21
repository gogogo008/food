import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('foods')
export class Food {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string; // 식품명 (예: 감자범벅, 고구마)

  @Column({ type: 'varchar', length: 30, default: '100g' })
  per!: string; // 영양성분함량기준량 (예: 100g, 100ml)

  @Column({ type: 'float', default: 0 })
  calories!: number; // 에너지(kcal)

  @Column({ type: 'float', default: 0 })
  carbs!: number; // 탄수화물(g)

  @Column({ type: 'float', default: 0 })
  protein!: number; // 단백질(g)

  @Column({ type: 'float', default: 0 })
  fat!: number; // 지방(g)

  @Column({ type: 'float', default: 0 })
  fiber!: number; // 식이섬유(g)

  @Column({ type: 'float', default: 0 })
  sugar!: number; // 당류(g)

  @Column({ type: 'float', default: 0 })
  sodium!: number; // 나트륨(mg)

  @Column({ type: 'varchar', length: 10, default: '🍽️' })
  emoji!: string;

  @Column({ type: 'varchar', length: 30, default: '일반' })
  category!: string;
}