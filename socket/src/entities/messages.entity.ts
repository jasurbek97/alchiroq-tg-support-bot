import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'messages' })
export class Messages {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  author: number;

  @Column()
  text: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  sent_date: Date;

  @Column()
  recipient: number;

  @Column()
  sent_by_operator: boolean;

  @Column()
  is_read: boolean;

  @Column({ type: 'timestamptz' })
  read_date: Date;

  @Column()
  operator_id: number;

  @Column()
  filename: string;

  @Column()
  path: string;
}
