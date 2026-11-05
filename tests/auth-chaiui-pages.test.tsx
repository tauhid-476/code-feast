import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

import { SignInPage } from "@/components/sign-in-page";
import { SignUpPage } from "@/components/sign-up-page";
import { ForgotPasswordPage } from "@/components/forgot-password-page";
import { ResetPasswordPage } from "@/components/reset-password-page";
import { Footer } from "@/components/footer";
import { FOOTER_SECTIONS } from "@/components/page-shell";

describe("ChaiUI Auth Pages rendering", () => {
  it("renders SignInPage with expected fields and forgot-password link", () => {
    const html = renderToStaticMarkup(<SignInPage providers={[]} />);

    expect(html).toContain("Welcome back");
    expect(html).toContain("Sign in to pick up where you left off.");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("Forgot password?");
    expect(html).toContain('href="/sign-up"');
    expect(html).toContain("Create an account");
    expect(html).toContain("CodeFeast. All rights reserved.");
  });

  it("renders SignUpPage with expected fields and sign-in link", () => {
    const html = renderToStaticMarkup(<SignUpPage providers={[]} />);

    expect(html).toContain("Create your account");
    expect(html).toContain("Name");
    expect(html).toContain("Email");
    expect(html).toContain("Password");
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Sign in");
    expect(html).toContain("CodeFeast. All rights reserved.");
  });

  it("renders ForgotPasswordPage with email input and submit button", () => {
    const html = renderToStaticMarkup(<ForgotPasswordPage />);

    expect(html).toContain("Reset your password");
    expect(html).toContain("Enter your email and we will send you a link to set a new one.");
    expect(html).toContain('type="email"');
    expect(html).toContain("Send reset link");
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Back to sign in");
    expect(html).toContain("CodeFeast. All rights reserved.");
  });

  it("renders ResetPasswordPage with expired/invalid link state when token is missing", () => {
    const html = renderToStaticMarkup(<ResetPasswordPage />);

    expect(html).toContain("Invalid or expired link");
    expect(html).toContain("This password reset link is invalid or has expired.");
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("Request new reset link");
    expect(html).toContain("CodeFeast. All rights reserved.");
  });

  it("renders ResetPasswordPage with expired/invalid link state when error is passed", () => {
    const html = renderToStaticMarkup(<ResetPasswordPage token="abc" error="INVALID_TOKEN" />);

    expect(html).toContain("Invalid or expired link");
    expect(html).toContain('href="/forgot-password"');
  });

  it("renders ResetPasswordPage with password input fields when valid token is provided", () => {
    const html = renderToStaticMarkup(<ResetPasswordPage token="valid-token-123" />);

    expect(html).toContain("Set new password");
    expect(html).toContain("New password");
    expect(html).toContain("Confirm new password");
    expect(html).toContain("Reset password");
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("CodeFeast. All rights reserved.");
  });

  it("renders Footer with CodeFeast copyright and updated social links", () => {
    const html = renderToStaticMarkup(<Footer logo={<span>Logo</span>} sections={FOOTER_SECTIONS} />);

    expect(html).toContain("CodeFeast");
    expect(html).toContain("All rights reserved.");
    expect(html).not.toContain("ChaiCode. All rights reserved.");

    // Check social links
    expect(html).toContain('href="https://x.com/tauhid_khan476"');
    expect(html).toContain('href="https://github.com/tauhid-476/code-feast"');
    expect(html).toContain('href="https://www.linkedin.com/in/khan-tauhid-6a4664285"');
    expect(html).toContain('href="https://discord.com/khantauheed_768"');
    expect(html).not.toContain("https://www.youtube.com/@chaiaurcode");
  });
});
