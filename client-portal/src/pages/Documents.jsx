import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getMyDocuments } from "../services/dataService";
import { Card, EmptyState, Skeleton } from "../components/ui";
import { formatDate } from "../utils/format";

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyDocuments()
      .then(setDocuments)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Documents</h1>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState title="No documents shared yet" />
      ) : (
        <div className="space-y-2">
          {documents.map((doc, idx) => (
            <Card key={idx} className="flex items-center justify-between gap-3">
              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 text-brand-700 hover:underline">
                <FileText aria-hidden="true" size={16} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{doc.name}</p>
                  <p className="text-xs text-slate-400">{doc.sourceLabel} · {doc.category} · {formatDate(doc.uploadedAt)}</p>
                </div>
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
