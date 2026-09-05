"use client"

import * as React from "react"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDocsStore } from "@/store/docs-store"
import { useI18n } from "@/lib/i18n"
import { DocsLogo } from "./home/home-header"

/**
 * Full-screen auth gate — the workspace is private: every document, sheet,
 * deck, form and API route requires a real account. First signup becomes the
 * workspace admin and claims all legacy content.
 */
export function LoginScreen() {
  const { t } = useI18n()
  const login = useDocsStore((s) => s.login)
  const signup = useDocsStore((s) => s.signup)
  const authError = useDocsStore((s) => s.authError)
  const authBusy = useDocsStore((s) => s.authBusy)

  const [mode, setMode] = React.useState<"login" | "signup">("login")
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [password, setPassword] = React.useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "login") await login(email, password)
    else await signup(email, name, password)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <DocsLogo />
          <h1 className="text-center text-[22px] font-normal text-foreground">
            {mode === "login" ? t("Sign in to Z-Docs") : t("Create your account")}
          </h1>
          <p className="flex items-center gap-1.5 text-center text-[13px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Your workspace is private and encrypted at rest")}
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(35,32,28,0.06),0_8px_28px_rgba(35,32,28,0.08)]">
          <div className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-1.5">
                <Label htmlFor="auth-name">{t("Name")}</Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="h-10"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="auth-email">{t("Email")}</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="auth-password">{t("Password")}</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
                className="h-10"
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">{t("At least 8 characters")}</p>
              )}
            </div>

            {authError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {authError}
              </p>
            )}

            <Button type="submit" disabled={authBusy} className="h-10 w-full rounded-full">
              {authBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : mode === "login" ? (
                t("Sign in")
              ) : (
                t("Create account")
              )}
            </Button>
          </div>

          <div className="mt-5 text-center text-[13px]">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="rounded px-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {mode === "login"
                ? t("No account? Create one")
                : t("Already have an account? Sign in")}
            </button>
          </div>
        </form>

        {mode === "signup" && (
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            {t("The first account becomes the workspace admin and owns all existing content.")}
          </p>
        )}
      </div>
    </div>
  )
}
