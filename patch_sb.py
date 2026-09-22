import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "function SectionBlock({ section, tenantId }: { section: Section; tenantId: string }) {",
    "function SectionBlock({ section, tenantId, allCategories }: { section: Section; tenantId: string; allCategories?: Category[] }) {"
)

content = content.replace(
    "isExplore={isExplore}",
    "isExplore={isExplore}\n              allCategories={allCategories}"
)

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)
