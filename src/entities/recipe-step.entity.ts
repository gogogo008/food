// src/entities/recipe-step.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity('RecipeSteps')
export class RecipeStep {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  step_number!: number; // 예: 1, 2, 3... (요리 순서 번호)

  @Column({ type: 'text' })
  description!: string; // 예: "닭가슴살을 한 입 크기로 썹니다."

  @Column({ nullable: true })
  step_img!: string; // 해당 단계의 이미지 URL (선택사항, 인스타 감성용 📸)

  // N:1 관계 - 어떤 레시피의 순서인지 연결
  @ManyToOne(() => Recipe, (recipe) => recipe.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;
}