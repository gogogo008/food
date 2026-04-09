import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToMany } from 'typeorm';
import { UserPhysicalInfo } from './user-physical-info.entity';
import { Recipe } from './recipe.entity'; // Recipe 엔티티 임포트

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password?: string;

  @Column()
  nickname!: string;

  @Column({ type: 'float', nullable: true })
  goal_calories!: number;

  @Column({ type: 'json', nullable: true })
  goal_macros!: { c: number; p: number; f: number };

  @OneToOne(() => UserPhysicalInfo, (physical) => physical.user)
  physicalInfo!: UserPhysicalInfo;

  // --- 추가된 부분 ---

  // 1. 내가 작성한 레시피들 (1:N)
  // 작성자 기능을 위해 Recipe 엔티티에 creator_id와 연결됩니다.
  @OneToMany(() => Recipe, (recipe) => recipe.creator)
  myRecipes!: Recipe[];

  // 2. 내가 좋아요 누른 레시피들 (N:M)
  // Recipe 엔티티의 likedByUsers와 서로를 참조합니다.
  @ManyToMany(() => Recipe, (recipe) => recipe.likedByUsers)
  likedRecipes!: Recipe[];
}