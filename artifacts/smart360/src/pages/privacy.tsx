import rawPrivacyHtml from "@assets/zasebnost_1_1787944560129.html?raw";

const privacyHtml = rawPrivacyHtml.replace(
  "</head>",
  '<style>@import url("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap");</style></head>',
);

export default function PrivacyPage() {
  return (
    <iframe
      title="Obvestilo o zasebnosti Smart360"
      srcDoc={privacyHtml}
      className="block w-full h-[100dvh] border-0 bg-[#F4F6F2]"
    />
  );
}