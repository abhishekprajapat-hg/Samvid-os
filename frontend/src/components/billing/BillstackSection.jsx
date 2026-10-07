import { useEffect, useState } from 'react';
import { usePermissions } from '../../context/usePermissions';
import { getBillingStatus, retryBillingSync, createBillingHandoff } from '../../services/billstackService';
import { toErrorMessage } from '../../utils/errorMessage';

export default function BillstackSection({ entityType, entityId }) {
  const { can, loading } = usePermissions();
  const visible = !loading && can('page.billing.view') && Boolean(entityId);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const data = await getBillingStatus(entityType, entityId);
        if (active) { setState(data); setError(''); }
      } catch (err) { if (active) setError(toErrorMessage(err, 'Billing is unavailable')); }
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [visible, entityType, entityId]);
  if (!visible) return null;
  const perform = async (action) => {
    setBusy(action); setError('');
    try {
      if (action === 'handoff') {
        const { handoffUrl } = await createBillingHandoff(entityType, entityId);
        window.location.assign(handoffUrl);
      } else setState(await retryBillingSync(entityType, entityId));
    } catch (err) { setError(toErrorMessage(err, 'BillStack request failed. Please retry.')); }
    finally { setBusy(''); }
  };
  return <section className="relative m-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" aria-label="BillStack billing">
    <h3 className="font-semibold">BillStack</h3>
    <p className="my-2 text-sm" role="status">Customer sync: {state?.syncStatus?.replaceAll('_', ' ').toLowerCase() || 'loading'}</p>
    {(error || state?.lastSyncError) && <p className="my-2 text-sm text-red-600" role="alert">{error || state.lastSyncError}</p>}
    <div className="flex flex-wrap gap-2">
      {can('page.billing.sync_customer') && <button type="button" disabled={Boolean(busy)} onClick={() => perform('sync')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{busy === 'sync' ? 'Syncing…' : 'Sync / retry'}</button>}
      {can('page.billing.create_invoice') && <button type="button" disabled={Boolean(busy) || !state} onClick={() => perform('handoff')} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">{busy === 'handoff' ? 'Opening BillStack…' : 'Create Invoice'}</button>}
    </div>
    <p className="mt-2 text-xs text-slate-500">Opens BillStack. Your BillStack login is required.</p>
  </section>;
}
