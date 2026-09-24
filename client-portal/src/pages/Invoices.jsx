import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt } from "lucide-react";
import { getMyInvoices } from "../services/dataService";
import { Card, EmptyState, Skeleton, StatusBadge } from "../components/ui";
import { formatCurrency, formatDate } from "../utils/format";

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyInvoices({ limit: 50 })
      .then((data) => setInvoices(data.invoices))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Invoices</h1>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Invoices raised against your account will appear here." />
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card
              key={invoice._id}
              className="flex cursor-pointer items-center justify-between gap-3 hover:-translate-y-0.5 hover:border-brand-300 transition"
              onClick={() => navigate(`/invoices/${invoice._id}`)}
            >
              <div className="flex items-center gap-3">
                <Receipt aria-hidden="true" size={16} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-900">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-slate-400">Due {formatDate(invoice.dueDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">{formatCurrency(invoice.totalAmount)}</span>
                <StatusBadge status={invoice.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Invoices;
