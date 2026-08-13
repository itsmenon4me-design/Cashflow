import { Injectable } from '@nestjs/common';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../constants/settings.constants';
import { UpdateUserSettingsDto } from '../dto/update-user-settings.dto';
import { UserSettingsResponseDto } from '../dto/user-settings-response.dto';
import { UserSettingsEntity } from '../entities/user-settings.entity';
import { toUserSettingsResponse } from '../mappers/user-settings.mapper';
import { PrismaUserSettingsRepository } from '../repositories/prisma-user-settings.repository';

const DEFAULT_THEME = 'dark';
const DEFAULT_LANGUAGE = 'id';
const DEFAULT_CURRENCY = 'IDR';

@Injectable()
export class UserSettingsService {
  constructor(private readonly repository: PrismaUserSettingsRepository) {}

  private normalizeNotificationPreferences(
    raw: unknown,
  ): Record<string, unknown> {
    const source =
      typeof raw === 'object' && raw !== null
        ? (raw as Record<string, unknown>)
        : {};

    const result: Record<string, unknown> = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };

    for (const [key, value] of Object.entries(source)) {
      if (result[key] !== undefined) {
        result[key] = typeof value === 'boolean' ? value : result[key];
      } else if (
        key === 'financeBot' &&
        typeof value === 'object' &&
        value !== null
      ) {
        result[key] = this.normalizeFinanceBotPreferences(
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private normalizeFinanceBotPreferences(
    raw: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (key === 'enabled' && typeof value === 'boolean') {
        normalized.enabled = value;
        continue;
      }
      if (key === 'dailyReminderEnabled' && typeof value === 'boolean') {
        normalized.dailyReminderEnabled = value;
        continue;
      }
      if (
        (key === 'reminderTime1' || key === 'reminderTime2') &&
        typeof value === 'string' &&
        this.isValidReminderTime(value)
      ) {
        normalized[key] = value;
        continue;
      }
      if (
        key === 'budgetThreshold' &&
        typeof value === 'number' &&
        Number.isFinite(value)
      ) {
        normalized.budgetThreshold = value;
        continue;
      }
      if (
        (key === 'personality' || key === 'customStyle') &&
        typeof value === 'string'
      ) {
        normalized[key] = value;
        continue;
      }
      // Preserve nested unknown values, but avoid keeping invalid known financeBot keys.
      const knownKeys = new Set([
        'enabled',
        'dailyReminderEnabled',
        'reminderTime1',
        'reminderTime2',
        'budgetThreshold',
        'personality',
        'customStyle',
      ]);
      if (knownKeys.has(key)) {
        continue;
      }
      normalized[key] = value;
    }

    return normalized;
  }

  private isValidReminderTime(value: unknown): value is string {
    return (
      typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    );
  }

  async getSettings(userId: string): Promise<UserSettingsResponseDto> {
    return toUserSettingsResponse(await this.getOrCreate(userId));
  }

  async updateSettings(
    userId: string,
    dto: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    const current = await this.getOrCreate(userId);

    const update: Parameters<
      PrismaUserSettingsRepository['updateByUserId']
    >[1] = {};
    if (dto.theme !== undefined) update.theme = dto.theme;
    if (dto.language !== undefined) update.language = dto.language;
    if (dto.currency !== undefined) update.currency = dto.currency;
    if (dto.timezone !== undefined) update.timezone = dto.timezone;

    if (dto.notification_preferences !== undefined) {
      // Merge incoming preferences with existing to preserve non-boolean nested keys
      const incoming =
        typeof dto.notification_preferences === 'object' &&
        dto.notification_preferences !== null
          ? dto.notification_preferences
          : {};
      const mergedPrefs = {
        ...(current.notification_preferences ?? {}),
        ...incoming,
      } as Record<string, unknown>;

      // Normalize known boolean flags while preserving other nested keys (like financeBot)
      const normalized = this.normalizeNotificationPreferences(mergedPrefs);
      // Put back any other keys from mergedPrefs that are not part of the boolean map
      for (const [k, v] of Object.entries(mergedPrefs)) {
        if (normalized[k] === undefined) {
          normalized[k] = v;
        }
      }

      update.notification_preferences = normalized;
    }

    await this.repository.updateByUserId(userId, update);

    const merged: UserSettingsEntity = {
      ...current,
      theme: this.toSafeTheme(dto.theme ?? current.theme),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      notification_preferences:
        update.notification_preferences ?? current.notification_preferences,
    };

    return toUserSettingsResponse(merged);
  }

  private async getOrCreate(userId: string): Promise<UserSettingsEntity> {
    const existing = await this.repository.findByUserId(userId);
    if (existing) {
      const preferences = this.normalizeNotificationPreferences(
        existing.notification_preferences,
      );
      if (
        JSON.stringify(preferences) !==
        JSON.stringify(existing.notification_preferences)
      ) {
        await this.repository.updateByUserId(userId, {
          notification_preferences: preferences,
        });
      }
      return {
        ...existing,
        theme: this.toSafeTheme(existing.theme),
        notification_preferences: preferences,
      };
    }

    return this.repository.create({
      user_id: userId,
      theme: DEFAULT_THEME,
      language: DEFAULT_LANGUAGE,
      currency: DEFAULT_CURRENCY,
      notification_preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    });
  }

  private toSafeTheme(theme: string): string {
    return theme === 'light' || theme === 'dark' ? theme : DEFAULT_THEME;
  }
}
