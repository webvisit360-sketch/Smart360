import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

content = content.replace("function getSkeletonIndex", "export function getSkeletonIndex")
content = content.replace("function layoutToLabel", "export function layoutToLabel")
content = content.replace("function guessCategory", "export function guessCategory")
content = content.replace("const OKOLICA_SKELETON_KEYS = [", "export const OKOLICA_SKELETON_KEYS = [")

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)
