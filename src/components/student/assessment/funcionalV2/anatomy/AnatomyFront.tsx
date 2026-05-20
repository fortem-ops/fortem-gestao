import anatomyFront from "@/assets/bodymap/anatomy-front.png";

/**
 * Vista anterior — imagem anatômica premium (raster).
 * ViewBox 300×800. Halos/regiões são desenhados por cima em BodyMapSVG.
 */
export function AnatomyFront() {
  return (
    <image
      href={anatomyFront}
      x="0"
      y="0"
      width="300"
      height="800"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
