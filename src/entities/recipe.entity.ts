import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToMany, 
  ManyToOne, 
  JoinTable, 
  JoinColumn 
} from 'typeorm';
import { User } from './user.entity';
import { Ingredient } from './ingredient.entity';
import { CookingTool } from './cooking-tool.entity';

@Entity('Recipes')
export class Recipe {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ nullable: true })
  video_url!: string;

  @Column({ nullable: true })
  thumbnail_img!: string;

  @Column({ default: 0 })
  likes_count!: number;

  // 1. 작성자 관계 (User 엔티티의 myRecipes와 연결)
  @ManyToOne(() => User, (user) => user.myRecipes)
  @JoinColumn({ name: 'creator_id' }) // DB 컬럼명을 creator_id로 설정
  creator!: User;

  // 2. 좋아요 관계 (User 엔티티의 likedRecipes와 연결)
  @ManyToMany(() => User, (user) => user.likedRecipes)
  @JoinTable({ name: 'User_Likes_Recipes' }) 
  likedByUsers!: User[];

  // 3. 재료 태그 관계 (Ingredient 엔티티의 recipes와 연결)
  @ManyToMany(() => Ingredient, (ingredient) => ingredient.recipes)
  @JoinTable({ name: 'Recipe_Ingredients_Map' })
  ingredients!: Ingredient[];

  // 4. 조리기구 태그 관계 (CookingTool 엔티티의 recipes와 연결)
  @ManyToMany(() => CookingTool, (tool) => tool.recipes)
  @JoinTable({ name: 'Recipe_Tools_Map' })
  cooking_tools!: CookingTool[];
}