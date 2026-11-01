import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { PageHeader, toast } from "@/shared/ui";
import { useCreateCoupon } from "../api";
import { CouponForm } from "../components/CouponForm";
import {
  COUPON_FIELD_MAP,
  COUPON_FORM_FIELDS,
  toCreateBody,
} from "../components/coupon-form-schema";

export function CouponCreatePage() {
  const navigate = useNavigate();
  const create = useCreateCoupon();
  return (
    <>
      <PageHeader
        title="Nova promoção"
        description="O lojista libera N cupons; cada visitante pega um código único com prazo para usar."
        back={{ to: PATHS.coupons, label: "Promoções" }}
      />
      <CouponForm
        submitLabel="Criar promoção"
        saving={create.isPending}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(toCreateBody(values), {
            onSuccess: ({ id }) => {
              toast.success(
                values.status === "active" ? "Promoção publicada." : "Rascunho da promoção criado.",
              );
              allowLeave();
              navigate(PATHS.coupon(id));
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, COUPON_FORM_FIELDS, COUPON_FIELD_MAP))
                toast.error(errorMessage(e));
            },
          })
        }
      />
    </>
  );
}
