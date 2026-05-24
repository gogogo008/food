import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, ManyToOne } from 'typeorm';
import { Ingredient } from './ingredient.entity';
import { User } from './user.entity';

@Entity('Supplements')
export class Supplement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  dosage!: string;

  @Column('simple-array')
  times!: string[];

  @ManyToMany(() => Ingredient)
  @JoinTable()
  ingredients!: Ingredient[];

  @ManyToOne(() => User, (user) => user.supplements)
  creator!: User;
}