import { changePasswordBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, KeyRound, LogOut } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { applyApiErrors, errorMessage, isApiError } from "@/shared/api";
import { useAuth, useCurrentUser } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { safeNextPath } from "@/shared/lib/text";
import { Button, Field, FormError, PasswordInput, toast } from "@/shared/ui";
import { useChangePassword } from "../api";
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

export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const change = useChangePassword();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  const forced = user.mustChangePassword;

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword: next }) =>
    change.mutate(
      { currentPassword, newPassword: next },
      {
        onSuccess: () => {
          toast.success("Senha alterada.");
          navigate(safeNextPath(params.get("next")) ?? PATHS.home, { replace: true });
        },
        onError: (e) => applyApiErrors(e, form.setError, ["currentPassword", "newPassword"]),
      },
    ),
  );

  const generalError =
    change.error && !(isApiError(change.error) && change.error.isValidation)
      ? errorMessage(change.error)
      : null;

  return (
    <AccessScreen
      documentTitle="Trocar senha"
      title={forced ? "Crie sua senha" : "Trocar senha"}
      subtitle={
        forced
          ? `Olá, ${user.name.split(" ")[0]}! Você entrou com uma senha provisória. Defina uma senha só sua para continuar.`
          : "Informe a senha atual e escolha uma nova."
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field
          label={forced ? "Senha provisória" : "Senha atual"}
          error={errors.currentPassword?.message}
        >
          <PasswordInput
            autoComplete="current-password"
            autoFocus
            {...form.register("currentPassword")}
          />
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        <ul aria-label="Regras da senha" className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {RULES.map((r) => {
            const ok = r.test(newPassword);
            return (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-1",
                  ok ? "text-green-700" : "text-neutral-500",
                )}
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

        <Button type="submit" size="lg" icon={KeyRound} loading={change.isPending} className="mt-1">
          {forced ? "Salvar e entrar" : "Salvar nova senha"}
        </Button>
        {forced ? (
          <Button variant="ghost" icon={LogOut} onClick={() => void signOut()}>
            Sair
          </Button>
        ) : (
          <Link
            to={PATHS.home}
            className="inline-flex items-center justify-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao painel
          </Link>
        )}
      </form>
    </AccessScreen>
  );
}
