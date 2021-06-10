import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Client, Server } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Messages } from '../../entities/messages.entity';
import { Chats } from '../../entities/chats.entity';
import { Session } from '../../entities/session.entity';
import { User } from '../../entities/user.entity';
import { Repository, Between } from 'typeorm';

function isBlocked(chat: any): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return chat.blocked && chat.blocked_date > yesterday;
}

function archivedMessage(message: any): boolean {
  const past = new Date();
  past.setDate(past.getDate() - 1);
  return message.sent_date < past;
}

function archivedChat(chat: any): boolean {
  return (
    chat.archived ||
    (chat.messages.every(msg => archivedMessage(msg)) &&
      chat.messages[chat.messages.length - 1].sent_by_operator)
  );
}

function isProcessedChat(chat: any): boolean {
  return chat.messages.some(msg => msg.sent_by_operator);
}

function formatDate(date: Date): string {
  return [
    ('00' + date.getDate()).slice(-2),
    ('00' + (date.getMonth() + 1)).slice(-2),
    date.getFullYear(),
  ].join('.');
}

@WebSocketGateway()
export class ChatGateway {
  constructor(
    @InjectRepository(Messages) public messagesRepo: Repository<Messages>,
    @InjectRepository(Chats) public chatsRepo: Repository<Chats>,
    @InjectRepository(Session) public sessionRepo: Repository<Session>,
    @InjectRepository(User) public userRepo: Repository<User>,
  ) {
  }

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('chats')
  async chats(client: Client, data: any) {
    let chats = await this.chatsRepo.find({ system: 'telegram' });
    const messages = await this.messagesRepo.find();
    const operators = await this.userRepo.find();
    chats = chats.map(chat => ({
      ...chat,
      lang: chat.lang === 'uz' ? 'Узбекский' : 'Русский',
      blocked: isBlocked(chat),
      messages: messages
        .filter(message => message.author === chat.id || message.recipient === chat.id,
        ).map(msg => {
          const operator = operators.find(op => op.id === msg.operator_id);
          return {
            ...msg,
            operator: operator ? operator.email : '',
          };
        }),
    }))
      .filter(chat => chat.messages.length);

    return chats;
  }

  @SubscribeMessage('archive')
  async archive(client: Client, data: any) {
    let chats = await this.chatsRepo.find({ system: 'telegram' });
    const messages = await this.messagesRepo.find();
    const operators = await this.userRepo.find();

    chats = chats.map(chat => ({
        ...chat,
        lang: chat.lang === 'uz' ? 'Узбекский' : 'Русский',
        blocked: isBlocked(chat),
        messages: messages
          .filter(
            message =>
              message.author === chat.id || message.recipient === chat.id,
          )
          .map(msg => {
            const operator = operators.find(op => op.id === msg.operator_id);
            return {
              ...msg,
              operator: operator ? operator.email : '',
            };
          }),
      }))
      .filter(chat => chat.messages.length && archivedChat(chat));

    return chats;
  }

  @SubscribeMessage('events')
  findAll(client: Client, data: any): Observable<WsResponse<number>> {
    return from([1, 2, 3]).pipe(map(item => ({ event: 'events', data: item })));
  }

  @SubscribeMessage('identity')
  async identity(client: Client, data: number): Promise<number> {
    return data;
  }

  @SubscribeMessage('question')
  async question(client: Client, data: any) {
    const { from, text } = data;
    const chat = await this.chatsRepo.findOne({ chat_id: from });
    chat.archived = false;
    await this.chatsRepo.save(chat);
    const message = await this.messagesRepo.insert({
      author: chat.id,
      text,
      sent_date: new Date(),
      recipient: 0,
      sent_by_operator: false,
      is_read: false,
    });
    const messageId = message.identifiers[0].id;

    this.server.emit('new_question', {
      id: messageId,
    });

    return {
      ...data,
      answer: false,
    };
  }

  @SubscribeMessage('answer')
  async answer(client: Client, data: any) {
    try {
      const { text, recipient, operator_id } = data;

      // const session = await this.sessionRepo.findOne({ id: operator_id });
      // operator_id = session.data.toString().match(/i:\d+/)[0].replace('i:', '');
      const operator = await this.userRepo.findOne({ id: operator_id });
      const message = await this.messagesRepo.insert({
        author: recipient,
        text,
        sent_date: new Date(),
        recipient,
        sent_by_operator: true,
        is_read: true,
        operator_id: operator.id,
        filename: data.filename ?? null,
        path: data.path ?? null,
      });
      const messageId = message.identifiers[0].id;

      this.server.emit('new_answer', {
        id: messageId,
      });

      return {
        ...data,
        answer: true,
      };
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.log(err);
    }
  }

  @SubscribeMessage('read')
  async read(client: Client, data: any) {
    const { chat_id } = data;
    await this.messagesRepo.update(
      { author: chat_id, is_read: false },
      {
        is_read: true,
        read_date: new Date(),
      },
    );
    this.server.emit('new_question');
    return 'good';
  }

  @SubscribeMessage('unread_messages_count')
  async unread_messages_count(client: Client, data: any) {
    // tslint:disable-next-line:variable-name
    const unread_messages = await this.messagesRepo.find({
      sent_by_operator: false,
      is_read: false,
    });
    return unread_messages.length;
  }

  // @SubscribeMessage('ban')
  // async ban(client: Client, data: any) {
  //   try {
  //     let { operator_id } = data;
  //     const { user_id, type } = data;
  //     const chat = await this.chatsRepo.findOne({ id: user_id });
  //     const session = await this.sessionRepo.findOne({ id: operator_id });
  //     operator_id = session.data
  //       .toString()
  //       .match(/i:\d+/)[0]
  //       .replace('i:', '');
  //     const operator = await this.userRepo.findOne({ id: operator_id });
  //
  //     if (operator.role !== 1 && operator.role !== 2) {
  //       return 'bad';
  //     }
  //
  //     const state = !isBlocked(chat);
  //     const date = type === 'temporary' ? new Date() : new Date('2025');
  //
  //     await this.chatsRepo.update(
  //       { id: user_id },
  //       {
  //         blocked: state,
  //         blocked_date: state ? date : null,
  //       },
  //     );
  //     return 'good';
  //   } catch (err) {
  //     // tslint:disable-next-line:no-console
  //     console.log(err);
  //   }
  // }

  @SubscribeMessage('archive_chat')
  async archiveChat(client: Client, data: any) {
    const { user_id, type } = data;
    const chat = await this.chatsRepo.findOne({ id: user_id });

    await this.chatsRepo.update(
      { id: user_id },
      {
        archived: !chat.archived,
      },
    );

    return 'good';
  }

  @SubscribeMessage('stats')
  async stats(client: Client, data: any) {
    const { from, to } = data;
    const chats = await this.chatsRepo.find({ system: 'telegram' });
    const messages = await this.messagesRepo.find({
      sent_date: Between(from, to),
    });

    const stats = chats
      .map(chat => ({
        ...chat,
        lang: chat.lang === 'uz' ? 'Узбекский' : 'Русский',
        blocked: isBlocked(chat),
        messages: messages.filter(
          message => message.author === chat.id || message.recipient === chat.id,
        ),
      }))
      .filter(chat => chat.messages.length)
      .map(chat => ({
        is_processed: isProcessedChat(chat),
        date: chat.messages[chat.messages.length - 1].sent_date,
      }));

    const total = {
      processed: stats.filter(chat => chat.is_processed).length,
      unprocessed: stats.filter(chat => !chat.is_processed).length,
    };
    let by_days = stats.reduce((p, c) => {
      const date = formatDate(c.date);
      if (!p[date]) {
        p[date] = {
          processed: 0,
          unprocessed: 0,
        };
      }
      p[date][c.is_processed ? 'processed' : 'unprocessed']++;
      return p;
    }, {});
    by_days = Object.keys(by_days)
      .sort((a, b) => Number(new Date(a) < new Date(b)))
      .map(key => {
        const { processed, unprocessed } = by_days[key];
        let total = processed + unprocessed;
        return {
          date: key,
          processed,
          unprocessed,
          processed_percentage: Math.floor((processed / total) * 1000) / 10,
          unprocessed_percentage: Math.floor((unprocessed / total) * 1000) / 10,
        };
      });

    return {
      total,
      by_days,
    };
  }
}
