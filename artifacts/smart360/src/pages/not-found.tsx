import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">Stran ne obstaja.</p>
      <Link href="/">
        <Button>Nazaj na prvo stran</Button>
      </Link>
    </div>
  );
}
