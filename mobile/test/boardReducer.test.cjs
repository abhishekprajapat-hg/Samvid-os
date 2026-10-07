const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  boardWithHistory,
  initialBoard,
  directoryFrom,
  clientsFrom,
  emptyInventory,
  toCsv,
} = require("../.test-build/modules/coworking/boardReducer.js");

/*
 * The booking board reducer, ported from
 * frontend/src/modules/coworking/booking/boardStore.js.
 *
 * Web and mobile save the same /coworking/board document, so these pin the
 * shapes the desktop reads back: what a booking, a hold, a release and a
 * transfer leave behind, and how the client directory is derived from them.
 */

const withRent = () => {
  let board = initialBoard();
  board = { ...board, cabins: board.cabins.map((cabin) => ({ ...cabin, monthlyRent: cabin.seats * 5000, deposit: cabin.seats * 10000 })) };
  return board;
};

const onboard = (board, codes, name = "Nexbridge", rent = 40000) =>
  boardWithHistory(board, {
    type: "ONBOARD",
    cabinCodes: codes,
    client: { name, kind: "company", documents: [] },
    terms: { startDate: "2026-09-01", termMonths: 12, rent, depositMonths: 2, lockInMonths: 6 },
  });

const cabin = (board, code) => board.cabins.find((item) => item.code === code);

describe("inventory", () => {
  test("the plan has 65 cabins, all vacant, labelled as web labels them", () => {
    const cabins = emptyInventory();
    assert.equal(cabins.length, 65);
    assert.ok(cabins.every((item) => item.status === "VACANT"));
    assert.equal(cabins.find((item) => item.code === "C12").label, "C-12");
  });
});

describe("ONBOARD", () => {
  test("books every chosen cabin to one client on one agreement", () => {
    const board = onboard(withRent(), ["A1", "A2"]);
    assert.equal(cabin(board, "A1").status, "BOOKED");
    assert.equal(cabin(board, "A1").client.id, "nexbridge");
    assert.equal(cabin(board, "A1").contract.id, cabin(board, "A2").contract.id);
  });

  test("apportions a negotiated total by each cabin's list rent", () => {
    // A1 and A2 are both 4-seaters, so an even split.
    const board = onboard(withRent(), ["A1", "A2"], "Nexbridge", 30000);
    assert.equal(cabin(board, "A1").contract.monthlyRent, 15000);
    assert.equal(cabin(board, "A2").contract.monthlyRent, 15000);
    assert.equal(cabin(board, "A1").contract.deposit, 30000);
  });

  test("logs one activity entry and can be undone", () => {
    const before = withRent();
    const board = onboard(before, ["A1"]);
    assert.equal(board.activity[0].kind, "onboard");
    const undone = boardWithHistory(board, { type: "UNDO" });
    assert.equal(cabin(undone, "A1").status, "VACANT");
  });
});

describe("holds", () => {
  test("a hold reserves the cabin and expires on its own", () => {
    let board = boardWithHistory(withRent(), { type: "HOLD", cabinCode: "B7", name: "Acme", days: 7 });
    assert.equal(cabin(board, "B7").status, "RESERVED");
    // Hydrating a board whose hold has lapsed sweeps it.
    const stale = board.cabins.map((item) => (item.code === "B7" ? { ...item, holdExpiresAt: "2000-01-01T00:00:00.000Z" } : item));
    board = boardWithHistory(board, { type: "REPLACE_ALL", state: { cabins: stale, activity: board.activity } });
    assert.equal(cabin(board, "B7").status, "VACANT");
    assert.equal(board.activity[0].kind, "expire");
  });
});

describe("release and transfer", () => {
  test("releasing moves the tenant into the cabin's history", () => {
    let board = onboard(withRent(), ["C3"]);
    board = boardWithHistory(board, { type: "RELEASE", cabinCode: "C3" });
    assert.equal(cabin(board, "C3").status, "VACANT");
    assert.equal(cabin(board, "C3").previousClientCount, 1);
    assert.equal(cabin(board, "C3").previousClients[0].name, "Nexbridge");
  });

  test("a transfer keeps the agreement and prices the new room", () => {
    let board = onboard(withRent(), ["A4"]);
    const agreement = cabin(board, "A4").contract.id;
    board = boardWithHistory(board, { type: "TRANSFER", fromCode: "A4", toCode: "B7" });
    assert.equal(cabin(board, "B7").contract.id, agreement);
    assert.equal(cabin(board, "B7").contract.monthlyRent, 50000);
    assert.equal(cabin(board, "A4").status, "VACANT");
  });
});

describe("documents", () => {
  test("documents land on every cabin the client holds", () => {
    let board = onboard(withRent(), ["A1", "A2"]);
    const doc = { id: "pan-1", key: "companyPan", label: "Company PAN card", fileName: "pan.pdf", size: 10, type: "application/pdf", uploadedAt: "x", status: "PENDING", verifiedAt: null };
    board = boardWithHistory(board, { type: "SET_CLIENT_DOCUMENTS", clientId: "nexbridge", documents: [doc] });
    assert.equal(cabin(board, "A1").client.documents.length, 1);
    assert.equal(cabin(board, "A2").client.documents.length, 1);
  });
});

describe("directory", () => {
  test("a tenant who left and came back is one returning record", () => {
    let board = onboard(withRent(), ["C7"]);
    board = boardWithHistory(board, { type: "RELEASE", cabinCode: "C7" });
    board = onboard(board, ["A3"]);
    const directory = directoryFrom(board.cabins);
    const record = directory.filter((client) => client.name === "Nexbridge");
    assert.equal(record.length, 1);
    assert.equal(record[0].kind, "active");
    assert.equal(record[0].returning, true);
    assert.equal(record[0].stays[0].cabinCode, "C7");
  });

  test("clients sum their cabins' capacity and rent", () => {
    const board = onboard(withRent(), ["A1", "A5"], "Nexbridge", 50000);
    const [client] = clientsFrom(board.cabins);
    assert.equal(client.capacity, 10);
    assert.equal(client.monthlyRent, 50000);
  });
});

test("CSV escapes quotes the way spreadsheets expect", () => {
  assert.equal(toCsv([["a", 'say "hi"']]), '"a","say ""hi"""');
});

// 30 Sep 2026 requirements update (R7): a custom deposit amount, split by rent.
describe("custom deposit", () => {
  test("a custom deposit is stored as typed and split across cabins by rent", () => {
    let board = withRent();
    const [a, b] = board.cabins.filter((item) => item.status === "VACANT").slice(0, 2);
    board = boardWithHistory(board, {
      type: "ONBOARD",
      cabinCodes: [a.code, b.code],
      client: { name: "Custom Co", kind: "company", documents: [] },
      terms: { startDate: "2026-09-01", termMonths: 12, rent: a.monthlyRent + b.monthlyRent, depositMode: "custom", depositAmount: 75000, lockInMonths: 0 },
    });
    const total = cabin(board, a.code).contract.deposit + cabin(board, b.code).contract.deposit;
    assert.ok(Math.abs(total - 75000) <= 1, `deposits add up to the custom amount (${total})`);
    assert.equal(cabin(board, a.code).contract.depositMode, "custom");
    assert.equal(cabin(board, a.code).contract.depositMonths, null);
  });

  test("a month-based deposit still records how many months", () => {
    let board = withRent();
    const target = board.cabins.find((item) => item.status === "VACANT");
    board = onboard(board, [target.code], "Months Co", 40000);
    assert.equal(cabin(board, target.code).contract.deposit, 80000);
    assert.equal(cabin(board, target.code).contract.depositMode, "months");
    assert.equal(cabin(board, target.code).contract.depositMonths, 2);
  });
});
