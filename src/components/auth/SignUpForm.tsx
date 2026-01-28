import React, { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signupCommandSchema, PASSWORD_MIN_LENGTH } from "@/lib/authUtils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { InlineErrorMessage } from "../ui/InlineErrorMessage";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { showToast } from "../ui/GlobalToastZone";
import type z from "zod";
import type { ApiErrorResponse, SignupApiErrorCode } from "@/types";

export type SignupCommandInput = z.infer<typeof signupCommandSchema>;

export const SignUpForm: React.FC = () => {
  const formId = useId();
  const emailId = `${formId}-signup-email`;
  const passwordId = `${formId}-signup-password`;
  const repeatPasswordId = `${formId}-signup-repeat-password`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignupCommandInput>({
    resolver: zodResolver(signupCommandSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      repeatPassword: "",
    },
  });

  const onSubmit = async (data: SignupCommandInput) => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorCode: SignupApiErrorCode | undefined;

        try {
          const body = (await response.json()) as ApiErrorResponse<SignupApiErrorCode>;
          errorCode = body?.error?.code;
        } catch {
          // Ignore JSON parsing errors and fall back to generic message.
        }

        if (response.status === 409 && errorCode === "EMAIL_ALREADY_REGISTERED") {
          showToast({ type: "error", message: "This email is already registered. Try logging in instead." });
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
          <h2 className="text-xl font-semibold tracking-tight">Create an account</h2>
          <p className="text-sm text-muted-foreground">Sign up to save your flashcards and track your learning.</p>
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
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? "true" : "false"}
            disabled={isSubmitting}
            {...register("password")}
          />
          <p className="text-xs text-muted-foreground">
            Password must be at least {PASSWORD_MIN_LENGTH} characters long and include at least one number and one
            special character.
          </p>
          {errors.password?.message && <InlineErrorMessage message={errors.password.message} />}
        </div>

        <div className="space-y-2">
          <Label htmlFor={repeatPasswordId}>Repeat password</Label>
          <Input
            id={repeatPasswordId}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.repeatPassword ? "true" : "false"}
            disabled={isSubmitting}
            {...register("repeatPassword")}
          />
          {errors.repeatPassword?.message && <InlineErrorMessage message={errors.repeatPassword.message} />}
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting || !isValid}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </div>
      </form>
    </div>
  );
};
