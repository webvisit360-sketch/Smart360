import rawTermsHtml from "@assets/Smart360-pogoji-stran_3_1787893045915.html?raw";

const termsHtml = rawTermsHtml.replace(
  "</head>",
  '<style>@import url("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap");</style></head>',
);

export default function TermsPage() {
  return <iframe title="Pogoji uporabe Smart360" srcDoc={termsHtml} className="block w-full h-[100dvh] border-0 bg-[#F4F6F2]" />;
}