import { validate } from 'class-validator';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { CreateSavingGoalDto } from '../../saving-goals/dto/create-saving-goal.dto';
import { CreateInvestmentDto } from '../../investments/dto/create-investment.dto';

describe('Multi-currency DTO validation', () => {
  it.each(['USD', 'IDR', 'SGD', 'EUR'])(
    'accepts %s as a valid budget currency',
    async (currency) => {
      const dto = Object.assign(new CreateBudgetDto(), {
        category_id: 'c1',
        currency,
        budget_amount_cents: 5000,
        month: 8,
        year: 2026,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    },
  );

  it.each(['JPY', 'random string'])(
    'rejects %s as invalid budget currency',
    async (currency) => {
      const dto = Object.assign(new CreateBudgetDto(), {
        category_id: 'c1',
        currency,
        budget_amount_cents: 5000,
        month: 8,
        year: 2026,
      });

      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'currency')).toBe(true);
    },
  );

  it.each(['USD', 'IDR', 'SGD', 'EUR'])(
    'accepts %s as a valid saving goal currency',
    async (currency) => {
      const dto = Object.assign(new CreateSavingGoalDto(), {
        name: 'Emergency',
        currency,
        target_amount_cents: 100000,
        start_date: '2026-01-01',
        target_date: '2026-12-31',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    },
  );

  it.each(['JPY', 'random string'])(
    'rejects %s as invalid saving goal currency',
    async (currency) => {
      const dto = Object.assign(new CreateSavingGoalDto(), {
        name: 'Emergency',
        currency,
        target_amount_cents: 100000,
        start_date: '2026-01-01',
        target_date: '2026-12-31',
      });

      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'currency')).toBe(true);
    },
  );

  it.each(['USD', 'IDR', 'SGD', 'EUR'])(
    'accepts %s as a valid investment currency',
    async (currency) => {
      const dto = Object.assign(new CreateInvestmentDto(), {
        currency,
        investment_type: 'Stock',
        platform: 'NASDAQ',
        name: 'AAPL',
        quantity: 10,
        average_buy_price: 137.59,
        current_price: 150.25,
        purchase_date: '2026-01-01',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    },
  );

  it.each(['JPY', 'random string'])(
    'rejects %s as invalid investment currency',
    async (currency) => {
      const dto = Object.assign(new CreateInvestmentDto(), {
        currency,
        investment_type: 'Stock',
        platform: 'NASDAQ',
        name: 'AAPL',
        quantity: 10,
        average_buy_price: 137.59,
        current_price: 150.25,
        purchase_date: '2026-01-01',
      });

      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'currency')).toBe(true);
    },
  );
});
