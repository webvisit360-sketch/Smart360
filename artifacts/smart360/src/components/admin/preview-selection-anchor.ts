/** Visual identity is deliberately independent of the record/form resolver. */
export function capturePreviewAnchor(element: Element) {
  const doc = element.ownerDocument;
  const path: string[] = [];
  let node: Element | null = element;
  while (node && node !== doc.documentElement) {
    const siblings: Element[] = node.parentElement
      ? Array.from(node.parentElement.children).filter(el => el.tagName === node!.tagName)
      : [];
    path.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
    node = node.parentElement;
  }
  const selector = `html > ${path.join(" > ")}`;
  const location = doc.defaultView?.location.href;
  const tag = element.tagName;
  const classes = element.getAttribute("class") ?? "";
  const href = element.getAttribute("href");
  const testId = element.getAttribute("data-testid");
  const text = element.textContent?.trim() ?? "";
  const matches = (candidate: Element) =>
    candidate.tagName === tag &&
    (candidate.getAttribute("class") ?? "") === classes &&
    candidate.getAttribute("href") === href &&
    candidate.getAttribute("data-testid") === testId;
  return {
    element,
    rect: element.getBoundingClientRect(),
    resolve(currentDoc: Document): Element | null {
      if (currentDoc.defaultView?.location.href !== location) return null;
      if (element.ownerDocument === currentDoc && element.isConnected) return element;
      const replacement = currentDoc.querySelector(selector);
      if (replacement && matches(replacement)) return replacement;
      // Entry splash/held-view siblings can alter nth-of-type positions after
      // reload. Recover only the same leaf fingerprint, never its data owner.
      const candidates = Array.from(currentDoc.getElementsByTagName(tag))
        .filter(candidate => {
          if (!matches(candidate)) return false;
          const rect = candidate.getBoundingClientRect();
          const style = currentDoc.defaultView?.getComputedStyle(candidate);
          return rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden";
        });
      if (candidates.length === 1) return candidates[0]!;
      const sameText = candidates.filter(candidate => candidate.textContent?.trim() === text);
      return sameText.length === 1 ? sameText[0]! : null;
    },
  };
}
