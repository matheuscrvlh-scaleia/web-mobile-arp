import type { CouponClaim } from "@arp/contracts";
import { CheckCheck, ClipboardCheck, Keyboard, RotateCcw, Wallet } from "lucide-react";
import { type FormEvent, type RefObject, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import {
  Button,
  ButtonLink,
  Can,
  Card,
  EmptyState,
  LoadingRegion,
  PageHeader,
  Skeleton,
} from "@/shared/ui";
import { useClaimLookup, useRedeemClaim } from "../api";
import { ClaimTicket } from "../components/ClaimTicket";
import { CodeInput } from "../components/CodeInput";
import { RecentRedemptions, useRedeemedLog } from "../components/RecentRedemptions";
import {
  problemFromError,
  problemFromStatus,
  type RedeemProblem,
  RedeemProblemBanner,
  RedeemSuccess,
} from "../components/RedeemFeedback";
import { CODE_BODY_LENGTH, fullCode, isCompleteCode, normalizeCodeBody } from "../lib/code";
import { invalidToday } from "../lib/weekdays";

/** Resultado da última validação (fica na tela até o próximo código). */
type Outcome =
  | { kind: "success"; claim: CouponClaim }
  | { kind: "problem"; problem: RedeemProblem; error: unknown; claim?: CouponClaim };

/**
 * Tela de balcão: digita (ou cola) o código, confere o cupom e valida.
 * Depois de validar, o campo limpa e volta o foco para o próximo cliente.
 */
export function RedeemPage() {
  const { user } = useAuth();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const validateRef = useRef<HTMLButtonElement>(null);
  // ?codigo=ARP-XXXXXX (vindo de "Validar" em Cupons pegos): já consulta.
  const [params] = useSearchParams();
  const [initial] = useState(() => normalizeCodeBody(params.get("codigo") ?? ""));
  const [body, setBody] = useState(initial);
  const [submitted, setSubmitted] = useState<string | null>(() =>
    isCompleteCode(initial) ? fullCode(initial) : null,
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [log, addToLog] = useRedeemedLog();
  const lookup = useClaimLookup(submitted);
  const redeem = useRedeemClaim();
  const claim = submitted && lookup.data?.code === submitted ? lookup.data : undefined;
  const blocked = claim
    ? (problemFromStatus(claim.status) ?? (invalidToday(claim) ? "CLAIM_WRONG_DAY" : null))
    : null;

  // Cupom bom na tela: o foco vai para "Validar" (Enter valida).
  const readyId = claim && !blocked && !outcome ? claim.id : null;
  useEffect(() => {
    if (readyId) validateRef.current?.focus();
  }, [readyId]);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const nextCustomer = () => {
    setBody("");
    setSubmitted(null);
    setOutcome(null);
    setIncomplete(false);
    redeem.reset();
    focusInput();
  };

  const changeBody = (next: string) => {
    setBody(next);
    setIncomplete(false);
    if (next !== body) {
      setOutcome(null);
      redeem.reset();
      setSubmitted(null);
    }
    // Código completo: consulta sem precisar de Enter.
    if (isCompleteCode(next)) setSubmitted(fullCode(next));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isCompleteCode(body)) {
      setIncomplete(true);
      return;
    }
    const code = fullCode(body);
    setOutcome(null);
    if (submitted === code) void lookup.refetch();
    else setSubmitted(code);
  };

  const validate = () => {
    if (!claim) return;
    redeem.mutate(claim.code, {
      onSuccess: (redeemed) => {
        setOutcome({ kind: "success", claim: redeemed });
        addToLog(redeemed);
        setBody("");
        setSubmitted(null);
        focusInput();
      },
      onError: (error) =>
        setOutcome({ kind: "problem", problem: problemFromError(error), error, claim }),
    });
  };

  return (
    <>
      <PageHeader
        title="Validar cupom"
        description={
          user?.store
            ? `Leia o QR ou digite o código que o visitante mostrar no caixa da ${user.store.name}.`
            : "Leia o QR ou digite o código que o visitante mostrar no caixa."
        }
        actions={
          <Can permission="coupons.view">
            <ButtonLink to={PATHS.claims} icon={Wallet} variant="secondary">
              Cupons pegos
            </ButtonLink>
          </Can>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card data-guia="codigo" padding="lg">
            <form onSubmit={submit} noValidate>
              <label htmlFor={inputId} className="mb-3 block text-sm font-medium text-neutral-700">
                Código do cupom
              </label>
              <CodeInput
                id={inputId}
                value={body}
                onChange={changeBody}
                inputRef={inputRef}
                loading={lookup.isFetching}
                describedBy={hintId}
                invalid={incomplete}
              />
              <p
                id={hintId}
                className={
                  incomplete
                    ? "mt-2 text-sm font-medium text-red-700"
                    : "mt-2 text-xs text-neutral-500"
                }
              >
                {incomplete
                  ? `Faltam ${CODE_BODY_LENGTH - body.length} letras ou números.`
                  : "O “ARP-” já está escrito: digite as 6 letras e números ou cole o código."}
              </p>
            </form>
          </Card>

          <section
            data-guia="resultado"
            aria-live="polite"
            aria-label="Resultado"
            className="flex flex-col gap-4"
          >
            <RedeemResult
              outcome={outcome}
              submitted={submitted}
              loading={lookup.isLoading}
              lookupError={lookup.error}
              claim={claim}
              blocked={blocked}
              validating={redeem.isPending}
              validateRef={validateRef}
              onValidate={validate}
              onNext={nextCustomer}
            />
          </section>
        </div>
        <aside className="flex flex-col gap-4" aria-label="Apoio">
          <RecentRedemptions entries={log} />
          <Card variant="dashed" padding="sm" className="text-xs">
            <p className="flex items-center gap-2 font-medium text-neutral-700">
              <Keyboard className="size-4" aria-hidden />
              Atalhos
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>Com 6 letras e números, a consulta é automática.</li>
              <li>Enter no botão Validar confirma o uso.</li>
              <li>Depois de validar, o campo já espera o próximo código.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

function RedeemResult({
  outcome,
  submitted,
  loading,
  lookupError,
  claim,
  blocked,
  validating,
  validateRef,
  onValidate,
  onNext,
}: {
  outcome: Outcome | null;
  submitted: string | null;
  loading: boolean;
  lookupError: unknown;
  claim: CouponClaim | undefined;
  blocked: RedeemProblem | null;
  validating: boolean;
  validateRef: RefObject<HTMLButtonElement | null>;
  onValidate: () => void;
  onNext: () => void;
}) {
  const next = (
    <Button variant="secondary" icon={RotateCcw} onClick={onNext}>
      Outro código
    </Button>
  );

  if (outcome?.kind === "success") return <RedeemSuccess claim={outcome.claim} />;
  if (outcome?.kind === "problem") {
    return (
      <>
        <RedeemProblemBanner
          problem={outcome.problem}
          error={outcome.error}
          claim={outcome.claim}
          action={next}
        />
        {outcome.claim && <ClaimTicket claim={outcome.claim} dimmed />}
      </>
    );
  }
  if (!submitted) {
    return (
      <Card variant="dashed">
        <EmptyState
          compact
          icon={ClipboardCheck}
          title="Esperando um código"
          description="O visitante mostra o cupom no app (código ARP-XXXXXX e QR). Leia o QR ou digite o código, confira as condições e valide."
        />
      </Card>
    );
  }
  if (loading) {
    return (
      <LoadingRegion label="Consultando o código…">
        <Skeleton className="h-80 rounded-[2rem]" />
      </LoadingRegion>
    );
  }
  if (lookupError) {
    return (
      <RedeemProblemBanner
        problem={problemFromError(lookupError)}
        error={lookupError}
        action={next}
      />
    );
  }
  if (!claim) return null;
  if (blocked) {
    return (
      <>
        <RedeemProblemBanner problem={blocked} claim={claim} action={next} />
        <ClaimTicket claim={claim} dimmed />
      </>
    );
  }
  return (
    <>
      <ClaimTicket claim={claim} />
      {/* No celular, "Validar" fica preso no pé da tela, grande; "Outro código" é um link discreto. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="max-sm:sticky max-sm:bottom-3 max-sm:z-10 sm:flex sm:flex-1">
          <Button
            ref={validateRef}
            variant="brand"
            size="lg"
            icon={CheckCheck}
            loading={validating}
            onClick={onValidate}
            className="h-16 w-full text-base shadow-lg sm:shadow-none"
          >
            Validar {claim.code}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="lg"
          onClick={onNext}
          disabled={validating}
          className="self-center sm:h-16 sm:self-auto"
        >
          Outro código
        </Button>
      </div>
    </>
  );
}
