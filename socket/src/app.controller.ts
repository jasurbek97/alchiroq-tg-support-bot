import {
  Controller,
  Post,
  Get,
  Request,
} from '@nestjs/common';
import { AppService } from './app.service';
import * as path from "path"
import {randomStringGenerator} from "@nestjs/common/utils/random-string-generator.util";
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
  async uploadMedia(@Request()  Req) {
    const file = Req.files.file;
    const fileName = randomStringGenerator();
    const name = `${fileName}${path.parse(file.name).ext}`;
    const filePath = path.join(__dirname, `../uploads`, name);
    await file.mv(filePath);
    return name;
  }
}
