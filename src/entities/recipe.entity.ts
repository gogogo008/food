import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('Recipes')
export class Recipe {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true }) // Null이면 시스템 기본
  creator_id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ nullable: true })
  video_url!: string;

  @Column({ nullable: true })
  thumbnail_img!: string;

  @Column('simple-array', { nullable: true })
  cooking_tools!: string[];

  @Column({ type: 'json', nullable: true })
  ingredients_list: any;

  @Column({ default: 0 })
  likes_count!: number;
}