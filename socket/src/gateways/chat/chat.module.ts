import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Messages } from '../../entities/messages.entity';
import { Chats } from '../../entities/chats.entity';
import { User } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Messages, Chats, User, Session])],
  providers: [ChatGateway],
})
export class ChatModule {}
