# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Technicians** (2 today: Javier Aquino, Alex Clapp when in the field) — on iPhones, standing in mechanical rooms, walk-in coolers, loading docks and hallways at Duke University Medical Center and campus buildings, often with gloves off for thirty seconds. Job: see today's jobs, open the work order, log hours and notes, snap photos, request a PO, close the job with a signature. Cell signal is frequently poor.
- **Owner / manager** (Alex Clapp, admin) — at a desk or on the phone between calls. Job: dispatch and assign, keep the Week Plan balanced, review purchase orders, turn completed work into invoices, chase AR, watch KPIs, import Duke's printed work orders.
- **Customer portal viewers** (Duke facilities staff) — occasional, read-only, via a link. Not part of this redesign.

## Product Purpose

3C FieldOps Pro is the operating system of 3C Refrigeration, a small commercial refrigeration contractor in North Carolina whose dominant customer is Duke University (School of Medicine cold rooms, freezer rooms, ice machines; Facilities Maintenance on campus). It replaces paper tickets, a spreadsheet and a QuickBooks-only view with one place for work orders, time, photos, purchase orders, RFQs, invoices, AR, projects, equipment history, a knowledge base and a crew calendar. Success: every job that gets done gets logged the same day and billed without the owner re-keying anything; techs trust it enough to use it in a plant room with one hand.

## Positioning

Built by and for one shop around Duke's actual paperwork: Duke TMS work-order numbers are first-class (batch-scanned from printouts, tracked as "TMS entered"), Duke's building/room codes ("7549 / 209 CR") are the location vocabulary, and the invoice flow mirrors how Duke pays (per-WO for Facilities, project/retainer billing for School of Medicine). A generic FSM product could not truthfully claim that fit.

## Operating Context

- Work arrives as Duke TMS printouts (PM and CM layouts), emails to service@, or the owner's phone. Each becomes a WO-#### in the app.
- Techs log time per WO per day (no start/stop clocks), attach photos, and close with a signature captured on the phone.
- Parts come from supply houses (Johnstone, United, ACR); counter tickets are scanned into POs; vendor bills are audited three-way.
- Billing: invoices as branded PDFs / Excel; AR statements and reminders; retainer invoices for SoM.
- The company calendar shows jobs due, logged hours per tech, events, and crew schedule entries.
- Everything runs on the Supabase free tier and Vercel; egress and AI token spend are watched.

## Capabilities and Constraints

- React 18 (CRA), inline style objects, no CSS framework, no routing library; hash-based tabs. Dark and light themes must both work; theme tokens live in `shared.js` (`B`), primitives in `ui.jsx`.
- Roles: technician, manager, admin — the navigation (tab groups, bottom bar on phones) and every tab's location are fixed and must not move in a redesign.
- Terminology is the shop's: WO, PO, RFQ, TMS, PM/CM, NTE, cold room / freezer room (CR/FR), Week Plan, My Day.
- Status colors are semantic and fixed: green = done/approved/paid, orange = pending, red = overdue/alert, cyan = brand/active/links. Never decorative color.
- Phones: iPhone Safari (393px), gloves-off use, poor signal; text must not get smaller or lower-contrast than today; touch targets ≥44px.
- Open decisions: none for the redesign beyond the visual world.

## Brand Commitments

- The real 3C Refrigeration logo images (NC outline lockup; dark and light variants) are the only brand mark. Text wordmarks are unacceptable ("cheap, tacky, AI").
- Brand cyan (#4DD6F0 dark / #0B7F9E light) is the single accent.
- Owner's taste (confirmed 2026-09-09): craft level of Linear; must not read as trendy/startup or as an AI-generated template (no glow, no gradients, no purple, no colored rails, no emoji icons, no card stacks for their own sake); readability in the field outranks expression. A distinctive workhorse typeface is welcome; Inter is to be replaced.

## Evidence on Hand

- Live production data: ~1,540 work orders, 568 time entries, 35 invoices, 1 project, real Duke customers. Screenshots of every main tab at 1440px and 393px in both themes are in `iphone/out/`.
- Real Duke TMS printouts (PM + CM layouts) at `duke/scan1.pdf`.
- No testimonials, benchmarks or marketing claims exist and none may be invented.

## Product Principles

1. The tool disappears into the task: a tech should find the job and log the hour without reading.
2. Duke's vocabulary, not software vocabulary.
3. Color means state; everything else is neutral.
4. Phone first, desk second, print (PDF) third — the same information in each.
5. Nothing moves: navigation and control placement are settled; the redesign changes finish only.

## Accessibility & Inclusion

Outdoor/plant-room glare and gloves: minimum 13px UI text (16px inputs on phones), ≥4.5:1 body contrast in both themes, 44px targets, no hover-only affordances on phones.
