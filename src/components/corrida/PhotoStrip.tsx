import { ScrollReveal } from "./ScrollReveal";

interface PhotoStripProps {
  images: { src: string; alt: string }[];
  variant?: "left" | "right" | "full";
}

const PhotoStrip = ({ images, variant = "full" }: PhotoStripProps) => {
  if (variant === "full") {
    return (
      <div className="w-full overflow-hidden">
        <div className="grid grid-cols-2 md:flex gap-1 md:gap-3">
          {images.map((img, i) => (
            <ScrollReveal key={i} direction={i % 2 === 0 ? "up" : "down"} delay={i * 0.08} className="md:flex-1 min-w-0">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    );
  }

  const isLeft = variant === "left";

  return (
    <div className="container mx-auto px-6">
      <div className={`flex flex-col md:flex-row gap-4 md:gap-6 items-center ${isLeft ? "" : "md:flex-row-reverse"}`}>
        <ScrollReveal direction={isLeft ? "left" : "right"} className="w-full md:w-1/2">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {images.slice(0, 4).map((img, i) => (
              <div key={i} className={`overflow-hidden rounded-xl ${i === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square"}`}>
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </ScrollReveal>
        <ScrollReveal direction={isLeft ? "right" : "left"} className="w-full md:w-1/2 py-8 md:py-0">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {images.slice(4, 7).map((img, i) => (
              <div key={i} className={`overflow-hidden rounded-xl ${i === 2 ? "col-span-2 aspect-[16/9]" : "aspect-[3/4]"}`}>
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
};

export default PhotoStrip;
