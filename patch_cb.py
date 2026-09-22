import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "function CategoryBlock({ category, tenantId, sectionKey, sectionCategories, isExplore }: { category: Category; tenantId: string; sectionKey?: string; sectionCategories?: Category[]; isExplore?: boolean }) {",
    "function CategoryBlock({ category, tenantId, sectionKey, sectionCategories, isExplore, allCategories }: { category: Category; tenantId: string; sectionKey?: string; sectionCategories?: Category[]; isExplore?: boolean; allCategories?: Category[] }) {"
)

# Replace ItemDialog instances in CategoryBlock to pass allCategories
content = content.replace(
    "ItemDialog mode=\"create\" tenantId={tenantId} categoryId={category.id} sectionKey={sectionKey} sectionCategories={sectionCategories}",
    "ItemDialog mode=\"create\" tenantId={tenantId} categoryId={category.id} sectionKey={sectionKey} sectionCategories={sectionCategories} allCategories={allCategories}"
)

# And in ItemRow
content = content.replace(
    "sectionCategories={sectionCategories} layout={category.layout}",
    "sectionCategories={sectionCategories} allCategories={allCategories} layout={category.layout}"
)

# And in ItemRow declaration
content = content.replace(
    "function ItemRow({ item, tenantId, categoryId, sectionKey, sectionCategories, layout }: { item: Item; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; layout?: string }) {",
    "function ItemRow({ item, tenantId, categoryId, sectionKey, sectionCategories, allCategories, layout }: { item: Item; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; allCategories?: Category[]; layout?: string }) {"
)

# And in ItemRow's ItemDialog
content = content.replace(
    "sectionCategories={sectionCategories}\n            item={item}",
    "sectionCategories={sectionCategories}\n            allCategories={allCategories}\n            item={item}"
)


with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)
