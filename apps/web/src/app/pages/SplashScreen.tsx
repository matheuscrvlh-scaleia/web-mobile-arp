import { Spinner } from "@/shared/ui";

/** Enquanto a sessão é restaurada pelo cookie (alguns ms ao abrir o painel). */
export function SplashScreen() {
  return (
    <output className="grid min-h-dvh place-items-center" aria-busy="true">
      <span className="flex flex-col items-center gap-4 text-sm text-neutral-500">
        <img
          src="/brand/logo.png"
          alt=""
          width={56}
          height={56}
          className="size-14 rounded-2xl shadow-lg"
        />
        <span className="flex items-center gap-2">
          <Spinner />
          Abrindo o painel…
        </span>
      </span>
    </output>
  );
}
