import { type NextRequest, NextResponse } from "next/server";
import { authClient } from "./lib/auth";

export async function middleware(request: NextRequest) {
	const headers = request.headers;

	console.log(headers);

	const { data, error } = await authClient.getSession({
		fetchOptions: { headers },
	});

	console.log(data);

	if (!data?.user || error) {
		return NextResponse.redirect(new URL("/auth/sign-in", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/:path*", "/dashboard/:path*"],
};
