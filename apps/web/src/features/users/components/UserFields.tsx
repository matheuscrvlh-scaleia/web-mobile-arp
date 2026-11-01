import { createUserBodySchema } from "@arp/contracts";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useRoles } from "@/features/roles";
import { useStoreOptions } from "@/features/stores";
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
  const stores = useStoreOptions();
  const roleId = useWatch({ control: f.control, name: "roleId" });
  const role = roles.data?.find((r) => r.id === roleId);

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
          <Select placeholder="Escolha o cargo" {...f.register("roleId")}>
            {(roles.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Loja do lojista"
          hint="Com loja, a pessoa só vê e valida o que é da própria loja."
          error={errors.storeId?.message}
        >
          <Controller
            control={f.control}
            name="storeId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                onBlur={field.onBlur}
              >
                <option value="">Sem loja (equipe da ARP)</option>
                {(stores.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          />
        </Field>
      </FormSection>
    </>
  );
}
