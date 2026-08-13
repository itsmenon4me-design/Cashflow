import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { UserSettingsModel } from '../../../generated/prisma/models/UserSettings';
import { UserSettingsEntity } from '../entities/user-settings.entity';
import {
  UserSettingsCreateData,
  UserSettingsRepository,
  UserSettingsUpdateData,
} from './user-settings.repository.interface';

@Injectable()
export class PrismaUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: UserSettingsModel): UserSettingsEntity {
    return {
      id: row.id,
      user_id: row.user_id,
      theme: row.theme,
      language: row.language,
      currency: row.currency,
      timezone: row.timezone,
      notification_preferences: row.notification_preferences,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  findByUserId(userId: string): Promise<UserSettingsEntity | null> {
    return this.prisma.userSettings
      .findUnique({ where: { user_id: userId } })
      .then((row) => (row ? this.map(row) : null));
  }

  create(data: UserSettingsCreateData): Promise<UserSettingsEntity> {
    return this.prisma.userSettings
      .create({
        data: {
          user_id: data.user_id,
          theme: data.theme,
          language: data.language,
          currency: data.currency,
          timezone: data.timezone ?? null,
          ...(data.notification_preferences !== undefined
            ? {
                notification_preferences: data.notification_preferences,
              }
            : {}),
        },
      })
      .then((row) => this.map(row));
  }

  async updateByUserId(
    userId: string,
    data: UserSettingsUpdateData,
  ): Promise<void> {
    await this.prisma.userSettings.updateMany({
      where: { user_id: userId },
      data: {
        ...(data.theme !== undefined ? { theme: data.theme } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.notification_preferences !== undefined
          ? {
              notification_preferences: data.notification_preferences,
            }
          : {}),
      },
    });
  }
}
