import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CategorySuggestionPanel } from './CategorySuggestionPanel';
import { aiService } from '@/services/ai.service';
import { uiText } from '@/locales';
import type { SuggestCategoryResponse } from '@/types/backend';

describe('CategorySuggestionPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables suggestion when there are no categories', () => {
    render(
      <CategorySuggestionPanel
        transactionType="EXPENSE"
        description="Coffee shop"
        amount={4.5}
        categories={[]}
        onAccept={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: uiText.transactions.suggestionButton })).toBeDisabled();
    expect(screen.getByText(uiText.transactions.suggestionHint)).toBeInTheDocument();
  });

  it('shows loading while the suggestion request is pending', async () => {
    let resolveSuggestion: (value: SuggestCategoryResponse) => void;
    vi.spyOn(aiService, 'suggestCategory').mockReturnValue(
      new Promise((resolve) => {
        resolveSuggestion = resolve;
      }),
    );

    render(
      <CategorySuggestionPanel
        transactionType="EXPENSE"
        description="Dinner"
        amount={25}
        categories={["Food"]}
        onAccept={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: uiText.transactions.suggestionButton }));
    expect(screen.getByRole('button', { name: uiText.common.loading })).toBeDisabled();

    resolveSuggestion!({
      category_id: 'c1',
      category_name: 'Food',
      confidence: 0.85,
      reason: 'Dinner appears to be food.',
    });

    await waitFor(() => {
      expect(screen.getByText('Food')).toBeInTheDocument();
    });
  });

  it('displays a successful suggestion and accepts it when requested', async () => {
    vi.spyOn(aiService, 'suggestCategory').mockResolvedValue({
      category_id: 'c1',
      category_name: 'Food',
      confidence: 0.85,
      reason: 'Dinner appears to be food.',
    });
    const onAccept = vi.fn();

    render(
      <CategorySuggestionPanel
        transactionType="EXPENSE"
        description="Dinner"
        amount={25}
        categories={["Food", "Travel"]}
        onAccept={onAccept}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: uiText.transactions.suggestionButton }));

    await waitFor(() => {
      expect(screen.getByText('Food')).toBeInTheDocument();
    });

    expect(screen.getByText(uiText.transactions.suggestionConfidenceHigh)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: uiText.transactions.suggestionAccept }));
    expect(onAccept).toHaveBeenCalledWith('Food');
  });

  it('shows low confidence when suggestion confidence is below threshold', async () => {
    vi.spyOn(aiService, 'suggestCategory').mockResolvedValue({
      category_id: 'c2',
      category_name: 'Travel',
      confidence: 0.55,
      reason: 'This is a low confidence suggestion.',
    });

    render(
      <CategorySuggestionPanel
        transactionType="EXPENSE"
        description="Taxi ride"
        amount={12}
        categories={["Food", "Travel"]}
        onAccept={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: uiText.transactions.suggestionButton }));

    await waitFor(() => {
      expect(screen.getByText(uiText.transactions.suggestionConfidenceLow)).toBeInTheDocument();
    });
  });

  it('shows an error when the provider fails', async () => {
    vi.spyOn(aiService, 'suggestCategory').mockRejectedValue(new Error('Provider error'));

    render(
      <CategorySuggestionPanel
        transactionType="EXPENSE"
        description="Taxi ride"
        amount={12}
        categories={["Travel"]}
        onAccept={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: uiText.transactions.suggestionButton }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(uiText.transactions.suggestionFailed);
    });
  });
});
