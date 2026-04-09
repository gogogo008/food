import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity('Ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true }) // '닭가슴살'이 중복 저장되지 않도록 설정
  name!: string;

  // 이 재료가 포함된 레시피 목록
  @ManyToMany(() => Recipe, (recipe) => recipe.ingredients)
  recipes!: Recipe[];
}