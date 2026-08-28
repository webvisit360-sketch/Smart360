import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useGetAdminSession } from "@workspace/api-client-react";
import rawTermsHtml from "@assets/Smart360-pogoji-stran_3_1787893045915.html?raw";

const termsHtml = rawTermsHtml.replace(
  "</head>",
  '<style>@import url("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap");</style></head>',
);

export default function TermsPage() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading, isError } = useGetAdminSession();
  const authenticated = !isError && Boolean(session?.authenticated);

  useEffect(() => {
    if (!isLoading && !authenticated) setLocation("/admin/login", { replace: true });
  }, [authenticated, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-[100dvh] grid place-items-center bg-[#F4F6F2]"><Loader2 className="h-8 w-8 animate-spin text-[#157347]" /></div>;
  }
  if (!authenticated) return null;

  return <iframe title="Pogoji uporabe Smart360" srcDoc={termsHtml} className="block w-full h-[100dvh] border-0 bg-[#F4F6F2]" />;
}