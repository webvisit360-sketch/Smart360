# Changelog

## Unreleased

- **STRUCTURAL REBUILD — DEVICE ACCEPTANCE PENDING:** The Living Guide detail root now writes one immutable hero-height variable before first paint. The hero and panel use that same root-owned grid value, the panel no longer overlaps with `margin-top: -26px`, and its rounded top, grabber, background, and content remain one element and paint layer. Dependency tests were proven red on the prior structure and green after the rebuild.