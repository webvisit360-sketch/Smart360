import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

content = content.replace("const isCustom = isExplore && getSkeletonIndex(category.label) === 999;", "const isCustom = isExplore && getSkeletonIndex(category) === 999;")
content = content.replace("const idxA = getSkeletonIndex(a.label);", "const idxA = getSkeletonIndex(a);")
content = content.replace("const idxB = getSkeletonIndex(b.label);", "const idxB = getSkeletonIndex(b);")

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)

print("Fixed getSkeletonIndex calls")
