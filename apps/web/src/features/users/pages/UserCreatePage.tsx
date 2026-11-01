import { passwordSchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import {
  Button,
  Card,
  Field,
  FormSection,
  PageHeader,
  PasswordInput,
  SaveBar,
  Segmented,
  toast,
} from "@/shared/ui";
import { useCreateUser } from "../api";
import { TemporaryPasswordModal } from "../components/TemporaryPasswordModal";
import {
  USER_PROFILE_FIELDS,
  UserFields,
  type UserProfileInput,
  type UserProfileValues,
  userProfileSchema,
} from "../components/UserFields";

type PasswordMode = "gerar" | "definir";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Senha forte gerada no navegador (letras e números, sem caracteres ambíguos). */
function strongPassword(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  const raw = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  // Garante letra e número (regra do contrato).
  return `${raw}7a`;
}

export function UserCreatePage() {
  const navigate = useNavigate();
  const create = useCreateUser();
  const form = useForm<UserProfileInput, unknown, UserProfileValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: { name: "", email: "", roleId: "", storeId: null },
  });
  const [mode, setMode] = useState<PasswordMode>("gerar");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [created, setCreated] = useState<{ id: string; name: string; password: string } | null>(
    null,
  );
  const { allowLeave } = useUnsavedChangesGuard(
    form.formState.isDirty && !create.isPending && !created,
  );

  const onSubmit = form.handleSubmit((profile) => {
    let chosen: string | undefined;
    if (mode === "definir") {
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
        setPasswordError(parsed.error.issues[0]?.message);
        return;
      }
      chosen = parsed.data;
    }
    setPasswordError(undefined);
    create.mutate(
      { ...profile, password: chosen },
      {
        onSuccess: ({ user, temporaryPassword }) => {
          allowLeave();
          if (temporaryPassword) {
            setCreated({ id: user.id, name: user.name, password: temporaryPassword });
          } else {
            toast.success(`${user.name} já pode entrar no painel.`);
            navigate(PATHS.user(user.id));
          }
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
        description="A pessoa recebe uma senha provisória e cria a dela no primeiro acesso."
        back={{ to: PATHS.users, label: "Usuários" }}
      />
      <form onSubmit={onSubmit} noValidate>
        <Card padding="lg">
          <UserFields form={form} autoFocus />
          <FormSection title="Senha" description="O mais seguro é deixar o sistema gerar.">
            <Segmented
              label="Como definir a senha"
              value={mode}
              onChange={setMode}
              options={[
                { value: "gerar", label: "Gerar provisória" },
                { value: "definir", label: "Definir agora" },
              ]}
            />
            {mode === "gerar" ? (
              <p className="text-sm text-neutral-500">
                A senha aparece uma única vez depois de criar, para você passar à pessoa.
              </p>
            ) : (
              <Field
                label="Senha"
                required
                hint="8 caracteres ou mais, com letra e número."
                error={passwordError}
              >
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PasswordInput
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    icon={Wand2}
                    onClick={() => setPassword(strongPassword())}
                  >
                    Gerar
                  </Button>
                </div>
              </Field>
            )}
          </FormSection>
        </Card>
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
