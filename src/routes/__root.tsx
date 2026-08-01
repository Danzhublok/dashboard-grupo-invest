import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "../lib/store";
import { AuthProvider, useAuth } from "../lib/auth";
import logo from "@/assets/grupo-invest-logo.jpg?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Grupo Invest | Painel de Resultados" },
      {
        name: "description",
        content: "Painel de resultados da consultoria de crédito imobiliário Grupo Invest.",
      },
      { name: "author", content: "Grupo Invest" },
      { property: "og:title", content: "Grupo Invest | Painel de Resultados" },
      {
        property: "og:description",
        content: "Grupo Invest. Dashboard",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@DanielSouza" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedApp() {
  const { session, ready, login } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (
      session?.role === "representante" &&
      pathname !== "/" &&
      pathname !== "/metas" &&
      pathname !== "/equipes" &&
      pathname !== "/configuracoes"
    ) {
      void router.navigate({ to: "/" });
    }
  }, [pathname, router, session?.role]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!ready) return null;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border/60 bg-surface p-8 shadow-lg">
          <div className="mb-8 text-center">
            <img
              src={logo}
              alt="Grupo Invest"
              width={96}
              height={96}
              className="mx-auto mb-4 h-24 w-24 rounded-3xl bg-background object-contain p-3 shadow-sm"
            />
            <h1 className="text-3xl font-bold">Grupo Invest</h1>
            <p className="mt-2 text-sm text-muted-foreground">Entre para acessar seu painel.</p>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const message = await login(email, password);
              setError(message ?? "");
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-medium text-foreground">
              E-mail ou usuário
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoComplete="current-password"
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Entrar
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Insira seu: <strong>Login</strong> / <strong>E senha</strong>
          </p>
        </div>
      </div>
    );
  }

  if (
    session.role === "representante" &&
    pathname !== "/" &&
    pathname !== "/metas" &&
    pathname !== "/equipes" &&
    pathname !== "/configuracoes"
  ) {
    return null;
  }

  return (
    <StoreProvider
      representationId={session.role === "representante" ? session.representationId : undefined}
      representationName={session.role === "representante" ? session.representationName : undefined}
    >
      <Outlet />
    </StoreProvider>
  );
}
