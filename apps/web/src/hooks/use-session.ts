import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";

export function useSession() {
	return useQuery({
		queryKey: ["session"],
		queryFn: async () => {
			const { data } = await authClient.getSession();
			return data;
		},
	});
}
