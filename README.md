# SeatView

See your seat before you buy it. A web platform where customers explore a venue in 3D, pick an exact seat,
and look around from that seat at eye height before booking.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## What works (Phase 1)

- **3D venue explorer**: a 3-tier, ~45,000-seat stadium with its surroundings. Drag to orbit, scroll to zoom.
- **Hover prices**: hover any block to see its stand, tier, price and seats left.
- **Tier filter**: All / Lower / Middle / Upper.
- **Fly-in**: click a block and the camera flies to it; free and taken seats are shown.
- **Seat view**: click a free seat and the camera sits you in it at eye height (1.18 m above the floor),
  with the crowd around you. Drag to look around, scroll to zoom.
- **Seat card**: sector / row / seat, price, and distances to the centre spot, height above the pitch,
  and distance to the nearest goal.
- **Accessibility**: wheelchair spaces are marked in violet.
- Works on phones (portrait layout).

## How it works

| Part | File | Idea |
|---|---|---|
| Bowl maths | `src/venue/bowl.ts` | The stands' inner edge is a rounded rectangle. Any point is `(u, d)`: position along the perimeter and distance outwards. Every row is an exact offset of the first. |
| Venue generator | `src/venue/stadium.ts` | A venue is **data** (`StadiumConfig`): tiers, rows, row depth/rise, sectors per side, seat width, price rules. The generator turns it into sectors and seats with positions, facing and eye points. This is what the admin layout tool will edit. |
| Seats | `src/scene/Seats.tsx` | One `InstancedMesh` per sector, so tens of thousands of seats draw fast and only the open sector is clickable. |
| Seat view | `src/scene/CameraRig.tsx` | The camera flies to the seat's eye point, then switches to "first-person" look-around. |
| UI | `src/ui/*` | React + Tailwind + Motion. State in `src/state/store.ts` (Zustand). |

**Stack:** React, TypeScript, Vite, Three.js (react-three-fiber + drei), Tailwind CSS, Motion, Zustand.

## What works (Phase 2)

- **Seat comparison**: in the seat view, press the compare button on up to 3 seats. The comparison shows each seat's
  captured view, a 0–100 **view score**, distances and price, marks the best value with a trophy, and recommends
  the best value for money.
- **Real-time seat locking**: **Book** puts a 10-minute hold on the seat. Every open tab (each tab is a separate
  customer) sees it turn amber instantly; the live badge counts fans browsing.
- **No double-booking**: holds go through one atomic "check and lock" step (Web Locks across tabs). In the tests,
  100 customers click the same seat at the same moment and exactly one gets it.
- **Demo checkout**: hold countdown, price plus service fee, name and email, and a fixed test card. It is clearly
  labelled **Demo mode** and no money is charged. If the hold runs out, the seat is released and payment is refused.
- **Signed QR tickets**: each ticket is signed with ECDSA P-256 (Web Crypto). Changing even one character breaks
  the signature.
- **Gate scanner** (`/scan`): camera scanning (jsQR), screenshot upload, or demo buttons. The results are
  **Valid** (first scan), **Already used** (any later scan or copy, with the gate and time of first entry),
  **Fake ticket** (edited), and **Wrong event**.
- **My tickets** (`/tickets`): wallet showing each ticket's QR and whether it has been used.

### Demo script for the presentation

1. Open the site in **two browser windows** side by side.
2. In window 1, pick a seat, check the view, and press **Book**. In window 2 the seat turns amber straight away.
   Try to book it there and you are refused.
3. Finish the demo payment in window 1 to get the "You're in" screen with the QR ticket.
4. Open **Gate scanner**: the first scan is **Valid**, scanning again says **Already used**, and
   **Try an edited copy** says **Fake ticket**.
5. Run `npm test` to show the 13 automated tests passing.

### Booking architecture

| File | Role |
|---|---|
| `src/services/booking.ts` | Booking rules: hold (atomic, all-or-nothing), release, purchase, 10-minute expiry |
| `src/services/tickets.ts` | Ticket signing and verification, and the one-time redemption ledger |
| `src/services/infra.ts` | Storage and lock "seams": the browser (localStorage + Web Locks) today, memory in tests, a database later |
| `src/services/live.ts` | Shares one backend per browser, syncs tabs (BroadcastChannel) and paints holds onto the 3D seats |
| `src/services/booking.test.ts` | Automated tests (`npm test`) |

For this demo the "server" runs inside the browser, so state is shared between tabs of the **same browser**.
Moving to Supabase means implementing the same `hold` / `purchase` / `redeem` rules as SQL functions
(a row lock or conditional `UPDATE`); the UI does not change. In production the ticket signing key would live
only on the server.

## What works (Phase 3)

- **Home page** (`/`): every event on sale, with category, date, venue, starting price and a live "seats left" bar.
  Each event opens its own 3D explorer at `/event/:id`.
- **Sample cinema**: *Galaxy Cinemas · Screen 1*. It has 284 seats in curved, raked rows across Classic, Premium
  and Recliner sections, each split into left / centre / right blocks. There is a screen showing the film's
  title card, glowing step edges, a projector beam and exit signs. The cutaway walls let you look in from above.
  Seat stats change to **distance to the screen**, **how wide the screen looks (°)** and **distance from the
  centre line**; the view score follows the cinema guideline of the screen filling about 36–40° of your view.
- **Admin dashboard** (`/admin`):
  - **Live dashboard**: revenue, occupancy, seats on hold, SeatView sales and seats left, a top-down
    **occupancy map** (hover any sector), **revenue by price tier**, and recent bookings with their gate-scan
    status. It updates live as people book in other tabs.
  - **Events & prices**: create, edit or delete events; pick the venue, date and time; set a price per tier;
    mark an event on sale or as a draft. Changes show on the booking pages immediately.
  - **Venue layouts**: a no-code layout editor. For stadiums, add or remove tiers and change rows, rise, depth,
    sectors per stand, seat and aisle width, and bowl size. For cinemas, change sections, rows, seats per row,
    aisle positions, row curve and screen size. A **live seat plan** with seat / sector / row counts updates as
    you type. You can also add a brand-new stadium or cinema from a template.
- The gate scanner now asks which event is being scanned (a ticket for another event shows **Wrong event**).

### How venues are added without code

A venue is stored as plain JSON (`StadiumConfig` in `src/venue/stadium.ts` or `CinemaConfig` in
`src/venue/cinema.ts`). The generators turn that JSON into every sector, row and seat, with its 3D position,
facing direction and eye point. That is why every seat automatically gets its own view and why the admin editor
only has to edit numbers. Venues and events live in `src/services/catalog.ts`.

## What works (Phase 4: plane seats)

- **Flight Lahore → London** (`/event/evt-flight-sv785`) on a fictional wide-body, *SeatView Air*.
- **Bird's-eye view, then the roof opens**: the plane is shown from above, flying over moving clouds, then
  the roof swings open like a clamshell so you can see every seat inside. It closes again when you sit down.
- **Cabins**: First (4 rows of 1-2-1 lie-flat suites) and Economy (30 rows of 3-3-3). The two exit rows (26-27)
  have extra legroom and their own price tier. Row 13 is skipped, as airlines do.
- **Seat views**: window seats look out of a real framed window at the sky, clouds, engine and wing (over-wing
  rows). Aisle and middle seats look down the cabin. Drag to look around.
- **Comfort read-out for every seat**: legroom (seat pitch, in inches), seat width, and space to your neighbour
  (shared armrest width, or "Private" for suites). Badges show Window / Middle / Aisle, direct aisle access,
  exit row, bulkhead and "wing in view". A **top-down seat diagram** shows the seat in front with the legroom
  measured, your width, and what is on each side of you (neighbour, aisle, window or privacy divider).
- Tickets for flights print as a **boarding pass** (seat 23A, row, class, zone).
- The admin **Venue layouts** tab can edit the plane: cabins, seat layout (e.g. 3-3-3), rows, pitch, width and
  exit rows, with a live seat plan.
- Tests in `src/venue/aircraft.test.ts` check the seat count, row 13 skipped, window/middle/aisle,
  exit-row legroom and pricing, and the comfort numbers.

## Day and night stadium

The stadium has a **Day / Night** button in the top bar (remembered per browser).
- **Day**: sunlight with shadows, blue sky.
- **Night**: a floodlit evening match. Starry sky, four floodlight banks on the roof corners aimed at the pitch,
  a glowing floodlight ring along the roof edge, lit windows in the city, street lights along the roads, and a
  soft glow (bloom) effect. Works in the overview, block view and the view from every seat.

## Coming next

1. Deploy to Vercel (`vercel.json` already sets up the page routes)
2. Optional: move the in-browser booking "server" to Supabase so different computers share live seats

All data is demo data; the teams, the venues, the film and the prices are fictional.
