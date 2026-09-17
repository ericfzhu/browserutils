# Extension color system

The extension retains Classic Blue and Monochrome, each with independently defined light and dark colors. The design uses quiet page canvases, raised card/popover surfaces, readable secondary text, a clear primary action, restrained borders, and small rounded controls. Color roles live in `src/styles/index.css`; Tailwind maps them in `tailwind.config.js`.

Run `node_modules/.bin/vite --host 127.0.0.1` and open `/design.html` for the interactive component catalogue. This development-only entry is excluded from the extension build. It uses the real shared components and explicitly labelled sample activity data, without reading browser history or requiring Chrome APIs.

| Role | Components and states |
| --- | --- |
| background / foreground | Page canvas, blocked page, default text, native controls |
| card / card-foreground | Dashboard panels, popup sections, lists, empty states |
| popover / popover-foreground | Select menus and dialogs, including portalled content |
| primary / primary-foreground | Main buttons, selected navigation, checked controls, progress, inverted text |
| secondary / muted / accent | Secondary buttons, tracks, skeletons, disabled surfaces, hover and selected rows |
| muted-foreground | Descriptions, placeholders, metadata, secondary icons |
| border / input / ring | Dividers, form boundaries, focus outlines and validation states |
| success / success-subtle | Saved and enabled confirmations |
| warning / warning-subtle | Approaching limits and partially enabled groups |
| danger / danger-subtle | Blocking status, errors, destructive actions and exceeded limits |
| info / info-subtle | Focus/session informational states |
| overlay | Modal scrim, shared by Radix and existing custom dialogs |
| series-* | Category swatches, domain charts and timelines, with the same hue identities across modes |
| sidebar-* | Navigation surface, borders, selection and hover |

All status colors pair strong text with a subtle fill. Meaning must also appear in a label or icon. Data categories retain their hue identity even in Monochrome; monochrome refers to the interface chrome. Existing custom category identifiers remain usable. QR artwork deliberately uses fixed dark modules on white. Palette picker swatches deliberately show the palette being selected.

Opacity modifiers (`bg-primary/10`, `ring-ring/45`, etc.) use color-mix through the Tailwind token helper; tokens contain complete OKLCH colors. Do not reintroduce separate literal light/dark color classes in product components. Use semantic roles, and give any new role values in both modes.

Native form controls and scrollbars follow `color-scheme`. Selection, focus, disabled, invalid, checked, unchecked, hover and modal states are covered. Reduced-motion preferences shorten transitions. Theme settings propagate through Chrome storage changes to all open extension pages; system mode follows OS changes and detaches its listener in explicit light/dark mode. React renders after the initial preference read.

Validation: production build, TypeScript, theme lifecycle regression tests, and browser checks of the component catalogue in all four combinations. Screenshots are under `output/playwright/`. The four status text/fill pairs meet 4.5:1 contrast in all four combinations in the rendered browser check. This is not a full WCAG audit or an end-to-end test of installed-extension tracking.
