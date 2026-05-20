import anatomyBack from "@/assets/bodymap/anatomy-back.png";

/**
 * Vista posterior — imagem anatômica premium (raster).
 * ViewBox 360×800. Halos/regiões são desenhados por cima em BodyMapSVG.
 */
export function AnatomyBack() {
  return (
    <image
      href={anatomyBack}
      x="0"
      y="0"
      width="360"
      height="800"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
