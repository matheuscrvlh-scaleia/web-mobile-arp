import { useState } from "react";
import { useNavigate } from "react-router";
import { applyApiErrors } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useDuplicateSource } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import { LoadingRegion, PageHeader, Skeleton, toast } from "@/shared/ui";
import { useCoupon, useCreateCoupon, useCreateCoupons, useDefaultRedeemWindow } from "../api";
import { CouponForm } from "../components/CouponForm";
import { CouponLoadError } from "../components/CouponLoadError";
import {
  COUPON_FIELD_MAP,
  COUPON_FORM_FIELDS,
  toCreateFields,
} from "../components/coupon-form-schema";

/**
 * Nova promoção, do zero ou duplicada (`?de=<id>`: o formulário vem com os
 * dados dela, "(cópia)" no título e a loja livre). Com várias lojas, cria
 * uma promoção igual por loja e volta para a lista filtrada pelo título.
 */
export function CouponCreatePage() {
  const navigate = useNavigate();
  const sourceId = useDuplicateSource();
  const source = useCoupon(sourceId ?? undefined);
  const create = useCreateCoupon();
  const createMany = useCreateCoupons();
  const defaultWindow = useDefaultRedeemWindow();
  const [saving, setSaving] = useState<"draft" | "active" | null>(null);

  const header = (
    <PageHeader
      title={sourceId ? "Duplicar promoção" : "Nova promoção"}
      description={
        sourceId
          ? "Confira as datas e a loja antes de salvar. A cópia nasce como rascunho até você publicar."
          : "O lojista libera N cupons; cada visitante pega um código único com prazo para usar."
      }
      back={{ to: sourceId ? PATHS.coupon(sourceId) : PATHS.coupons, label: "Promoções" }}
    />
  );

  if (sourceId && source.error)
    return <CouponLoadError error={source.error} onRetry={() => void source.refetch()} />;
  if (sourceId && !source.data) {
    return (
      <>
        {header}
        <LoadingRegion>
          <Skeleton className="h-[40rem] rounded-[1.75rem]" />
        </LoadingRegion>
      </>
    );
  }

  return (
    <>
      {header}
      <CouponForm
        source={source.data}
        saving={saving}
        onSubmit={(values, { form, allowLeave }) => {
          const fields = toCreateFields(values, defaultWindow.hours);
          const published = values.status === "active";
          const future = new Date(values.startsAt).getTime() > Date.now();
          const verb = !published ? "salva como rascunho" : future ? "agendada" : "publicada";
          const fail = (e: unknown) => {
            setSaving(null);
            if (!applyApiErrors(e, form.setError, COUPON_FORM_FIELDS, COUPON_FIELD_MAP))
              toast.fromError(e);
          };
          setSaving(values.status);
          if (values.storeIds.length === 1) {
            create.mutate(
              { ...fields, storeId: values.storeIds[0] ?? "" },
              {
                onSuccess: ({ id }) => {
                  toast.success(`Promoção ${verb}.`);
                  allowLeave();
                  navigate(PATHS.coupon(id));
                },
                onError: fail,
              },
            );
            return;
          }
          createMany.mutate(
            { ...fields, storeIds: values.storeIds },
            {
              onSuccess: ({ data }) => {
                toast.success(
                  `${plural(data.length, "promoção", "promoções")} ${verb.replace("salva", "salvas").replace(/a$/, "as")}.`,
                );
                allowLeave();
                navigate(`${PATHS.coupons}?visao=tabela&q=${encodeURIComponent(values.title)}`);
              },
              onError: fail,
            },
          );
        }}
      />
    </>
  );
}
