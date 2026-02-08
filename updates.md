# Updates

## February 8, 2026

### Enhanced Monte Carlo Fixes
- Corrected log-normal calibration to center on the geometric mean (full volatility drag) so Enhanced MC is meaningfully more conservative than standard MC.
- Clarified enhanced model behavior and interpretation guidance in METHODOLOGY.md.

### Enhanced Monte Carlo Comparison
- Added an opt-in Enhanced Monte Carlo mode that uses log-normal returns with AR(1) mean reversion.
- Standard Monte Carlo remains the default; enhanced mode runs in parallel and results are shown side-by-side.
- Added configuration defaults for enhanced autocorrelation (phi = -0.10) and safe bounds.

### Core Logic
- Added a new return generator to support mean-reverting, log-normal returns.
- Monte Carlo simulation now accepts a custom return generator and resets its state each iteration.
- Guardrail calculator now supports an enhanced simulation path and enhanced target-spending search.
- Worker now returns both standard and enhanced results when enabled.

### UI and Results
- Added an Advanced Simulation Options panel with an enable toggle and autocorrelation slider.
- Added a comparison banner plus enhanced results and statistics sections.
- Projection chart overlays enhanced percentiles using dashed lines for clarity.
- Updated the calculate button label when enhanced mode is enabled.

### Persistence and Sharing
- Enhanced MC settings are included in localStorage and shareable URLs.

### Documentation
- Expanded METHODOLOGY.md to explain the enhanced model, rationale, and interpretation guidance.
