import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToMany } from 'typeorm';
import { UserPhysicalInfo } from './user-physical-info.entity';
import { Recipe } from './recipe.entity';
import { Supplement } from './supplement.entity';
@Entity('Users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  password?: string;

  @Column()
  nickname!: string;

  @Column({ type: 'float', nullable: true })
  goal_calories!: number;

  @Column({ type: 'json', nullable: true })
  goal_macros!: { 
    c: number; 
    p: number; 
    f: number;
    fiber: number;  
    sugar: number;  
    sodium: number; 
  };

  
  @OneToOne('UserPhysicalInfo', 'user')
  physicalInfo!: UserPhysicalInfo;

  @OneToMany(() => Recipe, (recipe) => recipe.creator)
  myRecipes!: Recipe[];

  @ManyToMany(() => Recipe, (recipe) => recipe.likedByUsers)
  likedRecipes!: Recipe[];

  @OneToMany(() => Supplement, (supplement) => supplement.creator)
  supplements!: Supplement[];
}