import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

to_replace = """export function ContentEditor({
  sections,
  tenantId,
}: {
  sections: Section[];
  tenantId: string;
}) {
  const [addSectionOpen, setAddSectionOpen] = useState(false);"""

replacement = """export function ContentEditor({
  sections,
  tenantId,
}: {
  sections: Section[];
  tenantId: string;
}) {
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const allCategories = React.useMemo(() => {
    return sections.flatMap(s => (s.categories || []).map(c => ({ ...c, sectionKey: s.key })));
  }, [sections]);"""

if to_replace in content:
    content = content.replace(to_replace, replacement)
    # Also need to import React if not already
    if "import React" not in content and "import * as React" not in content and "useMemo" not in content:
        content = content.replace('import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";', 'import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from "react";')
else:
    print("ContentEditor not found as expected.")
    
with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)
