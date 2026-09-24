import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "yca_session";
const LOGIN_PATH = "/login";

/**
 * Middleware runs on the Edge runtime and cannot reach MongoDB, so this only
 * checks that a cookie exists. The admin layout confirms it resolves; a stale
 * cookie lands on /admin, fails there, and is redirected again with the cookie
 * cleared rather than being trusted.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;
  const hasSession = Boolean(request.cookies.get(COOKIE)?.value);

  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/login"] };
