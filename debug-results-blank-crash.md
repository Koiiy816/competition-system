# Debug Session: results-blank-crash

## 1. Issue Description
- **Symptom**: The `/results` page shows a completely blank screen (white screen) after the user enters scores.
- **Expected**: The page should render the results list and rankings correctly.
- **Context**: Occurred after updating the rendering logic to support `finalScore`, handle empty scores, and format team members.

## 2. Hypotheses
1. **Hypothesis 1 (Null/Undefined Property Access)**: A property like `result.participant.teamMembers` is accessed with `.map()` but is not an array, causing a `TypeError`.
2. **Hypothesis 2 (toString on Null)**: `result.score` or `result.finalScore` is `null`, and a method like `.toString()` is called on it without proper optional chaining, or `typeof null === 'object'` is causing an issue.
3. **Hypothesis 3 (Invalid React Child)**: An object is being rendered directly in JSX (e.g., `result.score` when it's an unexpected object format, or `ranking.score`).

## 3. Instrumentation Plan
- Add a `window.onerror` and `window.onunhandledrejection` listener in `ResultsPage.jsx` to catch the exact React rendering error and log it to the Debug Server.
- Start the Debug Server to receive the error stack trace.

## 4. Execution Log
- [OPEN] Session started.
