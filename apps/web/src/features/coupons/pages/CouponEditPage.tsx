import { useNavigate, useParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { LoadingRegion, PageHeader, Skeleton, toast } from "@/shared/ui";
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
  return (
    <>
      <PageHeader
        title="Editar promoção"
        documentTitle={`Editar ${c.title}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {c.title} <CouponStatusBadge status={c.status} />
          </span>
        }
        back={{ to: PATHS.coupon(c.id), label: "Voltar à promoção" }}
      />
      <CouponForm
        coupon={c}
        submitLabel="Salvar promoção"
        saving={update.isPending}
        onSubmit={(values, { form, allowLeave }) => {
          const body = toUpdateBody(values, form.formState.dirtyFields);
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
                toast.error(errorMessage(e));
            },
          });
        }}
      />
    </>
  );
}
