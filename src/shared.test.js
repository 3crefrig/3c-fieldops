/**
 * Money-path regression suite — the first automated tests in this app.
 *
 * Scope: the pure helpers in shared.js that every invoice, dashboard, and sweep
 * depends on. These encode business rules that have already bitten us once
 * (UTC dates shifting evening entries a day; excluded-customer scoping) so a
 * refactor can't silently reintroduce them.
 *
 * Run: npm test -- --watchAll=false
 */
import {
  getCustomerTiers, getPartsMarkup, DEFAULT_PARTS_MARKUP,
  setAppSettingsCache, getAppSetting, getCompanyProfile,
  localDateStr, todayLocal,
  calcWOHours, fmtHours,
  woOverdue, woReadyToInvoice, isInvoiceExcludedCustomer,
  genPO, genAgreementNum,
  matchCustomerName, splitScannedLocation, scannedWOToRow, findExistingByCustomerWO,
} from "./shared";

afterEach(() => setAppSettingsCache({})); // never leak settings between tests

// ── Rates & markup (what every invoice bills) ────────────────────────────
describe("customer rates", () => {
  test("customer-specific labor tiers win over everything", () => {
    const tiers = getCustomerTiers({ labor_tiers: [{ name: "Custom", rate: "60" }, { name: "Lead", rate: 75 }] });
    expect(tiers).toEqual([{ name: "Custom", rate: 60 }, { name: "Lead", rate: 75 }]);
  });
  test("no customer → shop defaults 120/135", () => {
    const tiers = getCustomerTiers(null);
    expect(tiers.map(t => t.rate)).toEqual([120, 135]);
  });
  test("company profile overrides the hardcoded defaults (Settings is live)", () => {
    setAppSettingsCache({ company_profile: { default_senior_rate: "111", default_licensed_rate: "144" } });
    expect(getCustomerTiers(null).map(t => t.rate)).toEqual([111, 144]);
  });
  test("empty labor_tiers array falls through to defaults", () => {
    expect(getCustomerTiers({ labor_tiers: [] }).map(t => t.rate)).toEqual([120, 135]);
  });
  test("parts markup: customer value wins, empty-string falls back, profile overrides default", () => {
    expect(getPartsMarkup({ parts_markup: "25" })).toBe(25);
    expect(getPartsMarkup({ parts_markup: 0 })).toBe(0);           // explicit zero is honored
    expect(getPartsMarkup({ parts_markup: "" })).toBe(DEFAULT_PARTS_MARKUP);
    setAppSettingsCache({ company_profile: { default_parts_markup: "40" } });
    expect(getPartsMarkup(null)).toBe(40);
  });
});

// ── App settings cache ───────────────────────────────────────────────────
describe("app settings", () => {
  test("returns default when unset, empty, or null", () => {
    expect(getAppSetting("invoice_reminder_days", 30)).toBe(30);
    setAppSettingsCache({ app_settings: { invoice_reminder_days: "" } });
    expect(getAppSetting("invoice_reminder_days", 30)).toBe(30);
  });
  test("returns stored value when present (including falsy false)", () => {
    setAppSettingsCache({ app_settings: { feedback_enabled: false, invoice_reminder_days: "45" } });
    expect(getAppSetting("feedback_enabled", true)).toBe(false);
    expect(getAppSetting("invoice_reminder_days", 30)).toBe("45");
  });
  test("company profile empty object when nothing cached", () => {
    expect(getCompanyProfile()).toEqual({});
  });
});

// ── Dates (the UTC bug class) ────────────────────────────────────────────
describe("local dates", () => {
  test("localDateStr formats local calendar date with zero-pad", () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
  test("an evening timestamp stays on ITS local day (the bug that shifted time entries)", () => {
    // 11:30pm local on Aug 1 — toISOString() would say Aug 2 in US timezones.
    const evening = new Date(2026, 7, 1, 23, 30);
    expect(localDateStr(evening)).toBe("2026-08-01");
  });
  test("todayLocal matches a hand-built local date string", () => {
    const n = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    expect(todayLocal()).toBe(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`);
  });
});

// ── Hours ────────────────────────────────────────────────────────────────
describe("hours", () => {
  const entries = [
    { wo_id: "a", hours: "2.5" }, { wo_id: "a", hours: 1 },
    { wo_id: "b", hours: "4" }, { wo_id: "a", hours: "" },
  ];
  test("calcWOHours sums only the WO's entries, tolerating strings/blank", () => {
    expect(calcWOHours("a", entries)).toBe(3.5);
    expect(calcWOHours("b", entries)).toBe(4);
    expect(calcWOHours("zzz", entries)).toBe(0);
  });
  test("fmtHours trims trailing zeros and survives junk", () => {
    expect(fmtHours(3.5)).toBe("3.5h");
    expect(fmtHours("2.00")).toBe("2h");
    expect(fmtHours(2.256)).toBe("2.26h");
    expect(fmtHours(undefined)).toBe("0h");
    expect(fmtHours("nope")).toBe("0h"); // NaN → parseFloat(0) path
  });
});

// ── Overdue / ready-to-invoice rules (drive alerts and dashboards) ───────
describe("work order rules", () => {
  test("woOverdue: only real past YYYY-MM-DD dates count", () => {
    expect(woOverdue({ status: "pending", due_date: "2020-01-01" }, "2026-08-03")).toBe(true);
    expect(woOverdue({ status: "pending", due_date: "2999-01-01" }, "2026-08-03")).toBe(false);
    expect(woOverdue({ status: "pending", due_date: "TBD" }, "2026-08-03")).toBe(false);
    expect(woOverdue({ status: "pending", due_date: "" }, "2026-08-03")).toBe(false);
    expect(woOverdue({ status: "completed", due_date: "2020-01-01" }, "2026-08-03")).toBe(false);
    expect(woOverdue(null, "2026-08-03")).toBe(false);
  });
  test("excluded customers: School of Medicine + Duke Facilities Maintenance only", () => {
    expect(isInvoiceExcludedCustomer("Duke University School Of Medicine")).toBe(true);
    expect(isInvoiceExcludedCustomer("Duke University Facilities Maintenance Department")).toBe(true);
    expect(isInvoiceExcludedCustomer("Duke Regional Hospital")).toBe(false); // Duke but NOT excluded
    expect(isInvoiceExcludedCustomer("Bob's Diner")).toBe(false);
    expect(isInvoiceExcludedCustomer(null)).toBe(false);
  });
  test("woReadyToInvoice: completed + uninvoiced + non-project + non-excluded", () => {
    const base = { status: "completed", invoiced: false, project_id: null, customer: "Bob's Diner" };
    expect(woReadyToInvoice(base)).toBe(true);
    expect(woReadyToInvoice({ ...base, status: "pending" })).toBe(false);
    expect(woReadyToInvoice({ ...base, invoiced: true })).toBe(false);
    expect(woReadyToInvoice({ ...base, project_id: "p1" })).toBe(false);
    expect(woReadyToInvoice({ ...base, customer: "Duke University School Of Medicine" })).toBe(false);
    expect(woReadyToInvoice(null)).toBe(false);
  });
});

// ── ID formats (collide-safe sequences) ──────────────────────────────────
describe("id generators", () => {
  const now = new Date();
  const pfx = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0");
  test("genPO: YYMM## sequence continues from the month's max", () => {
    expect(genPO([])).toBe(pfx + "01");
    expect(genPO([{ po_id: pfx + "07" }, { po_id: pfx + "03" }])).toBe(pfx + "08");
    expect(genPO([{ po_id: "190001" }])).toBe(pfx + "01"); // old months ignored
  });
  test("genAgreementNum: AGR-YYMM-## format", () => {
    expect(genAgreementNum([])).toBe("AGR-" + pfx + "-01");
    expect(genAgreementNum([{ agreement_num: "AGR-" + pfx + "-04" }])).toBe("AGR-" + pfx + "-05");
  });
});

// ── Batch WO import (Duke TMS printouts) ──────────────────────────────────
describe("scanned WO import", () => {
  const SOM = "Duke University School Of Medicine", FMD = "Duke University Facilities Maintenance Department";
  const customers = [{ name: FMD }, { name: SOM }, { name: "Acme Biotech" }];
  test("DUMC / Medical Center headers bill to School of Medicine; FMD stays separate", () => {
    expect(matchCustomerName("DUMC - Engineering & Operations", customers)).toBe(SOM);
    expect(matchCustomerName("Duke Medical Center", customers)).toBe(SOM);
    expect(matchCustomerName("Duke FMD", customers)).toBe(FMD);
    expect(matchCustomerName("Duke University Facilities Management", customers)).toBe(FMD);
    expect(matchCustomerName("Acme Biotech, Inc.", customers)).toBe("Acme Biotech");
    expect(matchCustomerName("Duke", customers)).toBe(""); // ambiguous → caller's default
    expect(matchCustomerName(null, customers)).toBe("");
  });
  test("building/room normalisation matches how Duke jobs are keyed", () => {
    expect(splitScannedLocation("4th floor- 460CR", "7530 - Sands Bldg")).toEqual({ location: "460 CR", building: "7530" });
    expect(splitScannedLocation("7549-209 CR", "")).toEqual({ location: "209 CR", building: "7549" });
    expect(splitScannedLocation("All floors - hallways", "7513")).toEqual({ location: "All floors - hallways", building: "7513" });
    expect(splitScannedLocation("", "")).toEqual({ location: "", building: "" });
  });
  test("CM printout → import row; Duke's mechanic on the printout is ignored", () => {
    const r = scannedWOToRow({
      page: 2, customer_name: "DUMC - Engineering & Operations", customer_wo: "2457528",
      title: "Cold room isn't staying at 4 degrees C", description: "Cold room is currently over 10 degrees C.",
      building: "7530 - Sands Bldg", building_name: "Sands Bldg", floor: "4th floor", location: "4th floor- 460CR",
      work_type: "CM", priority: "medium", due_date: null, assignee: "Coates, Hunter",
      contact_name: "Julie Kent", contact_phone: "9196845634", confidence: 0.92,
    }, { customers, defaultAssignee: "Javier Aquino", defaultCrew: ["Alex Clapp"] });
    expect(r.customer).toBe(SOM);
    expect(r.customer_wo).toBe("2457528");
    expect(r.building).toBe("7530");
    expect(r.location).toBe("460 CR");
    expect(r.wo_type).toBe("CM");
    expect(r.due_date).toBe("");
    expect(r.assignee).toBe("Javier Aquino");
    expect(r.crew).toEqual(["Alex Clapp"]);
    expect(r.notes).toContain("Sands Bldg · 4th floor");
    expect(r.notes).toContain("Contact: Julie Kent 9196845634");
    expect(r.include).toBe(true);
  });
  test("PM printout → import row keeps asset + PM meta and the due date", () => {
    const r = scannedWOToRow({
      customer_name: "DUMC - Engineering & Operations", customer_wo: "2406455", title: "Water filter for ice machine - N.Duke - SA",
      description: "1. Perform Safety Risk Analysis", building: "7513", location: "All floors - hallways", work_type: "PM",
      due_date: "2026-06-01", pm_number: "2652", frequency: "Semi-Annual", asset_no: "109321", asset_desc: "Water Filter for Ice Machines",
      manufacturer: "Filterite", model: "LN 01003", serial: "LC1",
    }, { customers, defaultCustomer: SOM });
    expect(r.wo_type).toBe("PM");
    expect(r.due_date).toBe("2026-06-01");
    expect(r.priority).toBe("medium");
    expect(r.assignee).toBe("Unassigned");
    expect(r.notes).toContain("PM# 2652 · Semi-Annual");
    expect(r.notes).toContain("Asset 109321 — Water Filter for Ice Machines — Filterite LN 01003 — SN LC1");
  });
  test("empty title falls back to PM / customer WO#", () => {
    expect(scannedWOToRow({ work_type: "PM", customer_wo: "1" }).title).toBe("PM");
    expect(scannedWOToRow({ work_type: "CM", customer_wo: "2448341" }).title).toBe("2448341");
  });
  test("duplicates are keyed on the customer WO#", () => {
    const wos = [{ wo_id: "WO-1520", customer_wo: "2448340" }, { wo_id: "WO-1500", customer_wo: null }];
    expect(findExistingByCustomerWO("2448340", wos).wo_id).toBe("WO-1520");
    expect(findExistingByCustomerWO(" 2448 340", wos).wo_id).toBe("WO-1520");
    expect(findExistingByCustomerWO("2448341", wos)).toBeNull();
    expect(findExistingByCustomerWO("", wos)).toBeNull();
  });
});
