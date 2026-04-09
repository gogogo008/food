import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity('CookingTools')
export class CookingTool {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true }) // '에어프라이어'가 중복 저장되지 않도록 설정
  name!: string;

  // 이 조리기구가 필요한 레시피 목록
  @ManyToMany(() => Recipe, (recipe) => recipe.cooking_tools)
  recipes!: Recipe[];
}