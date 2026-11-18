# Portrait Desktop verification

**Verdict**: FAIL
**After fixes**: finding closed (6e5c676); `validate_verification.py` exits 0
**Proofs**: `proofs.md` at 3044adc
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/mobile/phone.test.ts` `prt_01 no sideways page scroll on portrait desktop windows` | yes |
| C2 | `tests/mobile/phone.test.ts` `prt_02 compact header and fixed bottom tab bar on portrait desktop` | yes |
| C3 | `tests/mobile/phone.test.ts` `prt_03 stadium full-width panel, square clock and fixed play on 9:16 desktop` | yes |
| C4 | `tests/mobile/phone.test.ts` `prt_04 editor single column, transport bar, one-row palette and sticky grid on portrait desktop` | yes |
| C5 | `tests/mobile/phone.test.ts` `prt_05 touch targets 44 px, step cells 32 px and fields 16 px on portrait desktop` | no - never edits a step to open `#save-toast`, so `#btn-save` stays hidden (`68.9 × 33 px` when visible) |
| C6 | `tests/mobile/phone.test.ts` `prt_06 last element clears the fixed bars on portrait desktop` | yes |
| C7 | `tests/mobile/phone.test.ts` `prt_07 desktop windows wider than 3:4 keep the desktop layout` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Save button (`#btn-save`) in `#save-toast` is `33 px` tall on portrait desktop and `prt_05` does not open it | `src/ui/index.css:2267-2275` omits `.btn-save` from `min-height: 44px`; `tests/mobile/phone.test.ts:920-952` never edits a step to show `#save-toast`. Headless Chrome probes after clicking `.step-cell` at `768 × 1024`, `900 × 1600`, `1080 × 1920` and `1440 × 2560` measured `#btn-save` at `68.9 × 33 px`. | Add `.btn-save` to the `min-height: 44px` rule inside `@media (max-width: 767px), (max-aspect-ratio: 3/4)` in `src/ui/index.css`, and edit a step in `prt_05` (after loading `song:song_battery`) so `#save-toast` is visible when `targets()` runs. | 6e5c676 - .btn-save gets min-height: 44px and prt_05 edits a step to open #save-toast |
