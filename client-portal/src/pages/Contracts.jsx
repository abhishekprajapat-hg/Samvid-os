import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { getMyContracts } from "../services/dataService";
import { Card, EmptyState, Skeleton, StatusBadge } from "../components/ui";
import { formatCurrency, formatDate } from "../utils/format";

const Contracts = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyContracts({ limit: 50 })
      .then((data) => setContracts(data.contracts))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Contracts</h1>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState title="No contracts yet" />
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <Card key={contract._id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileSignature aria-hidden="true" size={16} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-900">{contract.contractCode}</p>
                  <p className="text-xs text-slate-400">
                    {contract.cabinId?.cabinCode}
                    {contract.seatCode ? ` · ${contract.seatCode}` : " (whole cabin)"} · {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">{formatCurrency(contract.rent)}/mo</span>
                <StatusBadge status={contract.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Contracts;
