import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;

const requiredFieldMessage = "This field is required";
const invalidEmailMessage = "Enter a valid email address";
const passwordsDoNotMatchMessage = "Passwords do not match";
const passwordComplexityMessage =
  "Password must be at least 12 characters long and include at least one number and one special character";

export const loginCommandSchema = z.object({
  email: z.string().min(1, requiredFieldMessage).email(invalidEmailMessage),
  password: z.string().min(1, requiredFieldMessage),
});

export const signupCommandSchema = z
  .object({
    email: z
      .string({ required_error: "email is required", invalid_type_error: "email must be a string" })
      .email(invalidEmailMessage),
    password: z
      .string({
        required_error: "password is required",
        invalid_type_error: "password must be a string",
      })
      .min(PASSWORD_MIN_LENGTH, passwordComplexityMessage)
      .refine((value) => /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value), {
        message: passwordComplexityMessage,
        path: ["password"],
      }),
    repeatPassword: z.string({
      required_error: "repeatPassword is required",
      invalid_type_error: "repeatPassword must be a string",
    }),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: passwordsDoNotMatchMessage,
    path: ["repeatPassword"],
  });
