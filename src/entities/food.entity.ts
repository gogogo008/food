import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// synchronize: false를 붙여서 TypeORM이 AWS DB를 강제로 수정하지 못하게 막dma
@Entity('dish_item', { synchronize: false }) 
export class Food {
  @PrimaryGeneratedColumn({ name: 'dish_id' })
  dish_id!: number;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'dish_name' })
  dish_name!: string; // 식품명

  @Column({ type: 'float', default: 0 })
  calories!: number; // 에너지(kcal)

  @Column({ name: 'carbs_g', type: 'float', default: 0 })
  carbs!: number; // 탄수화물(g)

  @Column({ name: 'protein_g', type: 'float', default: 0 })
  protein!: number; // 단백질(g)

  @Column({ name: 'fat_g', type: 'float', default: 0 })
  fat!: number; // 지방(g)

  @Column({ name: 'fiber_g', type: 'float', default: 0 })
  fiber!: number; // 식이섬유(g)

  @Column({ name: 'sugar_g', type: 'float', default: 0 })
  sugar!: number; // 당류(g)

  @Column({ name: 'sodium_mg', type: 'float', default: 0 })
  sodium!: number; // 나트륨(mg)

}