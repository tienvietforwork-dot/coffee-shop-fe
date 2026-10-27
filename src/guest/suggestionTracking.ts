/** Attribution for a suggestion click during this product-modal session; no personal data stored. */
export type SuggestionTracking = {
  source: 'recommendation' | 'cross-sell'
  ruleId: number
  coffeeId: number
  impressionId: string
}
