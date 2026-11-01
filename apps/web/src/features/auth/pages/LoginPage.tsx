import { type LoginBody, loginBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import type { z } from "zod";
import { applyApiErrors, errorMessage, isApiError } from "@/shared/api";
import { Button, Field, FormError, Input, PasswordInput } from "@/shared/ui";
import { useLogin } from "../api";
import { AccessScreen } from "../components/AccessScreen";

const FIELDS = ["email", "password"] as const;

export function LoginPage() {
  const [params] = useSearchParams();
  const login = useLogin();
  const expired = params.get("motivo") === "expirou";
  const form = useForm<z.input<typeof loginBodySchema>, unknown, LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  // Deu certo: a rota de visitante (GuestOnly) leva ao ?next= ou ao início, e a
  // guarda das rotas logadas manda trocar a senha provisória antes de tudo.
  const onSubmit = form.handleSubmit((body) =>
    login.mutate(body, { onError: (e) => applyApiErrors(e, form.setError, FIELDS) }),
  );

  const generalError =
    login.error && !(isApiError(login.error) && login.error.isValidation)
      ? errorMessage(login.error)
      : null;

  return (
    <AccessScreen
      documentTitle="Entrar"
      title="Bem-vindo de volta"
      subtitle="Entre com seu e-mail e senha para gerenciar o app da ARP."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="E-mail" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="nome@arp.com.br"
            className="h-11"
            autoFocus
            {...form.register("email")}
          />
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </Field>

        {expired && !login.error && (
          <output className="block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Sua sessão expirou. Entre de novo para continuar de onde parou.
          </output>
        )}
        <FormError message={generalError} />

        <Button type="submit" size="lg" icon={LogIn} loading={login.isPending} className="mt-1">
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AccessScreen>
  );
}
