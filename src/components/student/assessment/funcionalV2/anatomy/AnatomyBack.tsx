import anatomyBack from "@/assets/bodymap/anatomy-back.png";

/**
 * Vista posterior — imagem anatômica premium (raster).
 * ViewBox 1024×1024. Halos/regiões são desenhados por cima em BodyMapSVG.
 */
export function AnatomyBack() {
  return (
    <image
      href={anatomyBack}
      x="0"
      y="0"
      width="1024"
      height="1024"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
