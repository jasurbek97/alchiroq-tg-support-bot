import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './gateways/chat/chat.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [ChatModule, TypeOrmModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
