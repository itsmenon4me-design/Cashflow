import { validate } from 'class-validator';
import { MonthlyReportQueryDto } from '../dto/monthly-report-query.dto';
import { ExportQueryDto } from '../dto/export-query.dto';

describe('DTO validation', () => {
  it('invalid monthly query should fail validation', async () => {
    const dto = new MonthlyReportQueryDto();
    dto.month = 13;
    dto.year = 2026;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('valid monthly query should pass validation', async () => {
    const dto = new MonthlyReportQueryDto();
    dto.month = 8;
    dto.year = 2026;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('invalid export query should fail for unknown type and format', async () => {
    const dto = new ExportQueryDto();
    // @ts-expect-error - intentionally invalid type to test validation
    dto.type = 'unknown';
    // @ts-expect-error - intentionally invalid format to test validation
    dto.format = 'xml';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('valid export query should pass', async () => {
    const dto = new ExportQueryDto();
    dto.type = 'monthly';
    dto.format = 'csv';
    dto.month = 8;
    dto.year = 2026;
    dto.startDate = '2026-08-01';
    dto.endDate = '2026-08-31';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
