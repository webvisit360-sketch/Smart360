# Changelog

## Unreleased

- **STRUCTURAL REBUILD — DEVICE ACCEPTANCE PENDING:** The Living Guide detail root writes one immutable hero-height variable before first paint. The moving sheet has square top corners; the white panel keeps its 28 px top radius and begins at `calc(var(--lg2-detail-hero-height) - 26px)`, so its curved corner and grabber overlap the photo without depending on rendered image measurements. Dependency and nine-point motion tests were proven red on the prior structures and green after the rebuild.