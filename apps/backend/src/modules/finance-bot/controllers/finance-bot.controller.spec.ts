import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { FinanceBotController } from './finance-bot.controller';
import { FinanceBotService } from '../services/finance-bot.service';

describe('FinanceBotController (security)', () => {
  let app: INestApplication;
  let serviceMock: { runDailyRecordingReminders: jest.Mock };

  const ORIGINAL_API_KEY = process.env.INTERNAL_API_KEY;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const INTERNAL_KEY = 'test-internal-key-12345';

  beforeAll(() => {
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  });

  afterAll(() => {
    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = ORIGINAL_API_KEY;
    }
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  beforeEach(async () => {
    serviceMock = {
      runDailyRecordingReminders: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceBotController],
      providers: [{ provide: FinanceBotService, useValue: serviceMock }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env.NODE_ENV = 'test';
  });

  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  it('rejects a request without the internal API key', async () => {
    await http().post('/internal/finance-bot/run-daily').expect(401);
    expect(serviceMock.runDailyRecordingReminders).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong internal API key', async () => {
    const response = await http()
      .post('/internal/finance-bot/run-daily')
      .set('x-internal-api-key', 'wrong-key')
      .expect(401);
    expect(serviceMock.runDailyRecordingReminders).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(INTERNAL_KEY);
  });

  it('accepts a request with the correct internal API key', async () => {
    const response = await http()
      .post('/internal/finance-bot/run-daily')
      .set('x-internal-api-key', INTERNAL_KEY)
      .expect(201);
    expect(serviceMock.runDailyRecordingReminders).toHaveBeenCalled();
    expect((response.body as { status: string }).status).toBe('ok');
  });

  it('preserves the production block even with a correct key', async () => {
    process.env.NODE_ENV = 'production';
    await http()
      .post('/internal/finance-bot/run-daily')
      .set('x-internal-api-key', INTERNAL_KEY)
      .expect(400);
    expect(serviceMock.runDailyRecordingReminders).not.toHaveBeenCalled();
  });

  it('rejects an invalid reference time', async () => {
    await http()
      .post('/internal/finance-bot/run-daily')
      .set('x-internal-api-key', INTERNAL_KEY)
      .query({ time: 'not-a-date' })
      .expect(400);
    expect(serviceMock.runDailyRecordingReminders).not.toHaveBeenCalled();
  });
});
