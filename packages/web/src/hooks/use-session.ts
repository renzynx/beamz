import { authClient } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data;
    },
  });
}
