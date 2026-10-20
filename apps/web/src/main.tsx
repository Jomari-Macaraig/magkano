import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { DraftProvider } from "./DraftProvider";
import { HomePage } from "./HomePage";
import { Layout } from "./Layout";
import { ListPage } from "./ListPage";
import { RecipePage } from "./RecipePage";
import "./styles.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set (see .env.example)");
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/recipes/:id", element: <RecipePage /> },
      { path: "/list", element: <ListPage /> },
    ],
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");
createRoot(root).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <DraftProvider>
        <RouterProvider router={router} />
      </DraftProvider>
    </ClerkProvider>
  </StrictMode>,
);
