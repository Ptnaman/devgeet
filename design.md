# DevGeet Design Guide

This file records the current visual rules for the DevGeet Expo SDK 57 app. New UI should follow the existing theme, typography, navigation, and component architecture instead of introducing a separate design system.

## Product direction

- Keep the interface simple, content-first, and easy for new users.
- Use short labels and directly visible primary actions.
- Preserve light and dark theme support through `useAppTheme()` and the shared values in `src/constants/theme.ts`.
- Respect header, bottom-tab, sheet, keyboard, and Android navigation safe areas.

## Layout and spacing

- Use shared `SPACING` values for page padding and gaps.
- Prefer `gap` and container padding over scattered margins.
- Main feed screens use responsive scroll or virtualized list components from `src/components/main-tabs/`.
- Use `useWindowDimensions()` for responsive measurements.

## Corners

- Featured Home carousel images: `16:9`, `4px` radius.
- Home category cards: `4px` radius.
- User-facing post cards: `9px` outer radius.
- Pills, icon buttons, inputs, sheets, and other controls continue using the appropriate shared `RADIUS` token.

## Images

- Render remote images with `expo-image`.
- Use `REMOTE_IMAGE_PLACEHOLDER`, `REMOTE_IMAGE_TRANSITION_MS`, `placeholderContentFit="cover"`, and `cachePolicy="memory-disk"`.
- Category grid cards display the category `imageUrl`; show the category initial when no image is available.
- Keep image aspect ratios stable so content does not jump while loading.

## Post cards

- Show the image first, followed by title and essential metadata.
- Keep bookmark actions visible on the image's top-right corner.
- Do not show a bookmark action on the Home auto-scrolling Featured carousel.
- Use concise previews and avoid decorative descriptions.

## Bookmarks and collections

- `Favorite` is the default collection and appears first.
- Custom collections appear below Favorite.
- Creating, renaming, and deleting a custom collection must remain obvious and reversible where possible.
- Deleting a custom collection must not delete posts from Favorite.
- Use the shared Expo UI collection sheet rather than creating screen-specific collection dialogs.

## Navigation

- Native mobile tabs use Expo Router `NativeTabs`.
- Keep Home, Categories, Bookmarks, and Settings visible.
- Web may use its platform-specific tabs layout.
- Route headers and titles belong in Expo Router layouts.

## Typography and accessibility

- Use the existing Google Sans font mapping from `src/lib/typography.ts`.
- Maintain readable contrast and touch targets of approximately 44px where practical.
- Add accessibility roles, labels, states, and useful hit slop to interactive controls.
- Important error and data text should be selectable where appropriate.

## Validation

After UI changes, run targeted ESLint, `npx tsc --noEmit --pretty false`, and `git diff --check`. An Expo export verifies bundling but does not replace physical-device testing.
