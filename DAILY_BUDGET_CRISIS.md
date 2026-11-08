# Daily Budget Crisis

## User experience

This short, optional, daily challenge is separate from the existing fiscal-year campaign. From the title screen choose **Daily Budget Crisis**:

1. Read the daily dossier. The UTC calendar day (not local timezone) determines a public FNV-1a seed, one combat theater/objective and a fixed doctrine. All players with the same day see the same scenario and opening loadout.
2. Fight a **60-second** defense, including existing weapon range, reload and allied-courier constraints. First-time combat training still appears once per installation.
3. Review the combat grade and select one strategy:
   - Fast-track: lose 8 active-theater readiness, increase the doctrine's profit multiplier by 0.35.
   - Oversight: restore up to 8 active readiness, decrease the multiplier by 0.15 (minimum 0.5).
4. Play the actual Three/Rapier procurement pinball with **two balls** rather than three and a visible **150-second active-play deadline** (the timer pauses while the hearing is paused). At the deadline the player may authorize the accrued contract or leave without it.
5. Review the local-only dossier, share or copy real results, retry the same daily challenge, or return to campaign.

Players may retry as often as they like. An early combat exit is permitted but cannot set a daily personal best. Defeats cannot set a best. Skipping authorization is permitted but forgoes procurement score points. The mode does not load ads or require payment.

## Isolation and reliability

`beginDaily()` saves the current campaign and begins a scratch `RunState`; while `dailyActive=true`, `RunState.save()` refuses to overwrite `warrr_save_v1`. `finishDaily()` writes only `warrr_daily_best_v1` and restores the saved campaign. Pausing and quitting daily combat, abandoning policy, returning from the result, and TitleScene safeguards all restore campaign state. A hard page reload ends an incomplete daily attempt, after which normal campaign loading proceeds unchanged.

Daily results do **not** enter `warrr_leaderboard_v1`. The record is stored locally, can be tampered with on-device, and must not be described as a global ranking. Only the best eligible score per UTC day is kept; history is bounded to 60 days and malformed local data is ignored.

## Verification checklist (must complete before merge/publication)

- Start from a real saved campaign (FY > 2026; include weapons, estate ledger and pending deliveries). Play and quit daily in combat; verify the exact campaign values/saved JSON remain intact.
- Finish daily normally, authorize a contract, return to title and verify the campaign save is unchanged; replay and discard the contract, verifying local best logic.
- Kill the active theater in daily combat; confirm result is defeat, has no best eligibility, and restoration happens without modifying campaign Hall of Fame.
- Use Early Exit: verify daily result cannot register a best.
- Restart app mid-daily; confirm no scratch state is mistakenly loaded from campaign save.
- On two different browser/device timezones, verify the same UTC calendar day produces the same seed, scenario and doctrine. Check midnight UTC rollover.
- Verify touch input and readable text at 360×800 and 390×844, Android WebView, Chrome and embedded itch.io iframe. Test pinball physical flipper input and audio resume after interruption.
- Check realistic session length, actual fresh-player comprehension and fun, and repeat retention before spending on ads.

Existing tests cover daily date/seed, score/best rules, campaign save isolation, one-shot policy, and restoration. These are code-level tests, not device or human gameplay results.

## Remaining fairness limitations

Deterministic daily seed fixes combat scenario, doctrine and seeded combat random selection. Pinball physics are not seed-locked to identical trajectories; player skill, timing and device physics can differ. There is no account identity, server clock or authoritative score verification. Add those only if a real competitive leaderboard is justified.
