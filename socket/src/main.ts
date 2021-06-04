import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import * as fileUpload from 'express-fileupload';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

const staticFilesPath = path.join(__dirname, '../uploads');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useStaticAssets(staticFilesPath);
  app.use(fileUpload());
  await app.listen(14387);
}

bootstrap()
