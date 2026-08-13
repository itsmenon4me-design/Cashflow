/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import { FinanceBotScheduler } from './finance-bot.scheduler';
import type { FinanceBotService } from './finance-bot.service';

describe('FinanceBotScheduler', () => {
  it('invokes the FinanceBotService daily reminder pass', async () => {
    const service = {
      runDailyRecordingReminders: jest.fn(() => Promise.resolve()),
    } as unknown as FinanceBotService;

    const scheduler = new FinanceBotScheduler(service);
    await scheduler.handleDailyRecordingReminders();

    expect(service.runDailyRecordingReminders).toHaveBeenCalledTimes(1);
  });

  it('logs errors and does not throw when the service fails', async () => {
    const service = {
      runDailyRecordingReminders: jest.fn(() =>
        Promise.reject(new Error('boom')),
      ),
    } as unknown as FinanceBotService;

    const scheduler = new FinanceBotScheduler(service);
    const logger = { error: jest.fn() };
    (scheduler as any).logger = logger;

    await expect(
      scheduler.handleDailyRecordingReminders(),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'FinanceBot daily reminder scheduler failed',
      expect.any(Error),
    );
  });

  it('skips overlapping executions when a previous scheduler run is still active', async () => {
    const service = {
      runDailyRecordingReminders: jest.fn(() => Promise.resolve()),
    } as unknown as FinanceBotService;

    const scheduler = new FinanceBotScheduler(service);
    const logger = { warn: jest.fn() };
    (scheduler as any).logger = logger;
    (scheduler as any).running = true;

    await scheduler.handleDailyRecordingReminders();

    expect(service.runDailyRecordingReminders).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'FinanceBot scheduler skipped overlapping execution',
    );
  });
});
