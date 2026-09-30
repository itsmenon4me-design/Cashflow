import { validate } from 'class-validator';
import { UpdateUserSettingsDto } from './update-user-settings.dto';

describe('UpdateUserSettingsDto timezone validation', () => {
  it.each(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])(
    'accepts the supported Indonesian timezone %s',
    async (timezone) => {
      const dto = Object.assign(new UpdateUserSettingsDto(), { timezone });

      await expect(validate(dto)).resolves.toEqual([]);
    },
  );

  it.each(['Asia/Pontianak', 'Asia/Ujung_Pandang', 'Europe/Amsterdam', 'Mars/Olympus'])(
    'rejects timezone writes that are not canonical supported values: %s',
    async (timezone) => {
      const dto = Object.assign(new UpdateUserSettingsDto(), { timezone });
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('timezone');
    },
  );
});
