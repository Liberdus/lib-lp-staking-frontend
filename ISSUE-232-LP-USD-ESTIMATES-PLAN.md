# Issue 232: LP USD Estimates in Staking Modal

## Goal

Show USD estimates for LP token amounts in the staking modal using only the LP token price implied by the existing pair TVL data.

```js
lpUsdPrice = currentPair.tvlUsd / currentPair.tvl;
```

Do not add new input-token pricing for zap flows in this issue.

## Current Shape

The work is concentrated in `js/components/staking-modal-new.js`.

- Stake and unstake balances are rendered in `renderStakeTab()` and `renderUnstakeTab()`.
- Zap quote rows are rendered in `renderZapQuotePanel()`.
- Stake and unstake live input changes flow through document-level input listeners, per-tab input listeners, percentage buttons, and sliders.
- Existing tests for this component live in `tests/staking-modal-new.test.js`.

The existing event paths already cover the requested interactions. The implementation should add small calculation and DOM update helpers, then call those helpers from the current update hooks.

## Placement Summary

In this repo, "staking modal" means the tabbed modal component, not only the Stake tab. Issue 232 should place LP USD estimates in these locations:

- Zap tab: the existing `Estimated LP` quote row.
- Stake tab: the user's available LP balance row.
- Stake tab: a live estimate under the `Amount to Stake` input.
- Unstake tab: the user's staked LP balance row.
- Unstake tab: a live estimate under the `Amount to Unstake` input.

Zap placement target:

```html
<div class="zap-quote-row">
    <dt>Estimated LP</dt>
    <dd>12.345 LP ($123.45)</dd>
</div>
```

Stake balance placement target:

```html
<div class="balance-info">
    <span class="balance-label">Available LP Tokens:</span>
    <span class="balance-value">12.345 LP <span class="lp-usd-estimate">($123.45)</span></span>
</div>
```

Stake input placement target:

```html
<input id="stake-amount-input" class="form-input">
<div id="stake-usd-estimate" class="lp-usd-estimate" aria-live="polite">$123.45</div>
```

Unstake balance placement target:

```html
<div class="balance-info">
    <span class="balance-label">Staked LP Tokens:</span>
    <span class="balance-value">12.345 LP <span class="lp-usd-estimate">($123.45)</span></span>
</div>
```

Unstake input placement target:

```html
<input id="unstake-amount-input" class="form-input">
<div id="unstake-usd-estimate" class="lp-usd-estimate" aria-live="polite">$123.45</div>
```

## Phase 1: Add LP USD Helpers

Add focused helpers on `StakingModalNew`.

```js
getLpUsdPrice()
```

Responsibilities:

- Read `this.currentPair?.tvlUsd`.
- Read `this.currentPair?.tvl`.
- Convert both to numbers.
- Return `null` unless both are finite and `tvl > 0`.
- Return `tvlUsd / tvl` when valid.

```js
getLpUsdEstimate(amount)
```

Responsibilities:

- Parse the LP token amount.
- Use `getLpUsdPrice()`.
- Return `null` unless the amount and LP USD price are valid.
- Return `amount * lpUsdPrice` when valid.

```js
formatLpUsdEstimate(amount)
```

Responsibilities:

- Use `getLpUsdEstimate(amount)`.
- Return `N/A` when the estimate is unavailable.
- Prefer `window.Formatter?.formatCurrency(estimate)`.
- Fall back to `$${estimate.toFixed(2)}`.

## Phase 2: Render Static Balance Estimates

Update the stake balance row to keep the existing LP amount visible and add its USD estimate.

Target:

```js
renderStakeTab()
```

Example display shape:

```html
<span class="balance-value">
  12.345 LP <span class="lp-usd-estimate">($123.45)</span>
</span>
```

Update the unstake balance row the same way.

Target:

```js
renderUnstakeTab()
```

If the LP USD estimate is unavailable, use the same fallback everywhere, for example:

```html
<span class="lp-usd-estimate">(N/A)</span>
```

## Phase 3: Add Live Input Estimates

Add a small display target under the stake amount input.

Target:

```js
renderStakeTab()
```

Example:

```html
<div id="stake-usd-estimate" class="lp-usd-estimate" aria-live="polite">
  N/A
</div>
```

Add the equivalent unstake display target.

Target:

```js
renderUnstakeTab()
```

Example:

```html
<div id="unstake-usd-estimate" class="lp-usd-estimate" aria-live="polite">
  N/A
</div>
```

Add DOM update helpers.

```js
updateStakeUsdEstimate()
```

```js
updateUnstakeUsdEstimate()
```

Each helper should:

- Find the corresponding DOM element.
- Use `formatLpUsdEstimate(this.stakeAmount)` or `formatLpUsdEstimate(this.unstakeAmount)`.
- Write the formatted result as text content.

Call these helpers from all current amount update paths:

- Document-level `stake-amount-input` listener.
- Document-level `unstake-amount-input` listener.
- Per-tab stake input listener in `attachTabEventListeners()`.
- Per-tab unstake input listener in `attachTabEventListeners()`.
- `setPercentage()`.
- `updateAmountFromSlider()`.
- `clearInputs()`.

## Phase 4: Add Zap Quote Estimate

Update the `Estimated LP` row in the zap quote panel.

Target:

```js
renderZapQuotePanel()
```

The quote already extracts an LP amount from the Kyber response and formats it as an LP token quantity. Reuse that amount for USD estimation before display.

Example display shape:

```js
lpResultDisplay = `${lpAmountDisplay} (${this.formatLpUsdEstimate(lpAmount)})`;
```

Keep the existing LP quantity visible. If the LP amount or LP USD price is unavailable, keep the LP quantity and show the consistent fallback:

```txt
12.345 LP (N/A)
```

## Phase 5: Minimal Styles

Add a small, subdued style for USD estimates in `css/staking-modal.css`.

```css
.lp-usd-estimate {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: var(--font-weight-medium);
}
```

If the estimate is inline inside `.balance-value`, keep it from overpowering the LP amount. If it is rendered below an input, use a small top margin.

## Phase 6: Tests

Add focused tests in `tests/staking-modal-new.test.js`.

Helper tests:

```js
getLpUsdPrice()
getLpUsdEstimate()
formatLpUsdEstimate()
```

Cases:

- Valid `tvlUsd` and `tvl` returns the expected LP USD price.
- Missing `tvlUsd` returns `null` or `N/A`.
- Missing `tvl` returns `null` or `N/A`.
- Zero `tvl` returns `null` or `N/A`.
- Non-numeric values return `null` or `N/A`.

Render/update path tests:

- Zap quote panel shows USD beside `Estimated LP`.
- Stake tab shows USD beside available LP balance.
- Stake input USD estimate updates after typing or calling the update helper.
- Stake percentage button path updates the stake USD estimate.
- Unstake tab shows USD beside staked LP balance.
- Unstake slider or percentage path updates the unstake USD estimate.

## Suggested Implementation Order

1. Add calculation and formatting helpers.
2. Add static stake and unstake balance display estimates.
3. Add live stake and unstake input display targets and update helpers.
4. Wire the update helpers into existing input, percentage, slider, and clear paths.
5. Add zap quote estimate display.
6. Add tests.
7. Run:

```sh
npm test -- tests/staking-modal-new.test.js
```

## Risk Notes

- The modal currently has duplicate stake and unstake input listeners. Missing either path can create inconsistent live updates.
- `currentPair.tvl` appears to represent LP token count after TVL calculation. The helper should not use `totalStaked` unless the issue scope changes.
- Avoid new zap input-token USD pricing. Zap USD estimate should only apply to the resulting LP amount.
- Keep `N/A` behavior consistent across zap, stake, and unstake when LP USD price cannot be derived.
