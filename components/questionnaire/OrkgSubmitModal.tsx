"use client";

import type { EnrichedTemplateMapping } from "@/types/template";
import type { FormValue } from "./QuestionnaireForm";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import { buildAnswerTriples } from "@/lib/orkg-instance-builder";
import { getSandboxResourceLink } from "@/lib/orkg-links";

interface OrkgSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  targetClassId?: string;
  templateLabel: string;
  mapping: EnrichedTemplateMapping;
  values: Record<string, FormValue>;
}

type SubmitState =
  | { status: "idle" }
  | { status: "loading"; step: string }
  | { status: "success"; resourceId: string; sandboxUrl: string; statementsCreated: number; errors: string[] }
  | { status: "error"; message: string };

export function OrkgSubmitModal({
  isOpen,
  onClose,
  templateId,
  targetClassId,
  templateLabel,
  mapping,
  values,
}: OrkgSubmitModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [resourceLabel, setResourceLabel] = useState(
    `${templateLabel} — ${today}`,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [savedToken, setSavedToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedEmail = localStorage.getItem("orkg_sandbox_email");
      const storedToken = localStorage.getItem("orkg_sandbox_token");
      if (storedEmail) setEmail(storedEmail);
      if (storedToken) setSavedToken(storedToken);
    } catch {}
  }, []);

  const handleReset = useCallback(() => {
    setSubmitState({ status: "idle" });
    setEmail("");
    setPassword("");
    setResourceLabel(`${templateLabel} — ${today}`);
  }, [templateLabel, today]);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleSubmit = useCallback(async () => {
    if ((!savedToken && (!email.trim() || !password.trim())) || !resourceLabel.trim()) return;

    setSubmitState({ status: "loading", step: savedToken ? "Connecting…" : "Authenticating…" });

    // Step 1: Authenticate
    let token = savedToken;

    if (!token) {
      try {
        const authRes = await fetch("/api/orkg-sandbox/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const authText = await authRes.text();
      let authData;
      try {
        authData = authText ? JSON.parse(authText) : {};
      } catch {
        throw new Error(`API returned invalid JSON: ${authText.slice(0, 100)}`);
      }

      if (!authRes.ok || !authData.access_token) {
        setSubmitState({
          status: "error",
          message:
            authData.detail ||
            authData.error ||
            `Authentication failed (${authRes.status})`,
        });

        return;
      }

      token = authData.access_token;
      setSavedToken(token);
      try {
        localStorage.setItem("orkg_sandbox_token", token as string);
        localStorage.setItem("orkg_sandbox_email", email.trim());
      } catch {}
    } catch (err) {
      setSubmitState({
        status: "error",
        message: `Network error: ${String(err)}`,
      });

      return;
    }
    } // Closes `if (!token)`

    setSubmitState({ status: "loading", step: "Submitting instance to ORKG Sandbox…" });

    // Step 2: Build triples and submit
    try {
      const answers = buildAnswerTriples(mapping, values);
      const submitRes = await fetch("/api/orkg-sandbox/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token as string,
          templateId,
          targetClassId,
          resourceLabel: resourceLabel.trim(),
          answers,
        }),
      });
      const submitText = await submitRes.text();
      let submitData;
      try {
        submitData = submitText ? JSON.parse(submitText) : {};
      } catch {
        throw new Error(`Submit API returned invalid JSON: ${submitText.slice(0, 100)}`);
      }

      if (!submitRes.ok || !submitData.resourceId) {
        if (submitRes.status === 401) {
          setSavedToken(null);
          try { localStorage.removeItem("orkg_sandbox_token"); } catch {}
          setSubmitState({
            status: "error",
            message: "Session expired or invalid token. Please log in again.",
          });
          return;
        }

        setSubmitState({
          status: "error",
          message:
            submitData.detail ||
            submitData.error ||
            `Submission failed (${submitRes.status})`,
        });

        return;
      }

      setSubmitState({
        status: "success",
        resourceId: submitData.resourceId,
        sandboxUrl: getSandboxResourceLink(submitData.resourceId),
        statementsCreated: submitData.statementsCreated ?? 0,
        errors: submitData.errors ?? [],
      });
    } catch (err) {
      setSubmitState({
        status: "error",
        message: `Submission network error: ${String(err)}`,
      });
    }
  }, [email, password, resourceLabel, templateId, targetClassId, mapping, values, savedToken]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orkg-submit-modal-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Blurred overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-default-200 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default-200 px-6 py-4">
          <div>
            <h2
              id="orkg-submit-modal-title"
              className="text-lg font-bold text-foreground"
            >
              Submit to ORKG Sandbox
            </h2>
            <p className="mt-0.5 text-xs text-default-500">
              Creates a new instance on{" "}
              <a
                className="text-primary underline"
                href="https://sandbox.orkg.org"
                rel="noopener noreferrer"
                target="_blank"
              >
                sandbox.orkg.org
              </a>
            </p>
          </div>
          <button
            aria-label="Close"
            className="rounded-full p-1.5 text-default-400 transition-colors hover:bg-default-100 hover:text-foreground"
            onClick={handleClose}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* ── Success ── */}
          {submitState.status === "success" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 p-4">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-success-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="font-semibold text-success-800">Instance created!</p>
                  <p className="mt-0.5 text-sm text-success-700">
                    Resource{" "}
                    <code className="rounded bg-success-100 px-1 text-xs">
                      {submitState.resourceId}
                    </code>{" "}
                    with{" "}
                    <strong>{submitState.statementsCreated}</strong> statement
                    {submitState.statementsCreated !== 1 ? "s" : ""}.
                  </p>
                </div>
              </div>

              <a
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                href={submitState.sandboxUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open in ORKG Sandbox
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>

              {submitState.errors.length > 0 && (
                <details className="rounded-lg border border-warning-200 bg-warning-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-warning-700">
                    {submitState.errors.length} statement
                    {submitState.errors.length !== 1 ? "s" : ""} could not be created
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {submitState.errors.map((e, i) => (
                      <li key={i} className="text-xs text-warning-800">
                        {e}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <Button
                className="w-full"
                size="sm"
                variant="flat"
                onPress={handleReset}
              >
                Submit another instance
              </Button>
            </div>
          )}

          {/* ── Error ── */}
          {submitState.status === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-danger-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm text-danger-800">{submitState.message}</p>
              </div>
              <Button
                className="w-full"
                color="primary"
                size="sm"
                variant="flat"
                onPress={() => setSubmitState({ status: "idle" })}
              >
                Try again
              </Button>
            </div>
          )}

          {/* ── Loading ── */}
          {submitState.status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-default-200 border-t-primary" />
              <p className="text-sm font-medium text-default-600">
                {submitState.step}
              </p>
            </div>
          )}

          {/* ── Idle form ── */}
          {submitState.status === "idle" && (
            <div className="space-y-4">
              {/* Resource label */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-foreground"
                  htmlFor="orkg-resource-label"
                >
                  Instance label
                </label>
                <Input
                  id="orkg-resource-label"
                  placeholder="e.g. My Survey Results — 2026-04-08"
                  size="sm"
                  value={resourceLabel}
                  variant="bordered"
                  onValueChange={setResourceLabel}
                />
                <p className="mt-1 text-xs text-default-400">
                  This will be the label of the new ORKG resource created on the sandbox.
                </p>
              </div>

              {/* Divider */}
              <div className="relative flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-default-200" />
                <span className="text-xs text-default-400">Sandbox credentials</span>
                <div className="h-px flex-1 bg-default-200" />
              </div>

              {savedToken ? (
                <div className="rounded-lg bg-default-100 p-3 text-sm text-default-700">
                  <p>
                    Logged in as <strong>{email}</strong>
                  </p>
                  <button
                    className="mt-1 text-xs text-primary underline"
                    onClick={() => {
                      setSavedToken(null);
                      try {
                        localStorage.removeItem("orkg_sandbox_token");
                      } catch {}
                    }}
                    type="button"
                  >
                    Change user / Log out
                  </button>
                </div>
              ) : (
                <>
                  {/* Email */}
                  <Input
                    id="orkg-sandbox-email"
                    autoComplete="email"
                    label="Email"
                    placeholder="your@email.com"
                    size="sm"
                    type="email"
                    value={email}
                    variant="bordered"
                    onValueChange={setEmail}
                  />

                  {/* Password */}
                  <Input
                    id="orkg-sandbox-password"
                    autoComplete="current-password"
                    label="Password"
                    placeholder="••••••••"
                    size="sm"
                    type="password"
                    value={password}
                    variant="bordered"
                    onValueChange={setPassword}
                  />

                  <p className="text-xs text-default-400">
                    Your token and email will be saved securely in your browser so you don&apos;t have to log in every time.
                    Don&apos;t have an account?{" "}
                    <a
                      className="text-primary underline"
                      href="https://sandbox.orkg.org/sign-up"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Sign up on the sandbox
                    </a>
                    .
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer — only shown in idle */}
        {submitState.status === "idle" && (
          <div className="flex justify-end gap-2 border-t border-default-200 px-6 py-4">
            <Button size="sm" variant="flat" onPress={handleClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={(!savedToken && (!email.trim() || !password.trim())) || !resourceLabel.trim()}
              size="sm"
              onPress={handleSubmit}
            >
              Submit to Sandbox
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
