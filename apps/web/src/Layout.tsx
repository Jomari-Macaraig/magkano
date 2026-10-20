import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { Link, Outlet, useLocation } from "react-router";
import { ViewListButton } from "./DraftControls";

/** Every screen: the header, then the page. Accounts are optional; nothing is gated. */
export function Layout() {
  const onList = useLocation().pathname.startsWith("/list");
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
      {!onList && <ViewListButton />}
    </>
  );
}
