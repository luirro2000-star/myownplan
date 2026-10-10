# Checkpoint 9D / 10A audit — phone shell and calm assistant

Audit date: 2026-10-10  
Scope: mobile navigation, assistant transcript behavior, quick intents, and turn-based voice conversation.

## Outcome

**PASS for preview deployment.** Production remains unchanged pending the batched release audit.

## Requirements checked

| Requirement | Implementation evidence | Result |
| --- | --- | --- |
| Keep the daily plan primary | Desktop retains the three-column layout. At 900 px and below, planning views occupy the page while Ask Daylight becomes a floating control and focused sheet. | Pass |
| Improve mobile navigation | Five planner sections use a persistent safe-area-aware bottom bar with large targets. The compact header retains account access. | Pass |
| Stop routine actions from filling chat | Planner actions use temporary status notices. Durable action details remain in History. Conversation selection excludes explicit activity records and filters legacy automatic entries. | Pass |
| Keep conversation manageable | Four recent conversational turns show by default; an Earlier control reveals the retained conversation. Persistence remains capped at 30 turns. | Pass |
| Reduce typing | Ask Daylight offers My day changed, Low energy, and What next? intent shortcuts. | Pass |
| Remove the extra voice Send step | A final speech result stops after a short pause and is sent directly to the assistant. | Pass |
| Continue a spoken exchange | Daylight speaks the response and returns to listening until the user presses Stop, navigation changes, an error occurs, or no speech is heard. | Pass |
| Preserve schedule accuracy | Assistant proposals still require **Apply change**. The deterministic planner continues to validate and place schedule changes. | Pass |
| Preserve older saves safely | Conversation metadata is normalized from local, backup, and cloud inputs. A regression test confirms legacy activity messages leave the visible conversation. | Pass |

## Verification

- `npm test`: pass, including the new conversation-view regression test.
- `npm run build`: pass with Vite 8.3.1.
- `node --check site/app.js`: pass.
- Mobile preview inspection at 390 × 844: no horizontal overflow; bottom navigation has five equal columns, safe-area padding, and 54 px section controls; a fresh phone session starts with the 56 px assistant control collapsed; the open assistant sheet is bounded above the bottom navigation.
- Accessibility inspection: navigation retains current-page state; assistant open/close and voice state expose names and pressed/expanded values; voice status remains a polite live region.

## Limits and follow-up

- Browser speech recognition is provided by the browser and remains turn based. Daylight can automatically alternate listening and speaking, but cannot hear a user interruption while it is speaking. True interruption requires a realtime audio service.
- Microphone reliability varies by browser permission state, operating system, ambient noise, and mobile power behavior. Physical iOS and Android checks remain required before production release.
- Voice turns stop after 15 seconds or shortly after a final result. Real use should inform the silence threshold and maximum turn length.
- The preview deployment should be checked at phone width after Netlify finishes building; production should remain on checkpoint 4A until the broader release audit passes.

## Research trace

`PRODUCT_RESEARCH.md` records the reviewed product patterns and Daylight's differentiation. The interface adopts a day-first surface, protected-time scheduling, quick capture, explicit review, bottom navigation, and one-control voice turns without copying another product's visual identity.
