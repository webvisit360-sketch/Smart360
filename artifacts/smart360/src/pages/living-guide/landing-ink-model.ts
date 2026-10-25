/** Relative sRGB luminance, averaged only across the host text's image region. */
export function landingInk(pixels: ArrayLike<number>): "dark" | "pale" {
  let sum = 0, count = 0;
  const linear = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 250) continue;
    sum += .2126 * linear(pixels[i]) + .7152 * linear(pixels[i + 1]) + .0722 * linear(pixels[i + 2]);
    count++;
  }
  if (!count) return "pale";
  const l = sum / count;
  // Compare the two actual ink colors, rather than the whole image's brightness.
  const darkL = .2126 * linear(17) + .7152 * linear(24) + .0722 * linear(32);
  return (l + .05) / (darkL + .05) > 1.05 / (l + .05) ? "dark" : "pale";
}

export function coverImageCrop(
  naturalWidth: number, naturalHeight: number, width: number, height: number,
  focusX: number, focusY: number,
  region: { x: number; y: number; width: number; height: number },
) {
  const scale = Math.max(width / naturalWidth, height / naturalHeight);
  const left = (width - naturalWidth * scale) * focusX / 100;
  const top = (height - naturalHeight * scale) * focusY / 100;
  return { x: (region.x - left) / scale, y: (region.y - top) / scale,
    width: region.width / scale, height: region.height / scale };
}
