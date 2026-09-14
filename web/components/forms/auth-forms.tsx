"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  activateAction,
  confirmPasswordResetAction,
  loginAction,
  requestPasswordResetAction,
  signupAction,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await loginAction(formData);
        if (result?.error) {
          setError(result.error);
          setPending(false);
        }
      }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <FieldError message={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted">
        <Link href="/reset" className="text-teal hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (done) {
    return (
      <p className="text-sm text-ink">
        Check your email for an activation link. In local development the link
        is printed in the server console.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        const result = await signupAction(formData);
        setPending(false);
        if (result.error) setError(result.error);
        else setDone(true);
      }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <FieldError message={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

export function ActivateForm({
  token,
  defaultName,
  defaultPhone,
}: {
  token: string;
  defaultName: string;
  defaultPhone: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        const result = await activateAction(token, formData);
        if (result?.error) {
          setError(result.error);
          setPending(false);
        }
      }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultName} required />
      </div>
      <div>
        <Label htmlFor="phoneNumber">Phone</Label>
        <Input id="phoneNumber" name="phoneNumber" defaultValue={defaultPhone} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="tos" value="yes" />
        I agree to the terms and conditions
      </label>
      <FieldError message={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Activating…" : "Activate account"}
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p className="text-sm text-ink">
        If that email exists, we sent a reset link. In local development it is
        printed in the server console.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await requestPasswordResetAction(formData);
        if (result.error) setError(result.error);
        else setDone(true);
      }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <FieldError message={error} />
      <Button type="submit" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetConfirmForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        const result = await confirmPasswordResetAction(token, formData);
        if (result?.error) {
          setError(result.error);
          setPending(false);
        }
      }}
    >
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <FieldError message={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

export function NewCompanyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setPending(true);
        const { createCompanyAction } = await import("@/lib/actions/company");
        const result = await createCompanyAction(formData);
        if (result.error) {
          setError(result.error);
          setPending(false);
          return;
        }
        router.push(`/app/companies/${result.companyId}/employees`);
      }}
    >
      <div>
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="team">First team</Label>
        <Input id="team" name="team" defaultValue="Team" />
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" name="timezone" defaultValue="UTC" />
      </div>
      <FieldError message={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create company"}
      </Button>
    </form>
  );
}
