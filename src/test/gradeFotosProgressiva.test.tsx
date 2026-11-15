// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import GradeFotos from "@/site/fotosEvento/GradeFotos";
import type { FotoPublica } from "@/site/fotosEvento/api";

let disparar: (() => void) | null = null;
class IO {
  constructor(cb: IntersectionObserverCallback) { disparar = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  observe() {} disconnect() {} unobserve() {} takeRecords() { return []; }
}
const foto = (i: number, mini = true): FotoPublica => ({ id: `f${i}`, largura: 1200, altura: 800, orientacao: "horizontal", url_previa: `p${i}`, url_original: `o${i}`, url_miniatura: mini ? `m${i}` : null });

describe("Grade de fotos progressiva", () => {
  beforeEach(() => { disparar = null; vi.stubGlobal("IntersectionObserver", IO); });

  it("mostra 12, depois mais 12 ao chegar no fim, e pede a próxima página só quando acabou", () => {
    const onMais = vi.fn();
    const fotos = Array.from({ length: 20 }, (_, i) => foto(i));
    const { container } = render(<GradeFotos fotos={fotos} pb={false} onAbrir={() => {}} temMais onMais={onMais} />);
    expect(container.querySelectorAll(".fe-grade img")).toHaveLength(12);
    act(() => disparar!());
    expect(container.querySelectorAll(".fe-grade img")).toHaveLength(20);
    expect(onMais).not.toHaveBeenCalled();
    act(() => disparar!());
    expect(onMais).toHaveBeenCalledTimes(1);
  });

  it("imagens com lazy/async; usa miniatura e cai para a prévia se faltar ou falhar", () => {
    const { container } = render(<GradeFotos fotos={[foto(1), foto(2, false)]} pb={false} onAbrir={() => {}} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs[0].getAttribute("loading")).toBe("lazy");
    expect(imgs[0].getAttribute("decoding")).toBe("async");
    expect(imgs[0].getAttribute("src")).toBe("m1");
    expect(imgs[1].getAttribute("src")).toBe("p2");
    fireEvent.error(imgs[0]);
    expect(container.querySelectorAll("img")[0].getAttribute("src")).toBe("p1");
  });
});
