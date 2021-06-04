import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import {join} from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/chats')
  getChats() {
    return this.appService.getChats();
  }

  @Post('/media')
  @UseInterceptors(
    FileInterceptor('file', { dest: join(__dirname, '../uploads'), preservePath: true }),
  )
  uploadMedia(@UploadedFile() file) {
    return file.path;
  }
}
