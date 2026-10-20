import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { Link, Outlet } from "react-router";

/** Every screen: the header, then the page. Accounts are optional; nothing is gated. */
export function Layout() {
  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          Magkano
        </Link>
        <div className="account">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className="button">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="button primary">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
