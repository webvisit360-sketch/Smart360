import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const isCustom = isExplore && getSkeletonIndex(category) === 999;",
    """const isCustom = isExplore && String((category as any).key).startsWith("host-custom");"""
)

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)

print("Fixed isCustom")
