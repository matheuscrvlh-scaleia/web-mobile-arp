import { type MerchantSignupBody, merchantSignupBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import type { z } from "zod";
import { AccessScreen } from "@/features/auth/components/AccessScreen";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { Button, Field, FormError, Input, PasswordInput, Spinner } from "@/shared/ui";
import { useInvitation, useMerchantSignup } from "../api";

const FIELDS = ["name", "email", "phone", "password"];

/** Página pública do link que a ARP manda: o lojista se cadastra e espera a aprovação. */
export function MerchantSignupPage() {
  const { token = "" } = useParams();
  const invitation = useInvitation(token);
  const signup = useMerchantSignup(token);
  const form = useForm<z.input<typeof merchantSignupBodySchema>, unknown, MerchantSignupBody>({
    resolver: zodResolver(merchantSignupBodySchema),
    defaultValues: { name: "", email: "", phone: null, password: "" },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((body) =>
    signup.mutate(body, { onError: (e) => applyApiErrors(e, form.setError, FIELDS) }),
  );

  if (invitation.isLoading) {
    return (
      <AccessScreen documentTitle="Cadastro de lojista" title="Cadastro de lojista" subtitle="">
        <Spinner />
      </AccessScreen>
    );
  }
  if (invitation.error || !invitation.data) {
    return (
      <AccessScreen
        documentTitle="Cadastro de lojista"
        title="Link inválido"
        subtitle={errorMessage(invitation.error)}
      >
        <span />
      </AccessScreen>
    );
  }
  if (signup.isSuccess) {
    return (
      <AccessScreen
        documentTitle="Cadastro enviado"
        title="Cadastro enviado"
        subtitle="A ARP vai conferir e aprovar o seu acesso. Você recebe um aviso por e-mail e, depois disso, entra na Área do lojista do app ARP com este e-mail e senha."
      >
        <CircleCheck className="size-10 text-emerald-600" aria-hidden />
      </AccessScreen>
    );
  }

  return (
    <AccessScreen
      documentTitle="Cadastro de lojista"
      title={`Lojista da ${invitation.data.store.name}`}
      subtitle="Crie o seu acesso. Ele começa a valer depois que a ARP aprovar."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Seu nome" error={errors.name?.message}>
          <Input autoComplete="name" className="h-11" autoFocus {...form.register("name")} />
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" className="h-11" {...form.register("email")} />
        </Field>
        <Field
          label="WhatsApp"
          optional
          hint="Para o aviso de aprovação"
          error={errors.phone?.message}
        >
          <Input
            type="tel"
            autoComplete="tel"
            className="h-11"
            {...form.register("phone", { setValueAs: (v: string) => v.trim() || null })}
          />
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        <FormError message={signup.error && !errors.email ? errorMessage(signup.error) : null} />
        <Button type="submit" size="lg" icon={UserPlus} loading={signup.isPending}>
          Enviar cadastro
        </Button>
      </form>
    </AccessScreen>
  );
}
