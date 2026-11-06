import { changePasswordBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound, LogOut } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { applyApiErrors, errorMessage, isApiError } from "@/shared/api";
import { useAuth, useCurrentUser } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { safeNextPath } from "@/shared/lib/text";
import { Button, Field, FormError, PasswordInput, toast } from "@/shared/ui";
import { provisionalPassword, useChangePassword } from "../api";
import { AccessScreen } from "../components/AccessScreen";

// O corpo enviado é o do contrato; "repetir a senha" só existe na tela.
const formSchema = z
  .object({
    ...changePasswordBodySchema.shape,
    confirmPassword: z.string().min(1, "Repita a nova senha"),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "A nova senha precisa ser diferente da atual",
    path: ["newPassword"],
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "As senhas não são iguais",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof formSchema>;

const RULES = [
  { label: "8 caracteres ou mais", test: (v: string) => v.length >= 8 },
  { label: "Uma letra", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "Um número", test: (v: string) => /\d/.test(v) },
];

/**
 * Primeiro acesso (senha provisória): tela cheia, sem o menu. Fora disso,
 * trocar a senha fica em Minha conta, dentro do painel.
 */
export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Fixo na abertura: ao salvar, o usuário recarrega sem a flag e a tela navega.
  const [forced] = useState(user.mustChangePassword);
  if (!forced) return <Navigate to={PATHS.account} replace />;
  return (
    <AccessScreen
      documentTitle="Crie sua senha"
      title="Crie sua senha"
      subtitle={`Olá, ${user.name.split(" ")[0]}! Você entrou com uma senha provisória. Defina uma senha só sua para continuar.`}
    >
      <ChangePasswordForm
        forced
        onDone={() => navigate(safeNextPath(params.get("next")) ?? PATHS.home, { replace: true })}
      >
        <Button variant="ghost" icon={LogOut} onClick={() => void signOut()}>
          Sair
        </Button>
      </ChangePasswordForm>
    </AccessScreen>
  );
}

/** Formulário de trocar a própria senha (primeiro acesso e Minha conta). */
export function ChangePasswordForm({
  forced = false,
  onDone,
  children,
}: {
  forced?: boolean;
  onDone: () => void;
  /** Botões extras abaixo do salvar. */
  children?: ReactNode;
}) {
  const change = useChangePassword();
  // Veio direto do login: a senha provisória já foi digitada, não pede de novo.
  const [remembered] = useState(() => (forced ? provisionalPassword() : null));
  const [askCurrent, setAskCurrent] = useState(!remembered);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: remembered ?? "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: "newPassword" });

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword: next }) =>
    change.mutate(
      { currentPassword, newPassword: next },
      {
        onSuccess: () => {
          toast.success("Senha alterada.");
          form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
          setAskCurrent(true);
          onDone();
        },
        onError: (e) => {
          applyApiErrors(e, form.setError, ["currentPassword", "newPassword"]);
          // A provisória lembrada não serviu (ex.: o admin gerou outra): pede de novo.
          if (form.getFieldState("currentPassword").error) setAskCurrent(true);
        },
      },
    ),
  );

  const generalError =
    change.error && !(isApiError(change.error) && change.error.isValidation)
      ? errorMessage(change.error)
      : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {askCurrent && (
        <Field
          label={forced ? "Senha provisória" : "Senha atual"}
          error={errors.currentPassword?.message}
        >
          <PasswordInput
            autoComplete="current-password"
            autoFocus={forced}
            {...form.register("currentPassword")}
          />
        </Field>
      )}
      <Field label="Nova senha" error={errors.newPassword?.message}>
        <PasswordInput
          autoComplete="new-password"
          autoFocus={forced && !askCurrent}
          {...form.register("newPassword")}
        />
      </Field>
      <ul aria-label="Regras da senha" className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {RULES.map((r) => {
          const ok = r.test(newPassword);
          return (
            <li
              key={r.label}
              className={cn("flex items-center gap-1", ok ? "text-green-700" : "text-neutral-500")}
            >
              <Check className={cn("size-3.5", !ok && "opacity-30")} aria-hidden />
              {r.label}
              <span className="sr-only">{ok ? " (ok)" : " (falta)"}</span>
            </li>
          );
        })}
      </ul>
      <Field label="Repita a nova senha" error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>

      <FormError message={generalError} />

      <Button
        type="submit"
        size={forced ? "lg" : "md"}
        icon={KeyRound}
        loading={change.isPending}
        className={forced ? "mt-1" : "mt-1 self-start"}
      >
        {forced ? "Salvar e entrar" : "Salvar nova senha"}
      </Button>
      {children}
    </form>
  );
}
