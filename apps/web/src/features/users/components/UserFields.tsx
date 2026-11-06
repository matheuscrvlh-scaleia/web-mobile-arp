import { createUserBodySchema, isMerchantRoleName } from "@arp/contracts";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useRoles } from "@/features/roles";
import { StoreSelect } from "@/features/stores";
import { plural } from "@/shared/lib/format";
import { Field, FieldRow, FormSection, Input, Select } from "@/shared/ui";

/** Campos de quem é a pessoa e o que acessa (criar e editar usam os mesmos). */
export const userProfileSchema = createUserBodySchema.pick({
  name: true,
  email: true,
  roleId: true,
  storeId: true,
});
export type UserProfileInput = z.input<typeof userProfileSchema>;
export type UserProfileValues = z.output<typeof userProfileSchema>;
export const USER_PROFILE_FIELDS = ["name", "email", "roleId", "storeId"];

export type UserProfileForm = UseFormReturn<UserProfileInput, unknown, UserProfileValues>;

export function UserFields({
  form: f,
  autoFocus = false,
}: {
  form: UserProfileForm;
  autoFocus?: boolean;
}) {
  const { errors } = f.formState;
  const roles = useRoles();
  const roleId = useWatch({ control: f.control, name: "roleId" });
  const role = roles.data?.find((r) => r.id === roleId);
  const storeId = useWatch({ control: f.control, name: "storeId" });
  // Loja só para cargo de lojista (e para quem já tem uma, até trocar o cargo).
  const merchant = Boolean(role && isMerchantRoleName(role.name));
  const showStore = merchant || Boolean(storeId);
  const roleField = f.register("roleId");

  return (
    <>
      <FormSection title="Pessoa" description="Nome e e-mail de acesso.">
        <FieldRow>
          <Field label="Nome" required error={errors.name?.message}>
            <Input autoFocus={autoFocus} autoComplete="off" {...f.register("name")} />
          </Field>
          <Field label="E-mail" required error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="off"
              placeholder="nome@arp.com.br"
              {...f.register("email")}
            />
          </Field>
        </FieldRow>
      </FormSection>
      <FormSection title="Acesso" description="O cargo define as telas e ações liberadas.">
        <Field
          label="Cargo"
          required
          error={errors.roleId?.message}
          hint={
            role
              ? `${plural(role.permissions.length, "permissão", "permissões")}${role.description ? ` · ${role.description}` : ""}`
              : undefined
          }
        >
          <Select
            placeholder="Escolha o cargo"
            {...roleField}
            onChange={(e) => {
              void roleField.onChange(e);
              // Trocou para um cargo que não é de lojista: a loja deixa de valer.
              const next = roles.data?.find((r) => r.id === e.target.value);
              if (next && !isMerchantRoleName(next.name) && f.getValues("storeId")) {
                f.setValue("storeId", null, { shouldDirty: true });
              }
            }}
          >
            {(roles.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        {showStore && (
          <Field
            label="Loja"
            required={merchant}
            hint="O lojista só vê e valida o que é da própria loja."
            error={errors.storeId?.message}
          >
            <Controller
              control={f.control}
              name="storeId"
              render={({ field }) => (
                <StoreSelect
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        )}
      </FormSection>
    </>
  );
}
