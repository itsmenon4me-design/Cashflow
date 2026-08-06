import { Logger } from '@nestjs/common';

export abstract class BaseRepository {
  protected readonly logger = new Logger(this.constructor.name);

  protected readonly repositoryName: string;

  protected constructor(repositoryName: string) {
    this.repositoryName = repositoryName;
  }

  protected getRepositoryIdentity(): string {
    return `${this.repositoryName}`;
  }
}
