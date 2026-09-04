
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/crypto";

const SESSION_COOKIE_NAME = "odsm_session";

// Paths that don't require authentication
const publicPaths = ["/login", "/setup", "/api/auth", "/manifest.json", "/favicon.ico", "/superadmin/login", "/api/testdb"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Allow public paths without any check
    if (publicPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // 2. Superadmin routes — only check superadmin session cookie, no license needed
    if (pathname.startsWith("/superadmin")) {
        const superadminSession = request.cookies.get("odsm_superadmin_session");
        if (!superadminSession || superadminSession.value !== "authenticated") {
            const url = request.nextUrl.clone();
            url.pathname = "/superadmin/login";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    // 3. Require standard session cookie for all other routes
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    try {
        // 4. Decrypt and validate session
        const decrypted = await decrypt(sessionCookie.value);
        const session = JSON.parse(decrypted);

        if (Date.now() > session.expiresAt) {
            throw new Error("Session expired");
        }

        // 5. Access Schedule Restriction (for users with timed access)
        if (session.accessSchedule) {
            const now = new Date();
            const currentDay = now.getDay();
            const currentTime = now.getHours() * 60 + now.getMinutes();

            const { start, end, days } = session.accessSchedule;
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);

            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;

            const isAllowedDay = Array.isArray(days) && days.includes(currentDay);
            const isWithinHours = currentTime >= startTime && currentTime <= endTime;

            if (!isAllowedDay || !isWithinHours) {
                const url = request.nextUrl.clone();
                url.pathname = "/login";
                url.searchParams.set("error", "restricted_hours");
                const response = NextResponse.redirect(url);
                response.cookies.delete(SESSION_COOKIE_NAME);
                return response;
            }
        }

        // 6. License blocking — if the layout set a "odsm_license_status=blocked" cookie,
        // the middleware enforces a hard redirect to prevent the user from navigating further.
        // This cookie is set by the layout when checkLicense() fails, and cleared here on redirect.
        const isPageRoute = !pathname.startsWith("/api/");
        const isImpersonation = !!request.cookies.get("impersonated_matricule");

        if (isPageRoute && !isImpersonation) {
            const licenseStatusCookie = request.cookies.get("odsm_license_status");
            if (licenseStatusCookie?.value === "blocked") {
                const url = request.nextUrl.clone();
                url.pathname = "/login";
                url.searchParams.set("error", "license_suspended");
                const response = NextResponse.redirect(url);
                response.cookies.delete(SESSION_COOKIE_NAME);
                response.cookies.delete("odsm_license_status");
                return response;
            }
        }

        // Session is valid — allow request
        return NextResponse.next();

    } catch (error) {
        console.error(`[Middleware] Erreur session pour ${pathname}:`, error);
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const response = NextResponse.redirect(url);
        response.cookies.delete(SESSION_COOKIE_NAME);
        return response;
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, public assets
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
    ],
};
