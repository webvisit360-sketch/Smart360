import { getListAdminEnquiriesQueryKey, useListAdminEnquiries } from "@workspace/api-client-react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const statusDetails = {
  accepted: { label: "E-pošta sprejeta", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "E-pošta ni bila poslana", icon: AlertCircle, className: "bg-red-50 text-red-700 border-red-200" },
  pending: { label: "Dostava še ni potrjena", icon: Clock3, className: "bg-amber-50 text-amber-700 border-amber-200" },
} as const;

export default function AdminEnquiriesPage() {
  const { data, isLoading, isError } = useListAdminEnquiries({
    query: { refetchInterval: 30_000, queryKey: getListAdminEnquiriesQueryKey() },
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Povpraševanja</h1>
        <p className="text-muted-foreground mt-1">Povpraševanja iz javnega obrazca, najnovejša najprej.</p>
      </div>

      {isLoading && (
        <div className="min-h-40 grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      )}
      {isError && (
        <Card><CardContent className="py-8 text-center text-destructive">Povpraševanj ni bilo mogoče naložiti.</CardContent></Card>
      )}
      {!isLoading && !isError && data?.length === 0 && (
        <Card><CardContent className="py-12 text-center"><Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">Povpraševanj še ni.</p></CardContent></Card>
      )}

      <div className="space-y-4">
        {data?.map((enquiry) => {
          const status = statusDetails[enquiry.deliveryStatus];
          const Icon = status.icon;
          return (
            <Card key={enquiry.id}>
              <CardContent className="p-5 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{enquiry.propertyName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(enquiry.submittedAt).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <Badge variant="outline" className={`w-fit gap-1.5 ${status.className}`}>
                    <Icon className="h-3.5 w-3.5" />{status.label}
                  </Badge>
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div><dt className="text-muted-foreground">Kontakt</dt><dd className="font-medium">{enquiry.name} · <a className="text-primary hover:underline" href={`mailto:${enquiry.email}`}>{enquiry.email}</a></dd></div>
                  <div><dt className="text-muted-foreground">Vrsta</dt><dd className="font-medium">{enquiry.propertyType}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Naslov nastanitve</dt><dd className="font-medium">{enquiry.address}</dd></div>
                  {enquiry.message && <div className="sm:col-span-2"><dt className="text-muted-foreground">Sporočilo</dt><dd className="mt-1 whitespace-pre-wrap">{enquiry.message}</dd></div>}
                </dl>
                <div className="pt-3 border-t text-xs text-muted-foreground">
                  ID ponudnika: <span className="font-mono">{enquiry.providerMessageId || "—"}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Povpraševanja se samodejno izbrišejo po 24 mesecih.</p>
    </div>
  );
}