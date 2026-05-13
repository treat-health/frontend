# Client Dashboard UI/UX Change Plan

## Purpose

This document captures the requested UI/UX updates for the React frontend client dashboard and turns them into a practical, step-by-step implementation plan.

The goal is to move the dashboard toward a cleaner **enterprise-grade client experience** with:
- stronger information hierarchy,
- fewer duplicated entry points,
- route-based navigation for support content,
- better use of horizontal space,
- and a calmer, more intentional dashboard layout.

---

## Requested End State

The client dashboard should look like this:

1. **Greeting banner at the top**
   - includes greeting,
   - supporting subtitle,
   - motivational quote,
   - and **Our Mission** content directly inside the banner.

2. **Upcoming Appointments / Upcoming Sessions**
   - displayed below the banner,
   - wider and more prominent,
   - using the available right-side width instead of sharing space with the care-journey panel.

3. **Upcoming Appointment FAQs**
   - displayed below the upcoming sessions section.

4. **Sidebar becomes the main place for guidance/help resources**
   - Onboarding Guide moved into sidebar with its own route,
   - First Days Overview moved into sidebar,
   - How to Join the Appointment moved into sidebar,
   - Virtual IOP moved into sidebar,
   - Settings remains in sidebar.

---

## Current State in Code

### Main dashboard page
Current client dashboard implementation lives in:
- `src/pages/dashboard/DashboardPage.tsx`
- `src/pages/dashboard/DashboardPage.css`

### Sidebar navigation
Current sidebar logic lives in:
- `src/components/layout/Layout.tsx`

### App routes
Current route registration lives in:
- `src/App.tsx`

### Existing full-page support views
These already exist and can be reused as route pages instead of dashboard-only local views:
- `src/pages/dashboard/views/OnboardingGuideView.tsx`
- `src/pages/dashboard/views/FirstDaysView.tsx`
- `src/pages/dashboard/views/JoinGuideView.tsx`
- `src/pages/dashboard/views/VirtualIOPView.tsx`
- `src/pages/dashboard/views/OurMissionView.tsx`
- `src/pages/dashboard/views/FaqView.tsx`

### Important architectural note
Right now the dashboard uses local state:
- `mission`
- `onboarding`
- `first-days`
- `join-guide`
- `virtual-iop`
- `faq`

These views are opened from `DashboardPage.tsx` using `activeView` instead of proper URL routes.

For an enterprise-level UX, the support content should be moved to **real routes** so it is:
- bookmarkable,
- shareable,
- visible in browser history,
- easier to test,
- easier to access from sidebar navigation.

---

## Recommended Route Structure

Use a clean and scalable route family for client guidance pages.

### Recommended routes
- `/guides/onboarding`
- `/guides/first-days`
- `/guides/join-appointment`
- `/guides/virtual-iop`

### Optional route
- `/guides/faq`

### Recommendation about Our Mission
Do **not** keep `Our Mission` as a separate dashboard shortcut card.
Instead, embed a concise version directly in the greeting banner.

Optional future enhancement:
- keep a secondary deep-dive page like `/about/mission` only if the business wants a dedicated brand story page.

For this phase, embedding it in the hero banner is the cleaner choice.

---

## Change 1 — Expand the Greeting Banner and Merge Our Mission into It

### Objective
Increase the height of the greeting banner so it can comfortably contain:
- greeting text,
- subtitle,
- motivational quote,
- and a short **Our Mission** block beneath the quote.

### Why this is the right UX move
This reduces dashboard fragmentation.
Right now "Our Mission" behaves like a separate action card, but it is actually brand/context content, not a primary task.

Moving it into the hero banner makes the page feel:
- more intentional,
- more premium,
- less card-heavy,
- and more emotionally aligned with healthcare/wellness experiences.

### Implementation direction
Update `DashboardPage.tsx` hero section to include a mission content block below the quote.

### Recommended content structure inside hero
1. Greeting title
2. Supporting subtitle
3. Motivational quote
4. Mission label or micro-heading
5. 2–4 mission lines

### Suggested content pattern
- **Greeting:** Welcome back, [First Name]
- **Subtitle:** Your wellness journey continues. Here’s what’s ahead today.
- **Quote:** existing quote of the day
- **Mission label:** Our Mission
- **Mission text:** short 2–4 line summary from the existing mission page

### Visual recommendations
- Increase hero minimum height from current `160px` to roughly `260px–340px` depending on spacing.
- Use a darker image overlay or gradient layer so the additional text remains readable.
- Shift image positioning slightly upward/right if needed so the subject remains visible after increasing height.
- Constrain text width for readability.
- Keep quote and mission visually distinct using subtle containers or spacing separation.

### CSS areas likely to change
In `DashboardPage.css`:
- `.dashboard-hero-card`
- `.dashboard-hero-bg`
- `.dashboard-hero-copy`
- `.dashboard-hero-subtitle`
- `.dashboard-hero-quote-shell`
- add new classes such as:
  - `.dashboard-hero-mission`
  - `.dashboard-hero-mission-label`
  - `.dashboard-hero-mission-text`

### Acceptance criteria
- Hero is visibly taller and balanced.
- Mission content fits naturally under the quote.
- Background image scales cleanly with new height.
- Text remains readable on desktop and mobile.
- Dashboard no longer needs a separate `Our Mission` shortcut card.

---

## Change 2 — Move Onboarding Guide to the Sidebar With a Dedicated Route

### Objective
Remove Onboarding Guide from dashboard highlight cards and expose it in sidebar navigation instead.

### Why this improves UX
Onboarding Guide is support/navigation content, not a dashboard KPI or priority action.
In enterprise products, persistent educational resources should live in stable navigation rather than floating dashboard cards.

### Recommended sidebar label
- `Onboarding Guide`

### Recommended icon
Use an icon aligned with learning/help, such as:
- `BookOpen`
- or `HelpCircle`

### Recommended route
- `/guides/onboarding`

### Implementation direction
1. Add new protected route in `App.tsx`.
2. Add navigation item in `Layout.tsx` for client role.
3. Stop rendering the Onboarding Guide dashboard card in `DashboardPage.tsx`.
4. Render `OnboardingGuideView` as a route page instead of only from local dashboard state.

### UX recommendation
If sidebar starts to feel crowded, group these links under a sidebar section label such as:
- `Resources`
- or `Care Journey`

If grouped sections are too much for this phase, keep them as standard items for now and group later.

### Acceptance criteria
- Onboarding Guide opens from sidebar.
- Page has its own URL.
- Browser refresh works on that page.
- Dashboard no longer shows Onboarding Guide as a top card.

---

## Change 3 — Remove “Start Your Care Journey” Panel and Move Its Actions to Sidebar

### Objective
Remove the right-side card/panel called **Start Your Care Journey** and move its buttons into sidebar navigation.

### Items to move
- First Days Overview
- How to Join the Appointment
- Virtual IOP
- Settings stays where it already is

### Recommended routes
- `/guides/first-days`
- `/guides/join-appointment`
- `/guides/virtual-iop`

### Why this improves UX
The current panel competes with the Upcoming Sessions card for space.
Those actions are not time-sensitive enough to occupy prime dashboard real estate.

By moving them to sidebar:
- the dashboard becomes simpler,
- sessions get more room,
- support resources become consistently discoverable,
- navigation becomes more predictable.

### Implementation direction
#### In `DashboardPage.tsx`
- Remove the whole `Start Your Care Journey` card.
- Remove local button handlers tied to `setActiveView('first-days')`, `setActiveView('join-guide')`, and `setActiveView('virtual-iop')`.

#### In `Layout.tsx`
For client role, add new navigation entries for:
- First Days Overview
- How to Join Appointment
- Virtual IOP

### Recommended sidebar order for client role
1. Dashboard
2. My Appointments
3. Onboarding Guide
4. First Days Overview
5. How to Join Appointment
6. Virtual IOP
7. Support
8. Messages
9. Settings

### Enterprise UX note
If you want a cleaner long-term pattern, create a grouped sidebar section like:

- **Care Journey**
  - Onboarding Guide
  - First Days Overview
  - How to Join Appointment
  - Virtual IOP

This is the more scalable option if more client education pages will be added later.

### Acceptance criteria
- Right-side care journey card is removed.
- All three resources are accessible from sidebar.
- Each resource has its own route.
- Layout feels less crowded and more task-focused.

---

## Change 4 — Make Upcoming Sessions Wider and More Dominant

### Objective
Give the Upcoming Sessions section more width so it better uses the page and becomes the main operational focus below the hero.

### What the user is asking for in practical terms
Currently, the dashboard uses a two-column card layout where:
- left = Upcoming Sessions
- right = Start Your Care Journey

After removing the right panel, Upcoming Sessions should expand and occupy the available width.

### Recommended layout change
Replace the current two-card grid with a more focused vertical stack:

1. Hero banner
2. Full-width Upcoming Sessions card
3. FAQ banner/card

### Why this is better
This aligns the dashboard with the user’s real priority:
- what is next,
- when it is happening,
- how to join/get help.

It also improves scanability and reduces visual competition.

### Implementation direction
In `DashboardPage.tsx`:
- remove the current two-column wrapper used for Upcoming Sessions + Care Journey.
- render Upcoming Sessions in a standalone full-width card.
- keep FAQ below it.

In `DashboardPage.css`:
- add a dedicated wrapper for dashboard flow if needed, for example:
  - `.dashboard-main-stack`
  - `.dashboard-upcoming-card`

### Optional improvement
Enhance the Upcoming Sessions card for a stronger enterprise feel:
- show session status pill,
- separate date/time visually,
- add empty-state illustration polish,
- add “View all appointments” link in section header.

### Acceptance criteria
- Upcoming Sessions occupies substantially more horizontal space.
- It sits directly below the hero banner.
- FAQ sits below Upcoming Sessions.
- No competing right-side resource panel remains.

---

## Final Target Layout

### Desktop structure
1. Greeting + quote + mission hero banner
2. Full-width Upcoming Sessions card
3. FAQ banner/card

### Mobile structure
1. Hero banner stacks naturally
2. Upcoming Sessions full width
3. FAQ full width
4. Sidebar routes remain accessible through standard mobile nav behavior

---

## Suggested Implementation Sequence

Follow this order to reduce rework.

### Phase 1 — Hero banner redesign
- Move mission content into hero
- remove mission dashboard card
- update hero spacing and background behavior

### Phase 2 — Route infrastructure
- add client guide routes in `App.tsx`
- reuse existing view components as route pages

### Phase 3 — Sidebar expansion
- add Onboarding Guide, First Days Overview, How to Join Appointment, Virtual IOP to client nav in `Layout.tsx`

### Phase 4 — Dashboard simplification
- remove Onboarding Guide card
- remove Start Your Care Journey panel
- make Upcoming Sessions full width
- keep FAQ below it

### Phase 5 — Polish pass
- responsive spacing
- hover/focus states
- active nav highlighting
- accessibility labels
- content consistency across all guide pages

---

## Enterprise-Level UX Recommendations

These are not mandatory for the requested change, but they would improve the experience.

### 1. Use a sidebar section label for non-core pages
Instead of mixing task pages and educational pages equally, consider a visual section such as:
- Main
- Care Journey
- Account

This improves information scent and prevents nav clutter.

### 2. Keep dashboard focused on current action, not all resources
A mature healthcare dashboard should prioritize:
- upcoming care events,
- urgent actions,
- quick reassurance,
- and only then educational resources.

That is exactly why moving guide content to sidebar is the right direction.

### 3. Make the hero emotionally supportive but operationally useful
A good healthcare hero should not feel like marketing-only content.
Balance warmth with clarity:
- one welcoming line,
- one practical subtitle,
- one quote,
- one concise mission block.

Avoid making the hero too text-heavy.

### 4. Keep FAQ as a strong secondary support surface
The FAQ banner is useful because it gives quick reassurance.
If usage grows later, consider turning it into:
- a dedicated route page,
- searchable FAQ,
- or accordion-based help center.

### 5. Prefer route-based content over modal/dashboard-only content
This is a major enterprise best practice.
Route-based pages are better for:
- accessibility,
- deep linking,
- QA,
- analytics,
- browser navigation,
- and future scale.

---

## Files Expected to Change During Implementation

### Core files
- `src/pages/dashboard/DashboardPage.tsx`
- `src/pages/dashboard/DashboardPage.css`
- `src/components/layout/Layout.tsx`
- `src/App.tsx`

### Route page wrappers or reused views
Potentially reuse as-is or lightly adapt:
- `src/pages/dashboard/views/OnboardingGuideView.tsx`
- `src/pages/dashboard/views/FirstDaysView.tsx`
- `src/pages/dashboard/views/JoinGuideView.tsx`
- `src/pages/dashboard/views/VirtualIOPView.tsx`
- `src/pages/dashboard/views/FaqView.tsx`

### Possible optional new files
If cleaner architecture is preferred, add route wrapper pages such as:
- `src/pages/guides/OnboardingGuidePage.tsx`
- `src/pages/guides/FirstDaysPage.tsx`
- `src/pages/guides/JoinAppointmentGuidePage.tsx`
- `src/pages/guides/VirtualIOPPage.tsx`

This is optional, but recommended if you want to separate “dashboard view components” from “route pages.”

---

## QA Checklist

Before marking this work complete, verify:

### Hero section
- [ ] Greeting banner is taller and visually balanced
- [ ] Quote and mission are both readable
- [ ] Background image scales correctly
- [ ] No text overlap on tablet/mobile

### Navigation
- [ ] Onboarding Guide appears in sidebar
- [ ] First Days Overview appears in sidebar
- [ ] How to Join Appointment appears in sidebar
- [ ] Virtual IOP appears in sidebar
- [ ] Active sidebar state works correctly

### Routing
- [ ] Each guide page loads directly by URL
- [ ] Refreshing a guide page does not break navigation
- [ ] Browser back button works correctly

### Dashboard layout
- [ ] Our Mission card is removed from dashboard
- [ ] Onboarding Guide card is removed from dashboard
- [ ] Start Your Care Journey panel is removed
- [ ] Upcoming Sessions is wider/full width
- [ ] FAQ sits below Upcoming Sessions

### Accessibility and polish
- [ ] Focus states remain visible for keyboard users
- [ ] Buttons/links have clear labels
- [ ] Spacing is consistent
- [ ] Sidebar does not feel overcrowded

---

## Recommended First Implementation Task

Start with this exact slice first:

1. Expand the hero banner.
2. Move mission copy into it.
3. Remove the `Our Mission` card.
4. Leave routing/sidebar work for the next step.

This gives the biggest immediate visual win with the lowest architectural risk.

---

## Summary

This change should transform the client dashboard from a **multi-card mixed-purpose layout** into a more focused structure:
- a richer welcome banner with mission built in,
- a larger and more useful upcoming sessions area,
- FAQ below for reassurance,
- and sidebar-based guidance pages for long-term scalability.

This is the right direction for a calmer, more professional, and more enterprise-ready client experience.
