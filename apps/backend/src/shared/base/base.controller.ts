import { Logger } from '@nestjs/common';

export abstract class BaseController {
  protected readonly logger = new Logger(this.constructor.name);
}
