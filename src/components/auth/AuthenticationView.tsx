import React from "react";
import { LoginForm } from "./LoginForm";
import { SignUpForm } from "./SignUpForm";

export const AuthenticationView: React.FC = () => {
  return (
    <>
      <div className="space-y-8">
        <LoginForm />
        <div className="h-px bg-border"></div>
        <SignUpForm />
      </div>
    </>
  );
};
