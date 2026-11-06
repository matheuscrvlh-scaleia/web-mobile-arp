import { Archive, Copy, Lock } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { applyApiErrors } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { duplicateHref } from "@/shared/hooks";
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingRegion,
  PageHeader,
  Skeleton,
  toast,
} from "@/shared/ui";
import { useCoupon, useUpdateCoupon } from "../api";
import { CouponStatusBadge } from "../components/CouponBadges";
import { CouponForm } from "../components/CouponForm";
import { CouponLoadError } from "../components/CouponLoadError";
import {
  COUPON_FIELD_MAP,
  COUPON_FORM_FIELDS,
  toUpdateBody,
} from "../components/coupon-form-schema";

export function CouponEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const coupon = useCoupon(id);
  const update = useUpdateCoupon(id);

  if (coupon.error)
    return <CouponLoadError error={coupon.error} onRetry={() => void coupon.refetch()} />;
  if (!coupon.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-80 max-w-full rounded-full" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-[40rem] rounded-[1.75rem]" />
          <Skeleton className="h-[36rem] rounded-[3rem]" />
        </div>
      </LoadingRegion>
    );
  }

  const c = coupon.data;
  const header = (
    <PageHeader
      title="Editar promoção"
      documentTitle={`Editar ${c.title}`}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          {c.title} <CouponStatusBadge coupon={c} />
        </span>
      }
      back={{ to: PATHS.coupon(c.id), label: "Voltar à promoção" }}
    />
  );

  // Encerrada não volta ao ar nem muda; arquivada precisa ser desarquivada antes.
  if (c.status === "ended" || c.archivedAt) {
    const ended = c.status === "ended";
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={ended ? Lock : Archive}
            title={ended ? "Promoção encerrada não muda" : "Promoção arquivada"}
            description={
              ended
                ? "Ela não volta ao ar. Para repetir a oferta, duplique: a cópia vem preenchida e nasce como rascunho."
                : "Desarquive na página da promoção para editar, ou duplique para criar outra."
            }
            action={
              <span className="flex flex-wrap justify-center gap-2">
                <ButtonLink to={duplicateHref(PATHS.couponNew, c.id)} icon={Copy}>
                  Duplicar como nova
                </ButtonLink>
                <ButtonLink to={PATHS.coupon(c.id)} variant="secondary">
                  Ver a promoção
                </ButtonLink>
              </span>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <CouponForm
        coupon={c}
        saving={update.isPending ? "save" : null}
        onSubmit={(values, { form, allowLeave }) => {
          const body = toUpdateBody(values, form.formState.dirtyFields, c);
          if (Object.keys(body).length === 0) return;
          update.mutate(body, {
            onSuccess: () => {
              form.reset(form.getValues());
              toast.success("Promoção salva.");
              allowLeave();
              navigate(PATHS.coupon(c.id));
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, COUPON_FORM_FIELDS, COUPON_FIELD_MAP))
                toast.fromError(e);
            },
          });
        }}
      />
    </>
  );
}
