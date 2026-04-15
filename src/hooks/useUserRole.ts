import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/constants";

export type { UserRole };

export const useUserRole = () => {
  return useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }

      const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();

      if (error) {
        throw error;
      }
      return data?.role as UserRole;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
