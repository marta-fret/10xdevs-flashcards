import React from "react";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { showToast } from "../ui/GlobalToastZone";
import { LoginForm } from "./LoginForm";

vi.mock("../ui/GlobalToastZone", () => ({
  showToast: vi.fn(),
}));

const getMockedShowToast = () => vi.mocked(showToast);

describe("LoginForm", () => {
  const originalLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign: vi.fn() },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    return { user, emailInput, passwordInput, submitButton };
  };

  it("renders the login form", () => {
    render(<LoginForm />);

    expect(screen.getByRole("heading", { name: /log in/i })).toBeVisible();
    expect(screen.getByLabelText(/email/i)).toBeVisible();
    expect(screen.getByLabelText(/password/i)).toBeVisible();
    const submitButton = screen.getByRole("button", { name: /log in/i });
    expect(submitButton).toBeVisible();
    expect(submitButton).toBeDisabled();
  });

  it("shows validation errors for empty fields on submit", async () => {
    const { user, emailInput, passwordInput } = setup();

    // Trigger validation by changing values to non-empty and back to empty
    await user.type(emailInput, "a");
    await user.clear(emailInput);
    await user.type(passwordInput, "a");
    await user.clear(passwordInput);

    expect(await screen.findAllByText("This field is required")).toHaveLength(2);
  });

  it("shows validation error for invalid email address", async () => {
    const { user, emailInput, passwordInput } = setup();

    await user.type(emailInput, "not-an-email");
    await user.type(passwordInput, "password123");

    expect(await screen.findByText("Enter a valid email address")).toBeVisible();
  });

  it("disables the submit button until the form is valid", async () => {
    const { user, emailInput, passwordInput, submitButton } = setup();

    // Initially disabled because form is invalid (empty fields)
    expect(submitButton).toBeDisabled();

    // With invalid email but non-empty password, it stays disabled
    await user.type(emailInput, "not-an-email");
    await user.type(passwordInput, "password123");
    expect(submitButton).toBeDisabled();

    // Once email is corrected to a valid one, it becomes enabled
    await user.clear(emailInput);
    await user.type(emailInput, "user@example.com");

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it("calls the login API and redirects to /generate on success", async () => {
    const { user, emailInput, passwordInput, submitButton } = setup();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          user_id: "user-123",
          email: "user@example.com",
        },
      }),
    } as unknown as Response);

    const assignMock = vi.mocked(window.location.assign);

    await user.type(emailInput, "user@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/generate");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("shows an error toast for INVALID_CREDENTIALS from the API", async () => {
    const { user, emailInput, passwordInput, submitButton } = setup();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect credentials",
        },
      }),
    } as unknown as Response);

    const showToastMock = getMockedShowToast();

    await user.type(emailInput, "user@example.com");
    await user.type(passwordInput, "wrong-password");
    await user.click(submitButton);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({ type: "error", message: "Incorrect credentials" });
    });
  });

  it("shows a generic error toast when the API returns a server error", async () => {
    const { user, emailInput, passwordInput, submitButton } = setup();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong",
        },
      }),
    } as unknown as Response);

    const showToastMock = getMockedShowToast();

    await user.type(emailInput, "user@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        type: "error",
        message: "Something went wrong on our side. Please try again.",
      });
    });
  });

  it("shows a generic error toast when the request itself fails", async () => {
    const { user, emailInput, passwordInput, submitButton } = setup();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error("Network error"));

    const showToastMock = getMockedShowToast();

    await user.type(emailInput, "user@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        type: "error",
        message: "Something went wrong on our side. Please try again.",
      });
    });
  });

  it("disables the form and shows a loading state while submitting", async () => {
    const { user, emailInput, passwordInput, submitButton } = setup();

    let resolveFetch: ((value: Response) => void) | undefined;

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    await user.type(emailInput, "user@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

    resolveFetch?.({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          user_id: "user-123",
          email: "user@example.com",
        },
      }),
    } as unknown as Response);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /log in/i })).toBeEnabled();
    });
  });
});
