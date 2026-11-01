import { ArrowLeft, BarChart3, Clock, FileText, MapPin } from "lucide-react";
import { Link, useParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS, STORE_TABS, type StoreTab } from "@/shared/config/paths";
import { useDocumentTitle, useSearchParamOption } from "@/shared/hooks";
import { pickDirty } from "@/shared/lib/forms";
import {
  LoadError,
  LoadingRegion,
  Skeleton,
  type TabItem,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import { useStore, useUpdateStore } from "../api";
import { HoursEditor } from "../components/HoursEditor";
import { LocationEditor } from "../components/LocationEditor";
import { STORE_FORM_FIELDS, StoreForm } from "../components/StoreForm";
import { StoreHero } from "../components/StoreHero";
import { StorePerformance } from "../components/StorePerformance";

const TAB_ITEMS: TabItem<StoreTab>[] = [
  { value: "dados", label: "Dados", icon: FileText },
  { value: "horarios", label: "Horários", icon: Clock },
  { value: "localizacao", label: "Localização", icon: MapPin },
  { value: "desempenho", label: "Desempenho", icon: BarChart3 },
];

export function StoreDetailPage() {
  const { id = "" } = useParams();
  const { can, user } = useAuth();
  const store = useStore(id);
  const update = useUpdateStore(id);
  const [tab, setTab] = useSearchParamOption("aba", STORE_TABS, "dados");
  useDocumentTitle(store.data?.name ?? "Loja");

  const readOnly = !can("stores.manage");
  // Cada aba exige a permissão das rotas que ela usa.
  const tabs = TAB_ITEMS.filter(
    (t) =>
      (t.value !== "desempenho" || can("coupons.view")) &&
      (t.value !== "localizacao" || can("map.view")),
  );
  const current = tabs.some((t) => t.value === tab) ? tab : "dados";

  if (store.error) {
    return (
      <LoadError
        error={store.error}
        onRetry={() => void store.refetch()}
        icon={MapPin}
        title="Loja não encontrada"
        description="Ela pode ter sido removida ou o endereço está errado."
        back={{ to: PATHS.stores, label: "Ver todas as lojas" }}
      />
    );
  }

  if (!store.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-64 rounded-[2rem]" />
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <Skeleton className="h-96 rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  const s = store.data;
  return (
    <>
      {!user?.store && (
        <Link
          to={PATHS.stores}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Lojas
        </Link>
      )}
      <StoreHero store={s} />
      <Tabs
        idBase="loja"
        label="Seções da loja"
        items={tabs}
        value={current}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="loja" value={current}>
        {current === "dados" && (
          <StoreForm
            store={s}
            readOnly={readOnly}
            submitLabel="Salvar dados"
            saving={update.isPending}
            onSubmit={(values, { form }) => {
              const body = pickDirty(values, form.formState.dirtyFields);
              if (Object.keys(body).length === 0) return;
              update.mutate(body, {
                onSuccess: () => {
                  form.reset(values);
                  toast.success("Dados da loja salvos.");
                },
                onError: (e) => {
                  if (!applyApiErrors(e, form.setError, STORE_FORM_FIELDS))
                    toast.error(errorMessage(e));
                },
              });
            }}
          />
        )}
        {current === "horarios" && <HoursEditor store={s} readOnly={readOnly} />}
        {current === "localizacao" && <LocationEditor store={s} readOnly={!can("map.manage")} />}
        {current === "desempenho" && <StorePerformance storeId={s.id} />}
      </TabPanel>
    </>
  );
}
