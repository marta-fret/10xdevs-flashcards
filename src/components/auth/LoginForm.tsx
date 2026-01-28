import React, { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { loginCommandSchema } from "@/lib/authUtils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { InlineErrorMessage } from "../ui/InlineErrorMessage";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { showToast } from "../ui/GlobalToastZone";
import type z from "zod";
import type { ApiErrorResponse, LoginApiErrorCode } from "@/types";

export type LoginCommandInput = z.infer<typeof loginCommandSchema>;

export const LoginForm: React.FC = () => {
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginCommandInput>({
    resolver: zodResolver(loginCommandSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginCommandInput) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorCode: LoginApiErrorCode | undefined;

        try {
          const body = (await response.json()) as ApiErrorResponse<LoginApiErrorCode>;
          errorCode = body?.error?.code;
        } catch {
          // Ignore JSON parsing errors and fall back to generic message.
        }

        if (response.status === 401 && errorCode === "INVALID_CREDENTIALS") {
          showToast({ type: "error", message: "Incorrect credentials" });
          return;
        }

        showToast({ type: "error", message: "Something went wrong on our side. Please try again." });
        return;
      }

      window.location.assign("/generate");
    } catch {
      showToast({ type: "error", message: "Something went wrong on our side. Please try again." });
    }
  };

  return (
    <div className="relative">
      {isSubmitting && <LoadingOverlay />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Log in</h2>
          <p className="text-sm text-muted-foreground">Use your email and password to access your flashcards.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? "true" : "false"}
            disabled={isSubmitting}
            {...register("email")}
          />
          {errors.email?.message && <InlineErrorMessage message={errors.email.message} />}
        </div>

        <div className="space-y-2">
          <Label htmlFor={passwordId}>Password</Label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? "true" : "false"}
            disabled={isSubmitting}
            {...register("password")}
          />
          {errors.password?.message && <InlineErrorMessage message={errors.password.message} />}
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting || !isValid}>
            {isSubmitting ? "Logging in..." : "Log in"}
          </Button>
        </div>
      </form>
    </div>
  );
};
