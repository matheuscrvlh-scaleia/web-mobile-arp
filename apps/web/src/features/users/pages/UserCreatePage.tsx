import { passwordSchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { Card, CardHeader, FormSection, PageHeader, SaveBar, toast } from "@/shared/ui";
import { useCreateUser } from "../api";
import { generatePassword, PasswordField } from "../components/PasswordField";
import { TemporaryPasswordModal } from "../components/TemporaryPasswordModal";
import {
  USER_PROFILE_FIELDS,
  UserFields,
  type UserProfileInput,
  type UserProfileValues,
  userProfileSchema,
} from "../components/UserFields";

const STEPS = [
  "Você cria o usuário com uma senha provisória.",
  "Passa o e-mail e a senha para a pessoa por um canal seguro.",
  "No primeiro acesso, ela define a própria senha.",
  "O que ela vê vem do cargo. As permissões de cada cargo ficam em Cargos.",
];

export function UserCreatePage() {
  const navigate = useNavigate();
  const create = useCreateUser();
  const form = useForm<UserProfileInput, unknown, UserProfileValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: { name: "", email: "", roleId: "", storeId: null },
  });
  // Já abre com uma senha gerada: é só copiar e passar.
  const [password, setPassword] = useState(generatePassword);
  const [passwordError, setPasswordError] = useState<string>();
  const [created, setCreated] = useState<{ id: string; name: string; password: string } | null>(
    null,
  );
  const { allowLeave } = useUnsavedChangesGuard(
    form.formState.isDirty && !create.isPending && !created,
  );

  const onSubmit = form.handleSubmit((profile) => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message);
      return;
    }
    setPasswordError(undefined);
    create.mutate(
      { ...profile, password: parsed.data },
      {
        onSuccess: ({ user, temporaryPassword }) => {
          allowLeave();
          // A senha aparece mais uma vez, para conferir e copiar.
          setCreated({ id: user.id, name: user.name, password: temporaryPassword ?? parsed.data });
          toast.success(`${user.name} já pode entrar no painel.`);
        },
        onError: (e) => {
          if (!applyApiErrors(e, form.setError, USER_PROFILE_FIELDS, { password: "password" }))
            toast.error(errorMessage(e));
        },
      },
    );
  });

  return (
    <>
      <PageHeader
        title="Novo usuário"
        description="Dê acesso a alguém da equipe. O acesso vale assim que você criar."
        back={{ to: PATHS.users, label: "Usuários" }}
      />
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card padding="lg">
            <UserFields form={form} autoFocus />
            <FormSection
              title="Senha provisória"
              description="Gerada agora. Copie antes de criar e passe para a pessoa."
            >
              <PasswordField value={password} onChange={setPassword} error={passwordError} />
            </FormSection>
          </Card>
          <Card>
            <CardHeader title="Como funciona" />
            <ol className="flex flex-col gap-4">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-neutral-600">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <SaveBar
          dirty={form.formState.isDirty}
          saving={create.isPending}
          alwaysVisible
          submitLabel="Criar usuário"
        />
      </form>
      <TemporaryPasswordModal
        password={created?.password ?? null}
        userName={created?.name ?? ""}
        closeLabel="Ir para o usuário"
        onClose={() => created && navigate(PATHS.user(created.id))}
      />
    </>
  );
}
