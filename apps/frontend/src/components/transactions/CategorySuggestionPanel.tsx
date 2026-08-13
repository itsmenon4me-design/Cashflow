"use client";

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { uiText } from '@/locales';
import { aiService } from '@/services/ai.service';
import type { SuggestCategoryResponse } from '@/types/backend';

interface CategorySuggestionPanelProps {
  transactionType: 'INCOME' | 'EXPENSE';
  description?: string;
  amount?: number;
  categories: string[];
  onAccept: (categoryName: string) => void;
}

export function CategorySuggestionPanel({
  transactionType,
  description,
  amount,
  categories,
  onAccept,
}: CategorySuggestionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestCategoryResponse | null>(null);

  const confidenceLabel = useMemo(() => {
    if (!suggestion) {
      return null;
    }
    if (suggestion.confidence >= 0.8) {
      return uiText.transactions.suggestionConfidenceHigh;
    }
    if (suggestion.confidence >= 0.6) {
      return uiText.transactions.suggestionConfidenceMedium;
    }
    return uiText.transactions.suggestionConfidenceLow;
  }, [suggestion]);

  const handleSuggest = async () => {
    if (categories.length === 0) {
      setError(uiText.transactions.suggestionNoCategories);
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const result = await aiService.suggestCategory({
        description: description?.trim() || undefined,
        amount: amount ?? undefined,
        transaction_type: transactionType,
      });
      setSuggestion(result);
    } catch {
      setError(uiText.transactions.suggestionFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onAccept(suggestion.category_name);
    }
  };

  const handleDismiss = () => {
    setSuggestion(null);
    setError(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{uiText.transactions.suggestionTitle}</p>
          <p className="text-sm text-muted-foreground">
            {uiText.transactions.suggestionHint}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading || categories.length === 0}
          onClick={handleSuggest}
        >
          {loading ? uiText.common.loading : uiText.transactions.suggestionButton}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      {suggestion ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{suggestion.category_name}</p>
            <p>
              {uiText.transactions.suggestionConfidenceLabel}{' '}
              <span className="font-medium">{confidenceLabel}</span>
              {' · '}
              {suggestion.confidence.toFixed(2)}
            </p>
            {suggestion.reason ? <p>{suggestion.reason}</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={handleAccept}>
              {uiText.transactions.suggestionAccept}
            </Button>
            <Button type="button" variant="outline" onClick={handleDismiss}>
              {uiText.common.cancel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
