import { hasImageVariants, IMAGE_WIDTHS, imageVariantUrl } from "@arp/contracts";
import type { ImgHTMLAttributes, SyntheticEvent } from "react";

/**
 * Props de <img> para imagem pequena (lista, card, avatar): as miniaturas
 * WebP da API num srcset, e o navegador escolhe pela largura exibida
 * (`sizes`) e pela densidade da tela. URL externa fica como está.
 * Se a miniatura faltar (imagem antiga antes do backfill), cai na original.
 */
export function thumbnailProps(
  url: string,
  sizes: string,
): Pick<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes" | "onError"> {
  if (!hasImageVariants(url)) return { src: url };
  return {
    src: imageVariantUrl(url, 480),
    srcSet: IMAGE_WIDTHS.map((w) => `${imageVariantUrl(url, w)} ${w}w`).join(", "),
    sizes,
    onError: (e: SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.dataset.original) return;
      img.dataset.original = "1";
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = url;
    },
  };
}
