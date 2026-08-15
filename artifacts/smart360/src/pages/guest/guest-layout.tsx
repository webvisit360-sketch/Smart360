import { ReactNode } from "react";
import "@/styles/smart360-sredozemski.css";
import { IconSprite } from "./IconSprite";

export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <IconSprite />
      {children}
    </>
  );
}
