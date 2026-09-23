import React, { Suspense, lazy } from "react";
import type { LucideProps } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { lucideIconName } from "@workspace/category-icons";
import { spriteId } from "@/pages/guest/sprite-icon";

type DynamicIconName = keyof typeof dynamicIconImports;
const cache = new Map<DynamicIconName, React.LazyExoticComponent<React.ComponentType<LucideProps>>>();

export const availableLucideIconNames = Object.keys(dynamicIconImports).sort() as DynamicIconName[];

export function isAvailableLucideIcon(icon?: string | null): boolean {
  const name = lucideIconName(icon);
  return !!name && name in dynamicIconImports;
}

function lazyLucide(name: DynamicIconName) {
  let component = cache.get(name);
  if (!component) {
    component = lazy(dynamicIconImports[name]);
    cache.set(name, component);
  }
  return component;
}

/**
 * Renders new lucide:* keys lazily and leaves every historical key on the
 * existing sprite renderer, preserving seeded artwork and unknown fallbacks.
 */
export function CategoryIcon({
  icon,
  className,
  ...props
}: { icon?: string | null; className?: string } & Omit<LucideProps, "ref">) {
  const name = lucideIconName(icon);
  if (name && name in dynamicIconImports) {
    const LucideIcon = lazyLucide(name as DynamicIconName);
    return (
      <Suspense fallback={<span className={className} aria-hidden="true" />}>
        <LucideIcon className={className} aria-hidden="true" {...props} />
      </Suspense>
    );
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <use href={`#${spriteId(icon)}`} />
    </svg>
  );
}