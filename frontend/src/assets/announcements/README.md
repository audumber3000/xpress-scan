# Announcement pictures

**Nothing here is required.** Every announcement in `components/announcements/registry.jsx`
names an `art` scene, drawn as inline SVG in `AnnouncementArt.jsx`, so a release
note can ship the day it is written without waiting on a designer.

A real screenshot still beats a drawing for a specific feature: the drawing says
"notifications", a screenshot says "*your* notifications". Dropping a file here
is an upgrade, not a repair.

## The drawn scenes that already exist

| Scene | Shows | Used by |
|---|---|---|
| `notifications` | a bell over a list of alerts | the release note |
| `rating` | five stars, the last one unfilled | the Microsoft Store review ask |
| `phone` | a phone showing a day's schedule | both mobile-app entries |
| `desktop` | a laptop with the app open | the desktop download |
| `pricing` | three plan cards, middle one raised | the plan-change announcement |

Add a scene by writing one more function in `AnnouncementArt.jsx` and listing it
in `SCENES`. Keep to the brand palette (`#2a276e`, `#9B8CFF`, `#29828a`,
`#F59E0B`) on the shared indigo ground, or the set stops reading as a family.

## Replacing one with a real screenshot

```js
import whatsNew from '../../assets/announcements/whats-new-2026-08.png';

// in registry.jsx, on the entry:
image: whatsNew,   // takes precedence over `art`
```

Nothing else changes. The modal already moves the headline below the header
whether that header is a drawing or a photograph.

## Specification for real images

- **16:9**, at least **1200 x 675**. The modal renders at 448px wide and crops
  with `object-cover`, so keep the subject centred.
- **PNG** for screenshots, **JPG** for photographs. Under 300 KB: these are
  bundled by Vite and ship to every user on every load.
- **No text baked into the picture.** The headline and body sit underneath and
  are the only part anybody reads. Text in an image cannot be corrected without
  a redeploy and goes blurry on a phone.
- **Use real screens.** A mock-up of a screen that does not exist is the fastest
  way to make a release note read like an advert.
