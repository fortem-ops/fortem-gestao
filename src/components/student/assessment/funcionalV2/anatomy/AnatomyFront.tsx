import anatomyFront from "@/assets/bodymap/anatomy-front.png";

/**
 * Vista anterior — imagem anatômica premium (raster).
 * ViewBox 1024×1024. Halos/regiões são desenhados por cima em BodyMapSVG.
 */
export function AnatomyFront() {
  return (
    <image
      href={anatomyFront}
      x="0"
      y="0"
      width="1024"
      height="1024"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
