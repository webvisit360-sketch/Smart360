import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";',
    'import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from "react";'
)

content = content.replace(
    '<SectionBlock key={section.id} section={section} tenantId={tenantId} />',
    '<SectionBlock key={section.id} section={section} tenantId={tenantId} allCategories={allCategories as any} />'
)

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)
