import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth =
    pathname.startsWith("/app") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/new-company");

  if (needsAuth && !req.auth?.user?.id) {
    const login = new URL("/", req.nextUrl);
    login.searchParams.set("callbackUrl", pathname);
    return Response.redirect(login);
  }

  if (
    req.auth?.user?.mustChangePassword &&
    pathname !== "/account/password"
  ) {
    return Response.redirect(new URL("/account/password", req.nextUrl));
  }
});

export const config = {
  matcher: ["/app/:path*", "/account/:path*", "/new-company"],
};
