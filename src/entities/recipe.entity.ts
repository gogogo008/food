// src/entities/recipe.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToMany, 
  ManyToOne, 
  OneToMany, // 💡 추가됨
  CreateDateColumn, // 💡 추가됨
  UpdateDateColumn, // 💡 추가됨
  JoinTable, 
  JoinColumn 
} from 'typeorm';
import { User } from './user.entity';
import { Ingredient } from './ingredient.entity';
import { CookingTool } from './cooking-tool.entity';
import { RecipeStep } from './recipe-step.entity'; // 💡 추가됨

@Entity('Recipes')
export class Recipe {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  content!: string; // 레시피 전체 소개글 

  @Column({ nullable: true })
  video_url!: string;

  @Column({ nullable: true })
  thumbnail_img!: string;

  @Column({ default: 0 })
  likes_count!: number;

  // 🔥 1. 인스타 피드 정렬을 위한 시간 기록 컬럼 추가
  @CreateDateColumn()
  created_at!: Date; // 생성일 (최신순 정렬용)

  @UpdateDateColumn()
  updated_at!: Date; // 수정일

  // 🔥 2. 요리 상세 순서 관계 추가 (1:N)
  @OneToMany(() => RecipeStep, (step) => step.recipe, { cascade: true })
  steps!: RecipeStep[];

  // 3. 작성자 관계
  @ManyToOne(() => User, (user) => user.myRecipes)
  @JoinColumn({ name: 'creator_id' }) 
  creator!: User;

  // 4. 좋아요 관계
  @ManyToMany(() => User, (user) => user.likedRecipes)
  @JoinTable({ name: 'User_Likes_Recipes' }) 
  likedByUsers!: User[];

  // 5. 재료 태그 관계
  @ManyToMany(() => Ingredient, (ingredient) => ingredient.recipes)
  @JoinTable({ name: 'Recipe_Ingredients_Map' })
  ingredients!: Ingredient[];

  // 6. 조리기구 태그 관계
  @ManyToMany(() => CookingTool, (tool) => tool.recipes)
  @JoinTable({ name: 'Recipe_Tools_Map' })
  cooking_tools!: CookingTool[];
}