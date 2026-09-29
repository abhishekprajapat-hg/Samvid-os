const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { transformSync } = require('esbuild');

function load(relative, stubs, globals = {}) {
  const file = path.resolve(__dirname, '../src', relative);
  const source = transformSync(fs.readFileSync(file, 'utf8'), { loader: file.endsWith('jsx') ? 'jsx' : 'js', format: 'cjs', jsx: 'automatic' }).code;
  const module = { exports: {} }, localRequire = createRequire(file);
  vm.runInNewContext(source, { module, exports: module.exports, require: name => name in stubs ? stubs[name] : localRequire(name), Date, console, crypto: require('node:crypto').webcrypto, Uint8Array, ...globals }, { filename: file });
  return module.exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function uiHarness(permissions, failure = false) {
  const state = [], effects = [], calls = [], navigations = [];
  let index = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; },
    useEffect(effect) { effects.push(effect); },
  };
  const Component = load('components/billing/BillstackSection.jsx', {
    react,
    '../../context/usePermissions': { usePermissions: () => ({ can: p => permissions.includes(p), loading: false }) },
    '../../utils/errorMessage': { toErrorMessage: error => error.message },
    '../../services/billstackService': {
      async getBillingStatus(...args) { calls.push(['status', ...args]); return { syncStatus: 'PENDING' }; },
      async retryBillingSync(...args) { calls.push(['sync', ...args]); return { syncStatus: 'SYNCED' }; },
      async createBillingHandoff(...args) { calls.push(['handoff', ...args]); if (failure) throw new Error('BillStack unavailable'); return { handoffUrl: 'https://billing.example.test/secure' }; },
    },
  }, { window: { setInterval: () => 1, clearInterval() {}, location: { assign: url => navigations.push(url) } } }).default;
  const render = () => { index = 0; return Component({ entityType: 'lead', entityId: 'customer-1' }); };
  return { render, effects, calls, navigations, state };
}
test('Billing is hidden without its view permission', () => {
  const h = uiHarness([]);
  assert.equal(h.render(), null);
  h.effects[0](); assert.equal(h.calls.length, 0);
});
test('view-only employee sees status but no sync or invoice action', async () => {
  const h = uiHarness(['page.billing.view']); h.render(); h.effects[0](); await new Promise(resolve => setImmediate(resolve));
  const tree = h.render();
  assert.equal(nodes(tree).filter(n => n.type === 'button').length, 0);
  assert.equal(h.state[0].syncStatus, 'PENDING');
});
test('delegated invoice action navigates only to the backend-returned handoff', async () => {
  const h = uiHarness(['page.billing.view', 'page.billing.create_invoice']);
  h.render(); h.effects[0](); await new Promise(resolve => setImmediate(resolve));
  const button = nodes(h.render()).find(n => n.type === 'button');
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.deepEqual(h.navigations, ['https://billing.example.test/secure']);
  assert.deepEqual(h.calls.at(-1), ['handoff', 'lead', 'customer-1']);
});
test('handoff failure remains on CRM and displays the error', async () => {
  const h = uiHarness(['page.billing.view', 'page.billing.create_invoice'], true);
  h.render(); h.effects[0](); await new Promise(resolve => setImmediate(resolve));
  await nodes(h.render()).find(n => n.type === 'button').props.onClick();
  assert.equal(h.navigations.length, 0);
  assert.ok(nodes(h.render()).some(n => n.props?.role === 'alert' && n.props.children === 'BillStack unavailable'));
});
test('retry permission is independent of invoice creation', async () => {
  const h = uiHarness(['page.billing.view', 'page.billing.sync_customer']);
  const buttons = nodes(h.render()).filter(n => n.type === 'button');
  assert.equal(buttons.length, 1); await buttons[0].props.onClick();
  assert.equal(h.state[0].syncStatus, 'SYNCED'); assert.equal(h.navigations.length, 0);
});
const board = () => load('modules/coworking/booking/boardStore.js', {
  react: {}, '../../../services/api': {}, './cabinData': { CABIN_SEATS: [] },
});
test('one onboarding gives all cabins the same random identity and preserves it on edits', () => {
  const { boardReducer } = board();
  const state = { cabins: ['A1', 'A2'].map(code => ({ code, monthlyRent: 100, previousClients: [] })), activity: [] };
  const result = boardReducer(state, { type: 'ONBOARD', cabinCodes: ['A1', 'A2'], client: { name: 'Same Name' }, terms: { startDate: '2026-09-01', termMonths: 12, rent: 200 } });
  assert.equal(result.cabins[0].client.id, result.cabins[1].client.id);
  assert.notEqual(result.cabins[0].client.id, 'samename');
  const changed = boardReducer(result, { type: 'UPDATE_CLIENT', clientId: result.cabins[0].client.id, client: { name: 'Updated name' }, terms: {} });
  assert.equal(changed.cabins[0].client.identityKey, result.cabins[0].client.identityKey);
});
test('client directory no longer merges different customers with equal names', () => {
  const { directoryFrom } = board();
  const cabins = ['one', 'two'].map(id => ({ code: id, status: 'BOOKED', seats: 1, client: { id, name: 'Same Name' }, contract: { endDate: '2027-01-01', monthlyRent: 100 }, previousClients: [] }));
  assert.equal(directoryFrom(cabins).length, 2);
});

test('legacy coworking cabins without a previousClients array do not crash the client directory', () => {
  const { directoryFrom } = board();
  const cabins = [
    { code: 'A1', status: 'BOOKED', seats: 2, client: { id: 'legacy-client', name: 'Legacy Customer' }, contract: { endDate: '2027-01-01', monthlyRent: 100 } },
    { code: 'A2', status: 'RESERVED', seats: 1, client: { id: 'legacy-prospect', name: 'Legacy Prospect' }, contract: { endDate: '2027-01-01', monthlyRent: 50 }, previousClients: null },
  ];
  const directory = directoryFrom(cabins);
  assert.equal(directory.map(client => client.name).sort().join('|'), 'Legacy Customer|Legacy Prospect');
  assert.equal(directory.map(client => client.stays.length).join(','), '0,0');
});

test('server Billing metadata is consumed without replacing newer local edits or triggering a business save', () => {
  const { boardWithHistory } = board();
  const submitted = { cabins: [{ code: 'A1', client: { id: 'legacy', name: 'Old', phone: '123' } }] };
  const state = { ...submitted, cabins: [{ code: 'A1', client: { ...submitted.cabins[0].client, phone: '456' } }], revision: 8, undoStack: ['unchanged'], activity: ['payment'] };
  const authoritative = { cabins: [{ code: 'A1', client: { ...submitted.cabins[0].client, identityKey: 'server-key', canonicalClientId: 'canonical', billingIdentityVerified: true } }] };
  const next = boardWithHistory(state, { type: 'BILLING_METADATA', submitted, state: authoritative });
  assert.equal(next.cabins[0].client.phone, '456');
  assert.equal(next.cabins[0].client.canonicalClientId, 'canonical');
  assert.equal(next.cabins[0].client.identityKey, 'server-key');
  assert.equal(next.revision, 8); assert.equal(next.activity, state.activity); assert.equal(next.undoStack, state.undoStack);
});

test('late save response cannot bind a newly onboarded replacement in the same cabin', () => {
  const { boardWithHistory } = board();
  const submitted = { cabins: [{ code: 'A1', client: { id: 'old', identityKey: 'old-key' } }] };
  const state = { cabins: [{ code: 'A1', client: { id: 'new', identityKey: 'new-key' } }], revision: 9 };
  const next = boardWithHistory(state, { type: 'BILLING_METADATA', submitted, state: { cabins: [{ code: 'A1', client: { ...submitted.cabins[0].client, canonicalClientId: 'old-canonical' } }] } });
  assert.equal(next.cabins[0].client.canonicalClientId, undefined);
});
