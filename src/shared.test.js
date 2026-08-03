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
