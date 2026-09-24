import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMyInvoiceById } from "../services/dataService";
import { Card, Skeleton, StatusBadge } from "../components/ui";
import { formatCurrency, formatDate } from "../utils/format";

const InvoiceDetail = () => {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyInvoiceById(invoiceId)
      .then(setInvoice)
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) return <Skeleton className="mx-auto h-64 max-w-3xl" />;
  if (!invoice) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-500">Due {formatDate(invoice.dueDate)}</p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <Card>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Line items</p>
        <div className="space-y-1.5 text-sm">
          {invoice.lineItems.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="text-slate-600">{item.description} × {item.quantity}</span>
              <span className="font-semibold text-slate-800">{formatCurrency(item.amount)}</span>
            </div>
          ))}
          {invoice.additionalCharges.map((charge, idx) => (
            <div key={`c-${idx}`} className="flex justify-between text-slate-500">
              <span>{charge.label}</span>
              <span>{formatCurrency(charge.amount)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {invoice.discountAmount > 0 ? (
            <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{formatCurrency(invoice.discountAmount)}</span></div>
          ) : null}
          <div className="flex justify-between text-slate-500"><span>GST ({invoice.gstRate}%)</span><span>{formatCurrency(invoice.gstAmount)}</span></div>
          <div className="flex justify-between text-base font-bold text-slate-900"><span>Total</span><span>{formatCurrency(invoice.totalAmount)}</span></div>
          <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(invoice.amountPaid)}</span></div>
          <div className="flex justify-between font-bold text-rose-600"><span>Balance due</span><span>{formatCurrency(invoice.totalAmount - invoice.amountPaid)}</span></div>
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Payment history</p>
        {invoice.payments?.length ? (
          <div className="space-y-1.5 text-sm">
            {invoice.payments.map((payment) => (
              <div key={payment._id} className="flex justify-between">
                <span className={payment.type === "REFUND" ? "text-rose-600" : "text-slate-600"}>
                  {payment.type === "REFUND" ? "Refund" : payment.method} · {formatDate(payment.paymentDate)}
                </span>
                <span className="font-semibold">{payment.type === "REFUND" ? "-" : ""}{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No payments recorded yet.</p>
        )}
      </Card>
    </div>
  );
};

export default InvoiceDetail;
