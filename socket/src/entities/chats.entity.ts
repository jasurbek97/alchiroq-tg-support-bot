import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'chats' })
export class Chats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  system: string;

  @Column({ type: 'timestamptz' })
  registered_date: Date;

  @Column()
  chat_id: number;

  @Column()
  name: string;

  @Column()
  username: string;

  @Column()
  phone: string;

  @Column()
  lang: string;

  @Column()
  blocked: boolean;

  @Column({ type: 'timestamptz' })
  blocked_date: Date;

  @Column()
  archived: boolean;
}
